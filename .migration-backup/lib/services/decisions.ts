import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";
import {
  decisionContextSchema,
  decisionRecordSchema,
  type DecisionContext,
  type DecisionRecord,
} from "../domain";
import type {
  DecisionProvider,
  DecisionProviderMetadata,
} from "../integrations/ai/types";
import { hashCanonical } from "../proofs/canonical";

type NavisDatabase = NodePgDatabase<typeof schema>;

export type PreparedDecision = Readonly<{
  context: DecisionContext;
  proposal: DecisionRecord["proposal"];
  modelMetadata: DecisionProviderMetadata;
  decisionHash: string;
}>;

export async function prepareDecision(
  contextCandidate: DecisionContext,
  provider: DecisionProvider,
): Promise<PreparedDecision> {
  const context = decisionContextSchema.parse(contextCandidate);
  const result = await provider.propose(context);
  return Object.freeze({
    context,
    proposal: result.proposal,
    modelMetadata: result.metadata,
    decisionHash: hashCanonical({ context, proposal: result.proposal }),
  });
}

export async function createDecision(
  contextCandidate: DecisionContext,
  provider: DecisionProvider,
  database?: NavisDatabase,
): Promise<DecisionRecord> {
  const prepared = await prepareDecision(contextCandidate, provider);
  const db = database ?? (await import("../db/client")).getDatabase();
  return persistPreparedDecision(prepared, db);
}

/**
 * Writes an already prepared decision after re-checking every referenced
 * input (agent, strategy, policy, portfolio) still exists with the same hash.
 * Accepts a database or an open transaction so callers can bind the decision
 * to its policy evaluation and receipt atomically.
 */
export async function persistPreparedDecision(
  prepared: PreparedDecision,
  db: NavisDatabase,
  options: { clientRequestId?: string } = {},
): Promise<DecisionRecord> {
  return db.transaction(async (transaction) => {
    const [agent] = await transaction
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, prepared.context.agentId))
      .limit(1);
    if (!agent) throw new Error("Decision agent does not exist");
    // Devnet and mainnet agents are bound to one cluster. A demo agent is
    // cluster-agnostic (see agents_mode_cluster_check): the public Atlas row
    // records fixture runs on devnet and PreStocks runs on mainnet-beta, and
    // the run's own cluster is stored on the snapshot, attempt and receipt.
    if (
      agent.mode !== prepared.context.mode ||
      (agent.mode !== "demo" && agent.cluster !== prepared.context.cluster)
    ) {
      throw new Error("Decision mode or cluster does not match the persisted agent");
    }

    const [[strategy], [riskPolicy], [portfolio]] = await Promise.all([
      transaction
        .select()
        .from(schema.strategyVersions)
        .where(
          and(
            eq(schema.strategyVersions.id, prepared.context.strategy.id),
            eq(schema.strategyVersions.agentId, agent.id),
          ),
        )
        .limit(1),
      transaction
        .select()
        .from(schema.riskPolicyVersions)
        .where(
          and(
            eq(schema.riskPolicyVersions.id, prepared.context.riskPolicy.id),
            eq(schema.riskPolicyVersions.agentId, agent.id),
          ),
        )
        .limit(1),
      transaction
        .select()
        .from(schema.portfolioSnapshots)
        .where(
          and(
            eq(schema.portfolioSnapshots.id, prepared.context.portfolio.id),
            eq(schema.portfolioSnapshots.agentId, agent.id),
          ),
        )
        .limit(1),
    ]);
    if (!strategy || strategy.hash !== prepared.context.strategy.hash) {
      throw new Error("Decision strategy reference is missing or altered");
    }
    if (!riskPolicy || riskPolicy.hash !== prepared.context.riskPolicy.hash) {
      throw new Error("Decision risk-policy reference is missing or altered");
    }
    if (
      !portfolio ||
      portfolio.contentHash !== prepared.context.portfolio.contentHash
    ) {
      throw new Error("Decision portfolio reference is missing or altered");
    }

    const [created] = await transaction
      .insert(schema.decisions)
      .values({
        agentId: agent.id,
        strategyVersionId: strategy.id,
        riskPolicyVersionId: riskPolicy.id,
        portfolioSnapshotId: portfolio.id,
        status: "proposed",
        proposal: prepared.proposal,
        modelMetadata: prepared.modelMetadata,
        decisionHash: prepared.decisionHash,
        expiresAt: new Date(prepared.proposal.expiresAt),
        clientRequestId: options.clientRequestId ?? null,
      })
      .returning();
    if (!created) throw new Error("Decision persistence returned no record");

    return decisionRecordSchema.parse({
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
    });
  });
}
