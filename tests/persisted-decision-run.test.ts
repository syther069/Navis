import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import * as schema from "../lib/db/schema";
import { proofReceiptDocumentSchema, verifyProofReceipt } from "../lib/proofs/receipt";
import {
  createPersistentAgent,
  getPersistentAgentForOwner,
  listPersistentAgentsForOwner,
} from "../lib/services/agents";
import {
  listDecisionsForOwner,
  listProofsForOwner,
  loadProofForOwner,
} from "../lib/services/decision-records";
import {
  createExecutionAttempt,
  openGuardedExecutionAttempt,
} from "../lib/services/execution";
import {
  loadDecisionRun,
  PersistentDecisionRunsNotEnabledError,
  runDecision,
} from "../lib/services/run-decision";

const databaseUrl = process.env.DATABASE_URL;

// Real database round trip: the demo snapshot, decision, policy evaluation,
// execution attempt and proof receipt must be stored together and read back
// only by the owning wallet. Skipped when no database is configured. Every
// test runs inside a transaction that is rolled back at the end, because
// decision, evaluation and receipt rows are immutable and cannot be deleted.
describe.skipIf(!databaseUrl)("persisted decision runs", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const database = drizzle(pool, { schema });
  const ownerWallet = "FxNavisTest1111111111111111111111111111111";
  const otherWallet = "FxNavisTest2222222222222222222222222222222";

  afterAll(async () => {
    await pool.end();
  });

  class Rollback extends Error {}

  async function withScratchAgent(
    run: (
      tx: NodePgDatabase<typeof schema>,
      agent: { id: string; slug: string },
    ) => Promise<void>,
    riskPolicy = structuredClone(demoAgentBundle.riskPolicy.document),
  ) {
    const slug = `run-test-${randomUUID().slice(0, 8)}`;
    await database
      .transaction(async (tx) => {
        const bundle = await createPersistentAgent(
          {
            slug,
            name: "Run Test Agent",
            ownerWallet,
            mode: "demo",
            cluster: "devnet",
            strategy: structuredClone(demoAgentBundle.strategy.document),
            riskPolicy,
            assets: structuredClone([...demoAgentBundle.assets]),
          },
          tx,
        );
        await run(tx, { id: bundle.agent.id, slug });
        throw new Rollback("rollback scratch data");
      })
      .catch((error) => {
        if (!(error instanceof Rollback)) throw error;
      });
  }

  async function ownedBundle(tx: NodePgDatabase<typeof schema>, slug: string) {
    const bundle = await getPersistentAgentForOwner(slug, ownerWallet, tx);
    if (!bundle) throw new Error("test agent missing");
    return bundle;
  }

  it("stores an approved balanced run with every linked record", async () => {
    await withScratchAgent(async (tx, agent) => {
      const bundle = await ownedBundle(tx, agent.slug);
      const run = await runDecision({ bundle, scenario: "balanced", database: tx });

      expect(run.persisted.store).toBe("database");
      expect(run.policyEvaluation.approved).toBe(true);
      expect(run.proofId).toMatch(/^[0-9a-f-]{36}$/);
      expect(run.receipt.proofId).toBe(run.proofId);
      expect(run.receipt.execution.state).toBe("simulated");
      expect(run.receipt.hashAnchoring.status).toBe("offchain_only");
      expect(run.receipt.execution.transactionSignature).toBeNull();

      const [decision] = await tx
        .select()
        .from(schema.decisions)
        .where(eq(schema.decisions.id, run.decisionId));
      expect(decision?.status).toBe("approved");
      expect(decision?.portfolioSnapshotId).toBe(
        run.receipt.decision.context.portfolio.id,
      );

      const [snapshot] = await tx
        .select()
        .from(schema.portfolioSnapshots)
        .where(eq(schema.portfolioSnapshots.id, decision!.portfolioSnapshotId));
      expect(snapshot?.source).toBe("demo_fixture");
      expect(snapshot?.contentHash).toBe(run.receipt.portfolio.hash);

      const [attempt] = await tx
        .select()
        .from(schema.executionAttempts)
        .where(eq(schema.executionAttempts.decisionId, run.decisionId));
      expect(attempt?.state).toBe("simulated");
      expect(attempt?.transactionSignature).toBeNull();

      const [evaluation] = await tx
        .select({ inputHash: schema.policyEvaluations.inputHash })
        .from(schema.policyEvaluations)
        .where(eq(schema.policyEvaluations.decisionId, run.decisionId));
      expect(evaluation?.inputHash).toBe(run.receipt.policyEvaluation.inputHash);

      const [proof] = await tx
        .select()
        .from(schema.proofReceipts)
        .where(eq(schema.proofReceipts.id, run.proofId!));
      expect(proof?.id).toBe(run.proofId);
      expect(proof?.executionAttemptId).toBe(attempt?.id);
      expect(verifyProofReceipt(run.receipt, proof!.receiptHash).valid).toBe(true);
      expect(proofReceiptDocumentSchema.parse(proof!.document).proofId).toBe(
        run.proofId,
      );
    });
  });

  it("stores a rejected oversized run with a rejected attempt and no execution", async () => {
    await withScratchAgent(async (tx, agent) => {
      const bundle = await ownedBundle(tx, agent.slug);
      const run = await runDecision({ bundle, scenario: "oversized", database: tx });

      expect(run.policyEvaluation.approved).toBe(false);
      expect(
        run.policyEvaluation.checks.find((check) => check.rule === "max_trade_bps")
          ?.status,
      ).toBe("fail");
      expect(run.receipt.execution.state).toBe("rejected");

      const [decision] = await tx
        .select()
        .from(schema.decisions)
        .where(eq(schema.decisions.id, run.decisionId));
      expect(decision?.status).toBe("rejected");
      const [attempt] = await tx
        .select()
        .from(schema.executionAttempts)
        .where(eq(schema.executionAttempts.decisionId, run.decisionId));
      expect(attempt?.state).toBe("rejected");
      expect(attempt?.active).toBe(false);
      expect(attempt?.errorCode).toBe("policy_rejected");
    });
  });

  it("reads stored runs and receipts back only for the owning wallet", async () => {
    await withScratchAgent(async (tx, agent) => {
      const bundle = await ownedBundle(tx, agent.slug);
      const run = await runDecision({ bundle, scenario: "balanced", database: tx });

      const owned = await loadDecisionRun({
        decisionId: run.decisionId,
        database: tx,
        ownerWallet,
      });
      expect(owned?.proofId).toBe(run.proofId);
      expect(owned?.receiptHash).toBe(run.receiptHash);
      expect(owned?.receiptVerified).toBe(true);
      expect(owned?.scenario).toBe("balanced");
      expect(owned?.agent.slug).toBe(agent.slug);

      const stolen = await loadDecisionRun({
        decisionId: run.decisionId,
        database: tx,
        ownerWallet: otherWallet,
      });
      expect(stolen).toBeNull();

      const proof = await loadProofForOwner(run.proofId!, ownerWallet, tx);
      expect(proof?.verification.valid).toBe(true);
      expect(proof?.decisionId).toBe(run.decisionId);
      expect(await loadProofForOwner(run.proofId!, otherWallet, tx)).toBeNull();
      expect(await loadProofForOwner("not-a-uuid", ownerWallet, tx)).toBeNull();

      const decisions = await listDecisionsForOwner(ownerWallet, tx);
      expect(decisions.some((item) => item.decisionId === run.decisionId)).toBe(true);
      expect(decisions.every((item) => item.agent.id === agent.id)).toBe(true);
      const proofs = await listProofsForOwner(ownerWallet, tx);
      expect(proofs.some((item) => item.proofId === run.proofId)).toBe(true);
      expect(await listDecisionsForOwner(otherWallet, tx)).toEqual([]);
      expect(await listProofsForOwner(otherWallet, tx)).toEqual([]);
      expect(
        (await listPersistentAgentsForOwner(ownerWallet, tx)).some(
          (item) => item.id === agent.id,
        ),
      ).toBe(true);
    });
  });

  it.each([
    ["tightest", { max_trade_bps: 1, max_position_bps: 1, max_slippage_bps: 1 }],
    [
      "loosest",
      {
        max_trade_bps: 10_000,
        max_position_bps: 10_000,
        min_reserve_bps: 0,
        max_slippage_bps: 2_000,
        max_daily_turnover_bps: 10_000,
      },
    ],
  ] as const)(
    "keeps the advertised outcomes for a created agent with the %s policy",
    async (_label, limits) => {
      const riskPolicy = structuredClone(demoAgentBundle.riskPolicy.document);
      riskPolicy.constraints = riskPolicy.constraints.map((constraint) =>
        constraint.type in limits
          ? { ...constraint, value: limits[constraint.type as keyof typeof limits] }
          : constraint,
      ) as typeof riskPolicy.constraints;
      await withScratchAgent(async (tx, agent) => {
        const bundle = await ownedBundle(tx, agent.slug);
        const balanced = await runDecision({
          bundle,
          scenario: "balanced",
          database: tx,
        });
        const oversized = await runDecision({
          bundle,
          scenario: "oversized",
          database: tx,
        });
        expect(balanced.policyEvaluation.approved).toBe(true);
        expect(balanced.receipt.execution.state).toBe("simulated");
        expect(oversized.policyEvaluation.approved).toBe(false);
        expect(oversized.receipt.execution.state).toBe("rejected");
      }, riskPolicy);
    },
  );

  it("treats a replayed execution attempt as the same attempt, never a second one", async () => {
    await withScratchAgent(async (tx, agent) => {
      const bundle = await ownedBundle(tx, agent.slug);
      const run = await runDecision({ bundle, scenario: "balanced", database: tx });
      const [first] = await tx
        .select()
        .from(schema.executionAttempts)
        .where(eq(schema.executionAttempts.decisionId, run.decisionId));
      expect(first?.active).toBe(true);

      // Same idempotency key replayed: the stored attempt comes back unchanged.
      const replayed = await createExecutionAttempt(
        {
          decisionId: run.decisionId,
          idempotencyKey: first!.idempotencyKey,
          cluster: "devnet",
        },
        tx,
      );
      expect(replayed.id).toBe(first!.id);
      expect(replayed.state).toBe(first!.state);

      // Same key bound to a different decision is refused.
      const other = await runDecision({ bundle, scenario: "balanced", database: tx });
      await expect(
        createExecutionAttempt(
          {
            decisionId: other.decisionId,
            idempotencyKey: first!.idempotencyKey,
            cluster: "devnet",
          },
          tx,
        ),
      ).rejects.toThrow("already bound to another execution");

      // A fresh key for a decision that already has an active attempt is
      // refused by the guarded gate.
      const [owner] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.wallet, ownerWallet));
      const policyInputHash = run.receipt.policyEvaluation.inputHash;
      await expect(
        openGuardedExecutionAttempt(
          {
            decisionId: run.decisionId,
            idempotencyKey: `replay-${randomUUID()}`,
            cluster: "devnet",
            expectedDecisionHash: run.receipt.decision.hash,
            expectedPolicyInputHash: policyInputHash,
            userId: owner!.id,
            executionKind: "simulation",
          },
          { devnetExecutionAvailable: false, mainnetExecutionAvailable: false },
          tx,
        ),
      ).rejects.toThrow("already has an active execution attempt");

      const attempts = await tx
        .select({ id: schema.executionAttempts.id })
        .from(schema.executionAttempts)
        .where(eq(schema.executionAttempts.decisionId, run.decisionId));
      expect(attempts).toHaveLength(1);
    });
  });

  it("refuses execution and reads for a session that does not own the agent", async () => {
    await withScratchAgent(async (tx, agent) => {
      const bundle = await ownedBundle(tx, agent.slug);
      const run = await runDecision({ bundle, scenario: "balanced", database: tx });

      // The non-owner cannot even resolve the agent for a run.
      expect(await getPersistentAgentForOwner(agent.slug, otherWallet, tx)).toBeNull();

      // The non-owner cannot open an execution attempt on the owner's decision.
      await tx
        .insert(schema.users)
        .values({ wallet: otherWallet })
        .onConflictDoNothing({ target: schema.users.wallet });
      const [intruder] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.wallet, otherWallet));
      await expect(
        openGuardedExecutionAttempt(
          {
            decisionId: run.decisionId,
            idempotencyKey: `intruder-${randomUUID()}`,
            cluster: "devnet",
            expectedDecisionHash: run.receipt.decision.hash,
            expectedPolicyInputHash: run.receipt.policyEvaluation.inputHash,
            userId: intruder!.id,
            executionKind: "simulation",
          },
          { devnetExecutionAvailable: false, mainnetExecutionAvailable: false },
          tx,
        ),
      ).rejects.toThrow("not owned by the authenticated session");
    });
  });

  it("refuses to persist runs for the Atlas fixture or live-mode agents", async () => {
    await withScratchAgent(async (tx, agent) => {
      await expect(
        runDecision({ bundle: demoAgentBundle, scenario: "balanced", database: tx }),
      ).rejects.toThrow("Only persisted agents can store decision runs.");
      const bundle = await ownedBundle(tx, agent.slug);
      await expect(
        runDecision({
          bundle: {
            ...bundle,
            agent: { ...bundle.agent, mode: "devnet", cluster: "devnet" },
          },
          scenario: "balanced",
          database: tx,
        }),
      ).rejects.toBeInstanceOf(PersistentDecisionRunsNotEnabledError);
    });
  });
});
