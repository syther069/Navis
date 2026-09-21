import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import { consumeSharedRateLimit } from "../lib/auth/shared-rate-limit";
import * as schema from "../lib/db/schema";
import type { PreStocksCatalogueLike } from "../lib/integrations/prestocks/research";
import type { PreStocksAsset } from "../lib/integrations/prestocks/schemas";
import { proofReceiptDocumentSchema, verifyProofReceipt } from "../lib/proofs/receipt";
import {
  createPersistentAgent,
  getPersistentAgentForOwner,
} from "../lib/services/agents";
import {
  listDecisions,
  listDecisionsForOwner,
  listProofs,
  listProofsForOwner,
  loadProof,
  loadProofForOwner,
} from "../lib/services/decision-records";
import {
  ensurePublicAtlasAgent,
  PUBLIC_ATLAS_SLUG,
  resolvePublicAtlasBundle,
} from "../lib/services/public-atlas";
import {
  DecisionNotStoredError,
  loadDecisionRun,
  PUBLIC_PERSISTENCE_NOTE,
  runDecision,
  runPublicAtlasDecision,
} from "../lib/services/run-decision";

const databaseUrl = process.env.DATABASE_URL;

type Tx = NodePgDatabase<typeof schema>;

function prestocksAsset(
  overrides: Partial<PreStocksAsset> & { symbol: string },
): PreStocksAsset {
  return {
    name: `${overrides.symbol} PreStocks`,
    description: "Economic exposure only.",
    image: "https://prestocks.com/token.png",
    external_url: `https://prestocks.com/products/${overrides.symbol.toLowerCase()}`,
    contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    markPrice: 100,
    markValuation: 1_000_000_000,
    tokenPrice: 110,
    impliedValuation: 1_100_000_000,
    supply: 10_000_000,
    ...overrides,
  };
}

function freshCatalogue(): PreStocksCatalogueLike {
  return {
    sourceUrl: "https://prestocks.com/api/prestocks",
    // Fresh enough for the Atlas 300-second data-age rule at run time.
    capturedAt: new Date(Date.now() - 5_000).toISOString(),
    assets: [
      prestocksAsset({
        symbol: "SPACEX",
        contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
        markPrice: 150,
        tokenPrice: 120,
        markValuation: 2_000_000_000_000,
        impliedValuation: 1_600_000_000_000,
      }),
      prestocksAsset({
        symbol: "OPENAI",
        contract_address: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
        markPrice: 1_000,
        tokenPrice: 1_120,
        markValuation: 1_200_000_000_000,
        impliedValuation: 1_344_000_000_000,
      }),
      prestocksAsset({
        symbol: "KALSHI",
        contract_address: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
        markPrice: 900,
        tokenPrice: 900,
      }),
      prestocksAsset({
        symbol: "ANDURIL",
        contract_address: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
        markPrice: 154,
        tokenPrice: 160,
      }),
    ],
  };
}

// Real database round trip for the public Atlas demo. Every test runs in a
// transaction that is rolled back, because evidence rows are immutable.
describe.skipIf(!databaseUrl)("public Atlas persistence", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const database = drizzle(pool, { schema });
  const ownerWallet = "FxNavisTest3333333333333333333333333333333";

  afterAll(async () => {
    await pool.end();
  });

  class Rollback extends Error {}

  async function inRollback(run: (tx: Tx) => Promise<void>) {
    await database
      .transaction(async (tx) => {
        await run(tx);
        throw new Rollback("rollback scratch data");
      })
      .catch((error) => {
        if (!(error instanceof Rollback)) throw error;
      });
  }

  async function countRows(
    tx: Tx,
    table: "decisions" | "proof_receipts" | "portfolio_snapshots",
  ) {
    const result = await tx.execute<{ count: string }>(
      `select count(*)::text as count from ${table}`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  it("seeds one ownerless public Atlas agent idempotently", async () => {
    await inRollback(async (tx) => {
      const first = await ensurePublicAtlasAgent(tx);
      const second = await ensurePublicAtlasAgent(tx);
      expect(second.id).toBe(first.id);
      const [row] = await tx
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, first.id));
      expect(row?.isPublicDemo).toBe(true);
      expect(row?.ownerWallet).toBeNull();
      expect(row?.ownerId).toBeNull();
      expect(row?.mode).toBe("demo");
      // Version 1 is always the fixture policy; a shared development database
      // may already hold later PreStocks-derived versions from earlier runs.
      const [v1] = await tx
        .select()
        .from(schema.riskPolicyVersions)
        .where(
          and(
            eq(schema.riskPolicyVersions.agentId, first.id),
            eq(schema.riskPolicyVersions.version, 1),
          ),
        );
      expect(v1?.hash).toBe(demoAgentBundle.riskPolicy.hash);
      // The seeded row cannot be selected through an owner-scoped lookup.
      expect(
        await getPersistentAgentForOwner(PUBLIC_ATLAS_SLUG, ownerWallet, tx),
      ).toBeNull();
    });
  });

  it("stores a balanced Atlas run as a public record and reads it back with no session", async () => {
    await inRollback(async (tx) => {
      const run = await runDecision({
        bundle: demoAgentBundle,
        scenario: "balanced",
        database: tx,
      });
      expect(run.persisted).toEqual({
        store: "database",
        note: PUBLIC_PERSISTENCE_NOTE,
        visibility: "public",
      });
      expect(run.policyEvaluation.approved).toBe(true);
      expect(run.proofId).toMatch(/^[0-9a-f-]{36}$/);
      expect(run.receipt.proofId).toBe(run.proofId);
      expect(run.receipt.execution.state).toBe("simulated");
      expect(run.receipt.execution.transactionSignature).toBeNull();
      expect(run.receipt.execution.explorerUrl).toBeNull();
      expect(run.receipt.hashAnchoring.status).toBe("offchain_only");
      expect(run.agent.slug).toBe(PUBLIC_ATLAS_SLUG);
      expect(JSON.stringify(run)).not.toMatch(/ownerWallet|session|secret|FxNavis/i);

      // Anonymous read: same receipt, same hash, still verifies.
      const reloaded = await loadDecisionRun({
        decisionId: run.decisionId,
        database: tx,
      });
      expect(reloaded?.persisted.visibility).toBe("public");
      expect(reloaded?.receiptHash).toBe(run.receiptHash);
      expect(reloaded?.receipt).toEqual(run.receipt);
      expect(reloaded?.receiptVerified).toBe(true);

      const proof = await loadProof(run.proofId!, {}, tx);
      expect(proof?.visibility).toBe("public");
      expect(proof?.receiptHash).toBe(run.receiptHash);
      expect(proof?.verification.valid).toBe(true);

      // Stored rows verify on their own, independent of the returned object.
      const [stored] = await tx
        .select()
        .from(schema.proofReceipts)
        .where(eq(schema.proofReceipts.id, run.proofId!));
      const document = proofReceiptDocumentSchema.parse(stored!.document);
      expect(verifyProofReceipt(document, stored!.receiptHash).valid).toBe(true);
      expect(stored!.receiptHash).toBe(run.receiptHash);

      // The public record appears in anonymous lists.
      const decisions = await listDecisions({}, tx);
      expect(decisions.find((d) => d.decisionId === run.decisionId)?.visibility).toBe(
        "public",
      );
      const proofs = await listProofs({}, tx);
      expect(proofs.find((p) => p.proofId === run.proofId)?.visibility).toBe("public");
    });
  });

  it("stores an oversized Atlas run as a rejected public record", async () => {
    await inRollback(async (tx) => {
      const run = await runDecision({
        bundle: demoAgentBundle,
        scenario: "oversized",
        database: tx,
      });
      expect(run.policyEvaluation.approved).toBe(false);
      expect(run.receipt.execution.state).toBe("rejected");
      expect(run.proofId).toMatch(/^[0-9a-f-]{36}$/);
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
      expect(attempt?.errorCode).toBe("policy_rejected");
      const reloaded = await loadDecisionRun({
        decisionId: run.decisionId,
        database: tx,
      });
      expect(reloaded?.receiptVerified).toBe(true);
      expect(reloaded?.policyEvaluation.approved).toBe(false);
    });
  });

  it("stores PreStocks universe runs against versioned Atlas documents and reuses versions by hash", async () => {
    await inRollback(async (tx) => {
      const agent = await ensurePublicAtlasAgent(tx);
      const countVersions = async () => {
        const policies = await tx
          .select({ version: schema.riskPolicyVersions.version })
          .from(schema.riskPolicyVersions)
          .where(eq(schema.riskPolicyVersions.agentId, agent.id));
        const strategies = await tx
          .select({ version: schema.strategyVersions.version })
          .from(schema.strategyVersions)
          .where(eq(schema.strategyVersions.agentId, agent.id));
        return { policies: policies.length, strategies: strategies.length };
      };
      const before = await countVersions();
      const loadCatalogue = async () => freshCatalogue();
      const first = await runPublicAtlasDecision({
        scenario: "balanced",
        database: tx,
        universe: "prestocks",
        loadCatalogue,
      });
      expect(first.universe.used).toBe("prestocks");
      expect(first.receiptVerified).toBe(true);
      expect(first.receipt.decision.context.cluster).toBe("mainnet-beta");

      const second = await runPublicAtlasDecision({
        scenario: "oversized",
        database: tx,
        universe: "prestocks",
        loadCatalogue,
      });
      expect(second.policyEvaluation.approved).toBe(false);
      expect(second.receipt.decision.context.riskPolicy.id).toBe(
        first.receipt.decision.context.riskPolicy.id,
      );
      expect(second.receipt.decision.context.strategy.id).toBe(
        first.receipt.decision.context.strategy.id,
      );

      // Two runs on the same catalogue composition add at most one policy and
      // one strategy version (none when this composition was stored before).
      const after = await countVersions();
      expect(after.policies - before.policies).toBeLessThanOrEqual(1);
      expect(after.strategies - before.strategies).toBeLessThanOrEqual(1);
      expect(first.receipt.decision.context.riskPolicy.version).toBeGreaterThan(1);
      expect(first.receipt.strategy.document.riskPolicyVersion).toBe(
        first.receipt.decision.context.riskPolicy.version,
      );

      const reloaded = await loadDecisionRun({
        decisionId: first.decisionId,
        database: tx,
      });
      expect(reloaded?.receiptVerified).toBe(true);
      expect(reloaded?.receiptHash).toBe(first.receiptHash);
    });
  });

  it("returns the stored run for a repeated request key instead of a twin", async () => {
    await inRollback(async (tx) => {
      const before = await countRows(tx, "decisions");
      const clientRequestId = `key-${randomUUID()}`;
      const first = await runPublicAtlasDecision({
        scenario: "balanced",
        database: tx,
        clientRequestId,
      });
      const replay = await runPublicAtlasDecision({
        scenario: "balanced",
        database: tx,
        clientRequestId,
      });
      expect(replay.decisionId).toBe(first.decisionId);
      expect(replay.proofId).toBe(first.proofId);
      expect(replay.receiptHash).toBe(first.receiptHash);
      expect(await countRows(tx, "decisions")).toBe(before + 1);

      const fresh = await runPublicAtlasDecision({
        scenario: "balanced",
        database: tx,
      });
      expect(fresh.decisionId).not.toBe(first.decisionId);
    });
  });

  it("leaves no partial rows when a write inside the chain fails", async () => {
    await inRollback(async (tx) => {
      await ensurePublicAtlasAgent(tx);
      const decisionsBefore = await countRows(tx, "decisions");
      const snapshotsBefore = await countRows(tx, "portfolio_snapshots");
      const proofsBefore = await countRows(tx, "proof_receipts");

      // Fail the last insert of the chain (the proof receipt) and nothing else.
      const failing = new Proxy(tx, {
        get(target, property, receiver) {
          if (property === "transaction") {
            return (fn: (inner: Tx) => Promise<unknown>) =>
              target.transaction((inner) =>
                fn(
                  new Proxy(inner, {
                    get(innerTarget, innerProperty, innerReceiver) {
                      if (innerProperty === "insert") {
                        return (table: unknown) => {
                          if (table === schema.proofReceipts) {
                            throw new Error("simulated proof insert failure");
                          }
                          return innerTarget.insert(table as typeof schema.decisions);
                        };
                      }
                      return Reflect.get(innerTarget, innerProperty, innerReceiver);
                    },
                  }),
                ),
              );
          }
          return Reflect.get(target, property, receiver);
        },
      }) as Tx;

      await expect(
        runPublicAtlasDecision({ scenario: "balanced", database: failing }),
      ).rejects.toBeInstanceOf(DecisionNotStoredError);

      expect(await countRows(tx, "decisions")).toBe(decisionsBefore);
      expect(await countRows(tx, "portfolio_snapshots")).toBe(snapshotsBefore);
      expect(await countRows(tx, "proof_receipts")).toBe(proofsBefore);
    });
  });

  it("keeps owner records private while Atlas records stay public", async () => {
    await inRollback(async (tx) => {
      const slug = `atlas-priv-${randomUUID().slice(0, 8)}`;
      await createPersistentAgent(
        {
          slug,
          name: "Private Agent",
          ownerWallet,
          mode: "demo",
          cluster: "devnet",
          strategy: structuredClone(demoAgentBundle.strategy.document),
          riskPolicy: structuredClone(demoAgentBundle.riskPolicy.document),
          assets: structuredClone([...demoAgentBundle.assets]),
        },
        tx,
      );
      const bundle = await getPersistentAgentForOwner(slug, ownerWallet, tx);
      const owned = await runDecision({
        bundle: bundle!,
        scenario: "balanced",
        database: tx,
      });
      expect(owned.persisted.visibility).toBe("owner");
      const publicRun = await runDecision({
        bundle: demoAgentBundle,
        scenario: "balanced",
        database: tx,
      });

      // Anonymous reader: Atlas yes, owner record indistinguishable from unknown.
      expect(
        await loadDecisionRun({ decisionId: owned.decisionId, database: tx }),
      ).toBeNull();
      expect(await loadProof(owned.proofId!, {}, tx)).toBeNull();
      expect(
        await loadDecisionRun({ decisionId: publicRun.decisionId, database: tx }),
      ).not.toBeNull();

      // Another wallet: still nothing.
      expect(
        await loadDecisionRun({
          decisionId: owned.decisionId,
          database: tx,
          ownerWallet: "FxNavisTest4444444444444444444444444444444",
        }),
      ).toBeNull();

      // The owner: both.
      expect(
        (
          await loadDecisionRun({
            decisionId: owned.decisionId,
            database: tx,
            ownerWallet,
          })
        )?.persisted.visibility,
      ).toBe("owner");
      const list = await listDecisions({ ownerWallet }, tx);
      expect(list.some((d) => d.decisionId === owned.decisionId)).toBe(true);
      expect(list.some((d) => d.decisionId === publicRun.decisionId)).toBe(true);
      const anonymousList = await listDecisions({}, tx);
      expect(anonymousList.some((d) => d.decisionId === owned.decisionId)).toBe(false);
      expect(anonymousList.some((d) => d.decisionId === publicRun.decisionId)).toBe(
        true,
      );

      // Owner-only views (agent history, owner ledgers) never carry public
      // Atlas records, and a public record is not readable as an owner record.
      const ownerOnly = await listDecisionsForOwner(ownerWallet, tx);
      expect(ownerOnly.every((d) => d.visibility === "owner")).toBe(true);
      expect(ownerOnly.some((d) => d.decisionId === owned.decisionId)).toBe(true);
      expect(ownerOnly.some((d) => d.decisionId === publicRun.decisionId)).toBe(false);
      const perAgent = await listDecisionsForOwner(
        ownerWallet,
        tx,
        25,
        bundle!.agent.id,
      );
      expect(perAgent.map((d) => d.decisionId)).toEqual([owned.decisionId]);
      const ownerProofs = await listProofsForOwner(ownerWallet, tx);
      expect(ownerProofs.every((p) => p.visibility === "owner")).toBe(true);
      expect(ownerProofs.some((p) => p.proofId === publicRun.proofId)).toBe(false);
      expect(await loadProofForOwner(publicRun.proofId!, ownerWallet, tx)).toBeNull();
    });
  });

  it("never lets request input alter the stored policy or strategy", async () => {
    await inRollback(async (tx) => {
      const bundle = await resolvePublicAtlasBundle(tx, null);
      expect(bundle.riskPolicy.hash).toBe(demoAgentBundle.riskPolicy.hash);
      expect(bundle.strategy.hash).toBe(demoAgentBundle.strategy.hash);
      const [row] = await tx
        .select()
        .from(schema.riskPolicyVersions)
        .where(
          and(
            eq(schema.riskPolicyVersions.agentId, bundle.agent.id),
            eq(schema.riskPolicyVersions.version, 1),
          ),
        );
      expect(row?.hash).toBe(demoAgentBundle.riskPolicy.hash);
    });
  });

  it("blocks a client over the shared window across instances", async () => {
    await inRollback(async (tx) => {
      const client = `203.0.113.${Math.floor(Math.random() * 250)}`;
      const options = {
        scope: "test.shared",
        client,
        limit: 3,
        windowMs: 60_000,
        secret: "s",
      };
      const results = [];
      for (let i = 0; i < 4; i += 1) {
        results.push(await consumeSharedRateLimit(tx, options));
      }
      expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
      expect(results[3]?.retryAfterSeconds).toBeGreaterThan(0);
      // Only a keyed hash is stored, never the address.
      const rows = await tx
        .select()
        .from(schema.rateLimitWindows)
        .where(eq(schema.rateLimitWindows.scope, "test.shared"));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.clientHash).not.toContain(client);
      // A new window starts clean.
      const later = await consumeSharedRateLimit(tx, {
        ...options,
        now: Date.now() + 61_000,
      });
      expect(later.allowed).toBe(true);
    });
  });
});
