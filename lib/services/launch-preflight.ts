import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";

import * as schema from "../db/schema";
import type { ClawPumpClient } from "../integrations/clawpump/client";
import { solanaPublicKeySchema } from "../domain";

const launchPreflightRequestSchema = z
  .object({
    localAgentId: z.uuid(),
    name: z.string().trim().min(1).max(32),
    symbol: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9]+$/),
    description: z.string().trim().min(20).max(500),
    imageUrl: z.url().refine((value) => value.startsWith("https://")),
    quoteMint: solanaPublicKeySchema,
    creatorFeeBps: z.number().int().min(100).max(300),
    devBuySol: z.number().finite().min(0).max(100).default(0),
  })
  .strict();

export type LaunchPreflightRequest = z.input<typeof launchPreflightRequestSchema>;
type NavisDatabase = NodePgDatabase<typeof schema>;

export async function createLaunchPreflight(
  candidate: unknown,
  context: {
    userId: string;
    wallet: string;
    client: Pick<ClawPumpClient, "getPumpPairs" | "preflightSelfFundedLaunch">;
    database: NavisDatabase;
  },
) {
  const input = launchPreflightRequestSchema.parse(candidate);
  const [agent] = await context.database
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      externalAgentId: schema.agents.externalAgentId,
      externalWallet: schema.agents.externalWallet,
      integrationStatus: schema.agents.integrationStatus,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.id, input.localAgentId),
        eq(schema.agents.ownerId, context.userId),
      ),
    )
    .limit(1);

  if (!agent) throw new Error("The selected Navis agent is not owned by this session.");
  if (agent.integrationStatus !== "linked" || !agent.externalAgentId) {
    throw new Error("The selected Navis agent is not linked to ClawPump.");
  }

  const pairs = await context.client.getPumpPairs();
  const pair = pairs.assets.find((asset) => asset.mint === input.quoteMint);
  if (!pair) {
    throw new Error("The selected quote mint is no longer in the live pair catalogue.");
  }
  if (
    input.creatorFeeBps < pairs.creatorFeeBps.min ||
    input.creatorFeeBps > pairs.creatorFeeBps.max
  ) {
    throw new Error("The creator fee is outside the provider's current live range.");
  }

  const startedAt = performance.now();
  try {
    const quote = await context.client.preflightSelfFundedLaunch({
      name: input.name,
      symbol: input.symbol.toUpperCase(),
      description: input.description,
      imageUrl: input.imageUrl,
      agentId: agent.externalAgentId,
      agentName: agent.name,
      walletAddress: context.wallet,
      pumpQuoteMint: pair.mint,
      pumpCreatorFeeBps: input.creatorFeeBps,
      devBuySol: input.devBuySol,
      preflight: true,
    });

    if (quote.payment.payFrom !== context.wallet) {
      throw new Error("Provider quote payer does not match the authenticated wallet.");
    }

    await context.database.insert(schema.externalCalls).values({
      provider: "clawpump",
      requestId: quote.meta.requestId,
      operation: "launch_preflight",
      status: "quoted",
      latencyMs: Math.round(performance.now() - startedAt),
      metadata: {
        localAgentId: agent.id,
        quoteMint: pair.mint,
        creatorFeeBps: input.creatorFeeBps,
        devBuySol: input.devBuySol,
        amountLamports: quote.payment.amountLamports,
        payTo: quote.payment.payTo,
      },
    });

    return {
      state: "quoted" as const,
      pair,
      creatorFeeBps: input.creatorFeeBps,
      payoutWallet: context.wallet,
      payment: quote.payment,
      preflightToken: quote.retryWith.preflightToken,
      meta: quote.meta,
    };
  } catch (error) {
    await context.database.insert(schema.externalCalls).values({
      provider: "clawpump",
      operation: "launch_preflight",
      status: "failed",
      latencyMs: Math.round(performance.now() - startedAt),
      safeError: error instanceof Error ? error.message : "Launch preflight failed",
      metadata: {
        localAgentId: agent.id,
        quoteMint: pair.mint,
        creatorFeeBps: input.creatorFeeBps,
      },
    });
    throw error;
  }
}
