import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";

import * as schema from "../db/schema";
import { solanaClusterSchema, timestampSchema } from "../domain";

export const executionStates = [
  "created",
  "simulated",
  "awaiting_signature",
  "submitted",
  "confirmed",
  "rejected",
  "cancelled",
  "failed",
  "unknown_pending",
] as const;

export type ExecutionState = (typeof executionStates)[number];

const transitions: Readonly<Record<ExecutionState, readonly ExecutionState[]>> = {
  created: ["simulated", "rejected", "cancelled", "failed"],
  simulated: ["awaiting_signature", "rejected", "cancelled", "failed"],
  awaiting_signature: ["submitted", "rejected", "cancelled", "failed"],
  submitted: ["confirmed", "failed", "unknown_pending"],
  unknown_pending: ["confirmed", "failed", "unknown_pending"],
  confirmed: [],
  rejected: [],
  cancelled: [],
  failed: [],
};

const terminalStates = new Set<ExecutionState>([
  "confirmed",
  "rejected",
  "cancelled",
  "failed",
]);

const createAttemptSchema = z.object({
  decisionId: z.uuid(),
  idempotencyKey: z.string().trim().min(16).max(200),
  cluster: solanaClusterSchema,
});

const openExecutionGateSchema = createAttemptSchema.extend({
  expectedDecisionHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedPolicyInputHash: z.string().regex(/^[a-f0-9]{64}$/),
  userId: z.uuid(),
  executionKind: z.enum(["simulation", "wallet"]),
});

const transitionEvidenceSchema = z.object({
  transactionSignature: z.string().trim().min(32).optional(),
  submittedAt: timestampSchema.optional(),
  confirmedAt: timestampSchema.optional(),
  slot: z.coerce.bigint().nonnegative().optional(),
  feeLamports: z.coerce.bigint().nonnegative().optional(),
  errorCode: z.string().trim().min(1).max(100).optional(),
  safeError: z.string().trim().min(1).max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

type NavisDatabase = NodePgDatabase<typeof schema>;

export function assertExecutionTransition(
  current: ExecutionState,
  next: ExecutionState,
) {
  if (!transitions[current].includes(next)) {
    throw new Error(`Invalid execution transition: ${current} → ${next}.`);
  }
}

export function isTerminalExecutionState(state: ExecutionState) {
  return terminalStates.has(state);
}

export type ExecutionGateSnapshot = Readonly<{
  decisionStatus:
    | "proposed"
    | "approved"
    | "rejected"
    | "expired"
    | "executing"
    | "executed"
    | "failed";
  decisionHash: string;
  expectedDecisionHash: string;
  decisionExpiresAt: Date;
  proposalExpiresAt: Date;
  proposalAction: "BUY" | "SELL" | "HOLD" | "REBALANCE";
  ownerId: string | null;
  expectedOwnerId: string;
  mode: "demo" | "devnet" | "mainnet";
  cluster: "devnet" | "mainnet-beta";
  executionKind: "simulation" | "wallet";
  devnetExecutionAvailable: boolean;
  mainnetExecutionAvailable: boolean;
  policyEvaluation: { approved: boolean; inputHash: string } | null;
  expectedPolicyInputHash: string;
  hasActiveAttempt: boolean;
  now: Date;
}>;

export function assertExecutionGate(snapshot: ExecutionGateSnapshot) {
  if (snapshot.ownerId !== snapshot.expectedOwnerId) {
    throw new Error("Decision is not owned by the authenticated session.");
  }
  if (snapshot.decisionStatus !== "approved") {
    throw new Error("Decision is not approved for execution.");
  }
  if (snapshot.decisionHash !== snapshot.expectedDecisionHash) {
    throw new Error("Decision hash changed after review.");
  }
  if (
    snapshot.decisionExpiresAt.getTime() <= snapshot.now.getTime() ||
    snapshot.proposalExpiresAt.getTime() <= snapshot.now.getTime()
  ) {
    throw new Error("Decision or proposal has expired.");
  }
  if (snapshot.proposalAction === "HOLD") {
    throw new Error("HOLD decisions do not create value-moving executions.");
  }
  if (
    !snapshot.policyEvaluation?.approved ||
    snapshot.policyEvaluation.inputHash !== snapshot.expectedPolicyInputHash
  ) {
    throw new Error("A matching approved policy evaluation is required.");
  }
  if (snapshot.hasActiveAttempt) {
    throw new Error("Decision already has an active execution attempt.");
  }
  if (snapshot.executionKind === "wallet") {
    if (snapshot.mode === "demo") {
      throw new Error("Demo decisions cannot enter a wallet execution path.");
    }
    if (snapshot.mode === "devnet" && !snapshot.devnetExecutionAvailable) {
      throw new Error("Devnet execution is not enabled.");
    }
    if (snapshot.mode === "mainnet" && !snapshot.mainnetExecutionAvailable) {
      throw new Error("Mainnet execution is not enabled.");
    }
  }
  if (snapshot.mode === "devnet" && snapshot.cluster !== "devnet") {
    throw new Error("Devnet decision cluster mismatch.");
  }
  if (snapshot.mode === "mainnet" && snapshot.cluster !== "mainnet-beta") {
    throw new Error("Mainnet decision cluster mismatch.");
  }
}

export function validateTransitionEvidence(
  current: ExecutionState,
  next: ExecutionState,
  candidate: unknown,
  existing: { transactionSignature?: string | null } = {},
) {
  assertExecutionTransition(current, next);
  const evidence = transitionEvidenceSchema.parse(candidate);
  const transactionSignature =
    evidence.transactionSignature ?? existing.transactionSignature ?? undefined;

  if (["submitted", "confirmed", "unknown_pending"].includes(next)) {
    if (!transactionSignature) {
      throw new Error(`${next} requires a real transaction signature.`);
    }
  }
  if (next === "confirmed" && (!evidence.confirmedAt || evidence.slot === undefined)) {
    throw new Error("confirmed requires a confirmation timestamp and slot.");
  }
  if (next === "failed" && !evidence.safeError) {
    throw new Error("failed requires a safe error description.");
  }

  return { ...evidence, transactionSignature };
}

export async function createExecutionAttempt(
  candidate: unknown,
  database: NavisDatabase,
) {
  const input = createAttemptSchema.parse(candidate);

  return database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(schema.executionAttempts)
      .values({
        decisionId: input.decisionId,
        idempotencyKey: input.idempotencyKey,
        cluster: input.cluster,
        state: "created",
        active: true,
      })
      .onConflictDoNothing({ target: schema.executionAttempts.idempotencyKey })
      .returning();

    if (created) {
      await transaction.insert(schema.executionEvents).values({
        executionAttemptId: created.id,
        priorState: null,
        state: "created",
        metadata: { idempotencyKey: input.idempotencyKey },
      });
      return created;
    }

    const [existing] = await transaction
      .select()
      .from(schema.executionAttempts)
      .where(eq(schema.executionAttempts.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (!existing || existing.decisionId !== input.decisionId) {
      throw new Error("Idempotency key is already bound to another execution.");
    }
    return existing;
  });
}

export async function transitionExecutionAttempt(
  attemptId: string,
  next: ExecutionState,
  candidateEvidence: unknown,
  database: NavisDatabase,
) {
  return database.transaction(async (transaction) => {
    const [current] = await transaction
      .select()
      .from(schema.executionAttempts)
      .where(eq(schema.executionAttempts.id, attemptId))
      .limit(1);
    if (!current) throw new Error("Execution attempt not found.");

    const evidence = validateTransitionEvidence(
      current.state,
      next,
      candidateEvidence,
      current,
    );
    const now = new Date();
    const [updated] = await transaction
      .update(schema.executionAttempts)
      .set({
        state: next,
        active: !isTerminalExecutionState(next),
        transactionSignature: evidence.transactionSignature,
        submittedAt:
          evidence.submittedAt !== undefined
            ? new Date(evidence.submittedAt)
            : next === "submitted"
              ? now
              : current.submittedAt,
        confirmedAt:
          evidence.confirmedAt !== undefined
            ? new Date(evidence.confirmedAt)
            : current.confirmedAt,
        slot: evidence.slot ?? current.slot,
        feeLamports:
          evidence.feeLamports !== undefined
            ? evidence.feeLamports.toString()
            : current.feeLamports,
        errorCode: evidence.errorCode ?? current.errorCode,
        safeError: evidence.safeError ?? current.safeError,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.executionAttempts.id, attemptId),
          eq(schema.executionAttempts.state, current.state),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Execution state changed concurrently; reload before retrying.");
    }

    await transaction.insert(schema.executionEvents).values({
      executionAttemptId: attemptId,
      priorState: current.state,
      state: next,
      metadata: evidence.metadata,
    });

    return updated;
  });
}

export async function openGuardedExecutionAttempt(
  candidate: unknown,
  capabilities: {
    devnetExecutionAvailable: boolean;
    mainnetExecutionAvailable: boolean;
  },
  database: NavisDatabase,
) {
  const input = openExecutionGateSchema.parse(candidate);

  return database.transaction(async (transaction) => {
    const [decision] = await transaction
      .select({
        id: schema.decisions.id,
        status: schema.decisions.status,
        decisionHash: schema.decisions.decisionHash,
        expiresAt: schema.decisions.expiresAt,
        proposal: schema.decisions.proposal,
        ownerId: schema.agents.ownerId,
        mode: schema.agents.mode,
        cluster: schema.agents.cluster,
      })
      .from(schema.decisions)
      .innerJoin(schema.agents, eq(schema.agents.id, schema.decisions.agentId))
      .where(eq(schema.decisions.id, input.decisionId))
      .limit(1);
    if (!decision) throw new Error("Decision not found.");
    if (input.cluster !== decision.cluster) {
      throw new Error("Requested execution cluster does not match the decision.");
    }

    const [[evaluation], [activeAttempt]] = await Promise.all([
      transaction
        .select({
          approved: schema.policyEvaluations.approved,
          inputHash: schema.policyEvaluations.inputHash,
        })
        .from(schema.policyEvaluations)
        .where(eq(schema.policyEvaluations.decisionId, decision.id))
        .orderBy(desc(schema.policyEvaluations.evaluatedAt))
        .limit(1),
      transaction
        .select({ id: schema.executionAttempts.id })
        .from(schema.executionAttempts)
        .where(
          and(
            eq(schema.executionAttempts.decisionId, decision.id),
            eq(schema.executionAttempts.active, true),
          ),
        )
        .limit(1),
    ]);

    assertExecutionGate({
      decisionStatus: decision.status,
      decisionHash: decision.decisionHash,
      expectedDecisionHash: input.expectedDecisionHash,
      decisionExpiresAt: decision.expiresAt,
      proposalExpiresAt: new Date(decision.proposal.expiresAt),
      proposalAction: decision.proposal.action,
      ownerId: decision.ownerId,
      expectedOwnerId: input.userId,
      mode: decision.mode,
      cluster: decision.cluster,
      executionKind: input.executionKind,
      ...capabilities,
      policyEvaluation: evaluation ?? null,
      expectedPolicyInputHash: input.expectedPolicyInputHash,
      hasActiveAttempt: Boolean(activeAttempt),
      now: new Date(),
    });

    const [created] = await transaction
      .insert(schema.executionAttempts)
      .values({
        decisionId: input.decisionId,
        idempotencyKey: input.idempotencyKey,
        cluster: input.cluster,
        state: "created",
        active: true,
      })
      .onConflictDoNothing({ target: schema.executionAttempts.idempotencyKey })
      .returning();

    if (!created) {
      const [existing] = await transaction
        .select()
        .from(schema.executionAttempts)
        .where(eq(schema.executionAttempts.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing?.decisionId === input.decisionId) return existing;
      throw new Error("Idempotency key is already bound to another execution.");
    }

    await transaction.insert(schema.executionEvents).values({
      executionAttemptId: created.id,
      priorState: null,
      state: "created",
      metadata: {
        executionKind: input.executionKind,
        decisionHash: input.expectedDecisionHash,
        policyInputHash: input.expectedPolicyInputHash,
      },
    });
    const [claimedDecision] = await transaction
      .update(schema.decisions)
      .set({ status: "executing", updatedAt: new Date() })
      .where(
        and(
          eq(schema.decisions.id, input.decisionId),
          eq(schema.decisions.status, "approved"),
        ),
      )
      .returning({ id: schema.decisions.id });
    if (!claimedDecision) {
      throw new Error(
        "Decision authorization changed concurrently; reload and review.",
      );
    }

    return created;
  });
}
