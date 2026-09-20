import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";
import type { ClawPumpClient } from "../integrations/clawpump/client";
import {
  createClawPumpAgentInputSchema,
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
}>;

export async function linkClawPumpAgent(
  localAgentId: string,
  client: Pick<ClawPumpClient, "createAgent">,
  database?: NavisDatabase,
): Promise<ClawPumpAgentLink> {
  const db = database ?? (await import("../db/client")).getDatabase();
  const [local] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, localAgentId))
    .limit(1);
  if (!local) throw new Error("Local agent does not exist");
  if (local.integrationStatus === "linked") {
    if (!local.externalAgentId || !local.externalWallet || !local.externalRequestId) {
      throw new Error("Linked agent evidence is incomplete");
    }
    return {
      localAgentId: local.id,
      externalAgentId: local.externalAgentId,
      externalWallet: local.externalWallet,
      requestId: local.externalRequestId,
    };
  }

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
  if (!strategy) throw new Error("Local agent has no active strategy version");
  const request = buildClawPumpAgentInput(local.name, strategy.document.objective);

  await db
    .update(schema.agents)
    .set({ integrationStatus: "pending", updatedAt: new Date() })
    .where(eq(schema.agents.id, local.id));

  const startedAt = performance.now();
  let createdExternal:
    { id: string; walletAddress: string; meta: { requestId: string } } | undefined;
  try {
    const external = await client.createAgent(request);
    createdExternal = external;
    const latencyMs = Math.round(performance.now() - startedAt);
    await db.transaction(async (transaction) => {
      await transaction.insert(schema.externalCalls).values({
        provider: "clawpump",
        requestId: external.meta.requestId,
        operation: "create_agent",
        status: "succeeded",
        latencyMs,
        metadata: {
          localAgentId: local.id,
          externalAgentId: external.id,
          requestedSkills: request.skills,
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
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const requestId =
      error && typeof error === "object" && "requestId" in error
        ? String(error.requestId ?? "") || undefined
        : undefined;
    const safeError =
      error instanceof Error ? error.message : "ClawPump agent link failed";
    await db.transaction(async (transaction) => {
      await transaction.insert(schema.externalCalls).values({
        provider: "clawpump",
        requestId,
        operation: "create_agent",
        status: "failed",
        latencyMs,
        safeError,
        metadata: {
          localAgentId: local.id,
          externalAgentId: createdExternal?.id,
          requestedSkills: request.skills,
        },
      });
      await transaction
        .update(schema.agents)
        .set({
          status: "draft",
          integrationStatus: "failed",
          externalAgentId: createdExternal?.id ?? null,
          externalWallet: createdExternal?.walletAddress ?? null,
          externalRequestId: createdExternal?.meta.requestId ?? requestId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.agents.id, local.id));
    });
    throw error;
  }
}
