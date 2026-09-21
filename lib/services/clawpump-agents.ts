import { and, eq, ne } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";
import {
  ClawPumpError,
  describeClawPumpError,
  type ClawPumpClient,
} from "../integrations/clawpump/client";
import {
  createClawPumpAgentInputSchema,
  type ClawPumpAgent,
  type CreateClawPumpAgentInput,
} from "../integrations/clawpump/schemas";

type NavisDatabase = NodePgDatabase<typeof schema>;

export const NAVIS_CLAWPUMP_SKILLS = [
  "portfolio",
  "market-intelligence",
  "token-launch",
] as const;

export function buildClawPumpAgentInput(
  name: string,
  objective: string,
): CreateClawPumpAgentInput {
  return createClawPumpAgentInputSchema.parse({
    name,
    persona: "Measured, evidence-led, concise, and explicit about uncertainty.",
    system_prompt: [
      `Capital mandate: ${objective}`,
      "Never treat chat as authorization to move value.",
      "Never claim a transaction, balance, mint, or market launch without provider or onchain evidence.",
      "Navis performs deterministic policy validation outside this agent before any execution.",
    ].join("\n"),
    temperature: 0.2,
    skills: [...NAVIS_CLAWPUMP_SKILLS],
  });
}

export type ClawPumpAgentLink = Readonly<{
  localAgentId: string;
  externalAgentId: string;
  externalWallet: string;
  requestId: string;
  /** Provider token address when the identity already has one, else null. */
  tokenAddress: string | null;
}>;

export type ClawPumpLinkRequest =
  { mode: "create" } | { mode: "attach"; externalAgentId: string };

/**
 * Refusals the API maps to 4xx. Anything else is a provider or storage error.
 */
export class ClawPumpLinkRefused extends Error {
  constructor(
    message: string,
    readonly reason:
      | "not_owned"
      | "public_demo"
      | "already_linked"
      | "external_in_use"
      | "external_not_owned_by_key"
      | "no_strategy",
  ) {
    super(message);
    this.name = "ClawPumpLinkRefused";
  }
}

type LinkContext = Readonly<{
  /** Session user id; the agent must belong to this owner. */
  userId: string;
  client: Pick<ClawPumpClient, "createAgent" | "listAgents" | "getAgent">;
  database: NavisDatabase;
}>;

/**
 * Link one owner-created persistent agent to a ClawPump identity, either by
 * creating one through the Partner API or by attaching an agent the key
 * already owns. Atlas and every public demo row are refused, one link per
 * Navis agent, one Navis agent per external id.
 */
export async function linkClawPumpAgent(
  localAgentId: string,
  request: ClawPumpLinkRequest,
  context: LinkContext,
): Promise<ClawPumpAgentLink> {
  const db = context.database;
  const [local] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, localAgentId))
    .limit(1);
  if (!local || local.ownerId !== context.userId) {
    throw new ClawPumpLinkRefused(
      "The agent does not exist or is not owned by this session.",
      "not_owned",
    );
  }
  if (local.isPublicDemo || !local.ownerId) {
    throw new ClawPumpLinkRefused(
      "Atlas and public demo agents are never linked to a provider identity.",
      "public_demo",
    );
  }
  if (local.integrationStatus === "linked" || local.integrationStatus === "pending") {
    throw new ClawPumpLinkRefused(
      "This agent already has a ClawPump link. One link per agent.",
      "already_linked",
    );
  }

  const operation = request.mode === "create" ? "create_agent" : "attach_agent";
  const startedAt = performance.now();

  await db
    .update(schema.agents)
    .set({ integrationStatus: "pending", updatedAt: new Date() })
    .where(eq(schema.agents.id, local.id));

  let external: ClawPumpAgent & { meta: { requestId: string } };
  let requestedSkills: readonly string[] | undefined;
  try {
    if (request.mode === "create") {
      const [strategy] = await db
        .select()
        .from(schema.strategyVersions)
        .where(
          and(
            eq(schema.strategyVersions.agentId, local.id),
            eq(schema.strategyVersions.version, local.activeStrategyVersion ?? 1),
          ),
        )
        .limit(1);
      if (!strategy) {
        throw new ClawPumpLinkRefused(
          "Local agent has no active strategy version.",
          "no_strategy",
        );
      }
      const input = buildClawPumpAgentInput(local.name, strategy.document.objective);
      requestedSkills = input.skills;
      external = await context.client.createAgent(input);
    } else {
      // Attach only an identity the key owns, proven by the key's own listing.
      const listing = await context.client.listAgents();
      const owned = listing.agents.find(
        (agent) => agent.id === request.externalAgentId,
      );
      if (!owned) {
        throw new ClawPumpLinkRefused(
          "ClawPump did not list that agent id under this Partner key.",
          "external_not_owned_by_key",
        );
      }
      external = { ...owned, meta: listing.meta };
    }

    const [inUse] = await db
      .select({ id: schema.agents.id })
      .from(schema.agents)
      .where(
        and(
          eq(schema.agents.externalAgentId, external.id),
          ne(schema.agents.id, local.id),
        ),
      )
      .limit(1);
    if (inUse) {
      throw new ClawPumpLinkRefused(
        "That ClawPump agent id is already linked to another Navis agent.",
        "external_in_use",
      );
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    await db.transaction(async (transaction) => {
      await transaction.insert(schema.externalCalls).values({
        provider: "clawpump",
        requestId: external.meta.requestId,
        operation,
        status: "succeeded",
        latencyMs,
        metadata: {
          localAgentId: local.id,
          externalAgentId: external.id,
          externalWallet: external.walletAddress,
          tokenAddress: external.tokenAddress ?? null,
          requestedSkills,
        },
      });
      const [updated] = await transaction
        .update(schema.agents)
        .set({
          integrationStatus: "linked",
          externalAgentId: external.id,
          externalWallet: external.walletAddress,
          externalRequestId: external.meta.requestId,
          updatedAt: new Date(),
        })
        .where(eq(schema.agents.id, local.id))
        .returning({ id: schema.agents.id });
      if (!updated) throw new Error("Local agent link update returned no record");
    });

    return {
      localAgentId: local.id,
      externalAgentId: external.id,
      externalWallet: external.walletAddress,
      requestId: external.meta.requestId,
      tokenAddress: external.tokenAddress ?? null,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const refused = error instanceof ClawPumpLinkRefused;
    const safeError =
      error instanceof ClawPumpError
        ? describeClawPumpError(error)
        : error instanceof Error
          ? error.message
          : "ClawPump agent link failed";
    await db.transaction(async (transaction) => {
      await transaction.insert(schema.externalCalls).values({
        provider: "clawpump",
        requestId: error instanceof ClawPumpError ? error.requestId : undefined,
        operation,
        status: "failed",
        latencyMs,
        safeError,
        metadata: {
          localAgentId: local.id,
          requestedExternalAgentId:
            request.mode === "attach" ? request.externalAgentId : undefined,
          requestedSkills,
          refused: refused ? error.reason : undefined,
        },
      });
      // A refusal leaves the agent exactly as it was; a provider failure is
      // recorded on the row so the owner sees it and can retry.
      await transaction
        .update(schema.agents)
        .set({
          integrationStatus: refused ? "not_configured" : "failed",
          updatedAt: new Date(),
        })
        .where(eq(schema.agents.id, local.id));
    });
    throw error;
  }
}

export type ClawPumpIdentityView = Readonly<{
  localAgentId: string;
  localAgentName: string;
  localAgentSlug: string;
  integrationStatus: "not_configured" | "pending" | "linked" | "failed";
  externalAgentId: string | null;
  externalWallet: string | null;
  externalRequestId: string | null;
  /** Live refresh from GET /agents/{id}; null when not linked or refresh failed. */
  live:
    | {
        status: "refreshed";
        name: string;
        agentStatus: string;
        walletAddress: string;
        tokenAddress: string | null;
        requestId: string;
        timestamp: string;
      }
    | { status: "failed"; safeError: string }
    | { status: "not_linked" }
    | { status: "not_configured" };
}>;

/**
 * Navis agent -> ClawPump agent id -> wallet -> token chain for one agent,
 * refreshed from the provider when a client is available.
 */
export async function getClawPumpIdentity(
  agent: Pick<
    typeof schema.agents.$inferSelect,
    | "id"
    | "name"
    | "slug"
    | "integrationStatus"
    | "externalAgentId"
    | "externalWallet"
    | "externalRequestId"
  >,
  client: Pick<ClawPumpClient, "getAgent"> | null,
): Promise<ClawPumpIdentityView> {
  const base = {
    localAgentId: agent.id,
    localAgentName: agent.name,
    localAgentSlug: agent.slug,
    integrationStatus: agent.integrationStatus,
    externalAgentId: agent.externalAgentId,
    externalWallet: agent.externalWallet,
    externalRequestId: agent.externalRequestId,
  };
  if (agent.integrationStatus !== "linked" || !agent.externalAgentId) {
    return { ...base, live: { status: "not_linked" } };
  }
  if (!client) return { ...base, live: { status: "not_configured" } };
  try {
    const live = await client.getAgent(agent.externalAgentId);
    return {
      ...base,
      live: {
        status: "refreshed",
        name: live.name,
        agentStatus: live.status,
        walletAddress: live.walletAddress,
        tokenAddress: live.tokenAddress ?? null,
        requestId: live.meta.requestId,
        timestamp: live.meta.timestamp,
      },
    };
  } catch (error) {
    return {
      ...base,
      live: {
        status: "failed",
        safeError:
          error instanceof ClawPumpError
            ? describeClawPumpError(error)
            : "ClawPump identity refresh failed.",
      },
    };
  }
}

/**
 * Agents the key owns that no Navis agent has claimed yet, for the attach
 * picker. Public identifiers only.
 */
export async function listAttachableClawPumpAgents(context: {
  client: Pick<ClawPumpClient, "listAgents">;
  database: NavisDatabase;
}) {
  const listing = await context.client.listAgents();
  const claimed = new Set(
    (
      await context.database
        .select({ externalAgentId: schema.agents.externalAgentId })
        .from(schema.agents)
        .where(eq(schema.agents.integrationStatus, "linked"))
    )
      .map((row) => row.externalAgentId)
      .filter((id): id is string => Boolean(id)),
  );
  return {
    agents: listing.agents
      .filter((agent) => !claimed.has(agent.id))
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        walletAddress: agent.walletAddress,
        tokenAddress: agent.tokenAddress ?? null,
      })),
    meta: listing.meta,
  };
}
