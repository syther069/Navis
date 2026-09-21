import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import bs58 from "bs58";
import { and, eq, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import nacl from "tweetnacl";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import { buildPoolConfig } from "../lib/db/connection";
import { classifyDatabaseError, DatabaseError } from "../lib/db/errors";
import * as schema from "../lib/db/schema";
import {
  createPersistentAgent,
  createPersistentAgentIdempotent,
  getPersistentAgentForOwner,
  listPersistentAgentsForOwner,
} from "../lib/services/agents";

const databaseUrl = process.env.DATABASE_URL;

// The wallet auth server module reads the shared env; give it a complete
// authentication configuration so the session tests exercise the real
// challenge table instead of the "not_configured" short circuit.
vi.mock("../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      appUrl: "https://navis.test",
      appOriginConfigured: true,
      sessionSecret: "database-persistence-test-secret-with-32-plus-characters",
    },
  };
});

if (!databaseUrl) {
  console.warn(
    "[tests/database-persistence] DATABASE_URL is not set; real-database persistence tests are skipped.",
  );
}

// Real PostgreSQL round trips. Every writing test runs inside a transaction
// that is rolled back at the end: strategy and risk-policy versions are
// immutable by trigger, so DELETE cleanup is not an option.
describe.skipIf(!databaseUrl)("database persistence", () => {
  // The describe body still runs when the suite is skipped, so the pool is
  // only built once DATABASE_URL is known to be present.
  const pool = new Pool({
    ...(databaseUrl ? buildPoolConfig(databaseUrl) : {}),
    max: 2,
  });
  const database = drizzle(pool, { schema });
  type Tx = NodePgDatabase<typeof schema>;

  const ownerWallet = "FxNavisTest1111111111111111111111111111111";
  const otherWallet = "FxNavisTest2222222222222222222222222222222";

  afterAll(async () => {
    await pool.end();
  });

  class Rollback extends Error {}

  async function inRolledBackTransaction(run: (tx: Tx) => Promise<void>) {
    await database
      .transaction(async (tx) => {
        await run(tx);
        throw new Rollback("rollback test data");
      })
      .catch((error) => {
        if (!(error instanceof Rollback)) throw error;
      });
  }

  function mandate(overrides: { slug?: string; clientRequestId?: string } = {}) {
    return {
      slug: overrides.slug ?? `db-test-${randomUUID().slice(0, 8)}`,
      name: "Database Test Agent",
      ownerWallet,
      mode: "demo" as const,
      cluster: "devnet" as const,
      clientRequestId: overrides.clientRequestId,
      strategy: structuredClone(demoAgentBundle.strategy.document),
      riskPolicy: structuredClone(demoAgentBundle.riskPolicy.document),
      assets: structuredClone([...demoAgentBundle.assets]),
    };
  }

  describe("connection and readiness", () => {
    it("connects with the configured pool settings and answers a query", async () => {
      const result = await database.execute<{ ok: number }>(sql`select 1 as ok`);
      expect(result.rows[0]?.ok).toBe(1);
    });

    it("has every table and immutability guard the health check requires", async () => {
      const result = await database.execute<{
        tables: number;
        guards: number;
        idempotency_column: boolean;
      }>(sql`
        select
          (select count(*)::int from information_schema.tables
            where table_schema = 'public' and table_name in (
              'users', 'agents', 'assets', 'agent_asset_permissions',
              'strategy_versions', 'risk_policy_versions', 'treasury_accounts',
              'portfolio_snapshots', 'decisions', 'policy_evaluations',
              'execution_attempts', 'proof_receipts', 'market_launches',
              'external_calls', 'auth_challenges', 'execution_events',
              'execution_intents'
            )) as tables,
          (select count(*)::int from pg_trigger t
            join pg_class c on c.oid = t.tgrelid
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and not t.tgisinternal
              and t.tgenabled in ('O', 'A') and t.tgname in (
                'strategy_versions_immutable', 'risk_policy_versions_immutable',
                'proof_receipts_append_only', 'portfolio_snapshots_immutable',
                'decisions_evidence_immutable', 'execution_events_immutable',
                'policy_evaluations_immutable'
              )) as guards,
          exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'agents'
              and column_name = 'client_request_id') as idempotency_column
      `);
      expect(result.rows[0]).toEqual({
        tables: 17,
        guards: 7,
        idempotency_column: true,
      });
    });
  });

  describe("migration journal compatibility", () => {
    it("has applied exactly the migrations in drizzle/meta/_journal.json, in order, with matching hashes", async () => {
      const journal = JSON.parse(
        await readFile(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
      ) as { entries: Array<{ idx: number; tag: string; when: number }> };
      const expected = await Promise.all(
        journal.entries.map(async (entry) => ({
          idx: entry.idx,
          hash: createHash("sha256")
            .update(await readFile(join(process.cwd(), "drizzle", `${entry.tag}.sql`)))
            .digest("hex"),
          when: entry.when,
        })),
      );
      const applied = await database.execute<{ hash: string; created_at: string }>(
        sql`select hash, created_at from drizzle.__drizzle_migrations order by id`,
      );

      expect(applied.rows.map((row) => row.hash)).toEqual(
        expected.map((entry) => entry.hash),
      );
      expect(applied.rows.map((row) => Number(row.created_at))).toEqual(
        expected.map((entry) => entry.when),
      );
      expect(journal.entries.at(-1)?.tag).toBe("0010_clawpump_external_agent_unique");
    });
  });

  describe("agents", () => {
    it("creates an agent and reads it back with the same mandate hashes", async () => {
      await inRolledBackTransaction(async (tx) => {
        const created = await createPersistentAgent(mandate(), tx);
        const loaded = await getPersistentAgentForOwner(
          created.agent.slug,
          ownerWallet,
          tx,
        );

        expect(loaded).not.toBeNull();
        expect(loaded?.agent.id).toBe(created.agent.id);
        expect(loaded?.strategy.hash).toBe(created.strategy.hash);
        expect(loaded?.riskPolicy.hash).toBe(created.riskPolicy.hash);
        expect(loaded?.assets.map((asset) => asset.mint).sort()).toEqual(
          demoAgentBundle.assets.map((asset) => asset.mint).sort(),
        );
        const listed = await listPersistentAgentsForOwner(ownerWallet, tx);
        expect(listed.map((agent) => agent.id)).toContain(created.agent.id);
      });
    });

    it("isolates agents between two wallets", async () => {
      await inRolledBackTransaction(async (tx) => {
        const created = await createPersistentAgent(mandate(), tx);

        expect(
          await getPersistentAgentForOwner(created.agent.slug, otherWallet, tx),
        ).toBe(null);
        const othersAgents = await listPersistentAgentsForOwner(otherWallet, tx);
        expect(othersAgents.map((agent) => agent.id)).not.toContain(created.agent.id);
      });
    });

    it("returns the first agent for a repeated client request key", async () => {
      await inRolledBackTransaction(async (tx) => {
        const clientRequestId = randomUUID();
        const first = await createPersistentAgentIdempotent(
          mandate({ clientRequestId }),
          tx,
        );
        const second = await createPersistentAgentIdempotent(
          mandate({ clientRequestId }),
          tx,
        );

        expect(first.replayed).toBe(false);
        expect(second.replayed).toBe(true);
        expect(second.bundle.agent.id).toBe(first.bundle.agent.id);

        const rows = await tx
          .select({ id: schema.agents.id })
          .from(schema.agents)
          .where(
            and(
              eq(schema.agents.ownerWallet, ownerWallet),
              eq(schema.agents.clientRequestId, clientRequestId),
            ),
          );
        expect(rows).toHaveLength(1);
      });
    });

    it("refuses to replay a key whose mandate has changed", async () => {
      await inRolledBackTransaction(async (tx) => {
        const clientRequestId = randomUUID();
        await createPersistentAgentIdempotent(mandate({ clientRequestId }), tx);
        const changed = mandate({ clientRequestId });
        changed.name = "Renamed Agent";

        const failure = await createPersistentAgentIdempotent(changed, tx)
          .then(() => null)
          .catch((error: unknown) => classifyDatabaseError(error));
        expect(failure?.code).toBe("duplicate_request");
      });
    });

    it("rejects a second row for the same key at the database level", async () => {
      await inRolledBackTransaction(async (tx) => {
        const clientRequestId = randomUUID();
        await createPersistentAgent(mandate({ clientRequestId }), tx);

        // A nested transaction becomes a savepoint, so the unique violation
        // does not poison the outer transaction.
        const failure = await tx
          .transaction((inner) =>
            createPersistentAgent(mandate({ clientRequestId }), inner),
          )
          .then(() => null)
          .catch((error: unknown) => classifyDatabaseError(error));

        expect(failure).toBeInstanceOf(DatabaseError);
        expect(failure?.code).toBe("duplicate_request");
      });
    });

    it("does not leave a partial agent behind when creation fails mid-transaction", async () => {
      await inRolledBackTransaction(async (tx) => {
        const slug = `db-rollback-${randomUUID().slice(0, 8)}`;
        const broken = mandate({ slug });
        // Passes schema validation but fails after the agent row is inserted:
        // asset permissions need at least one asset-level action.
        broken.strategy.allowedActions = ["REBALANCE"];

        await expect(
          tx.transaction((inner) => createPersistentAgent(broken, inner)),
        ).rejects.toThrow(/asset-level action/);

        const rows = await tx
          .select({ id: schema.agents.id })
          .from(schema.agents)
          .where(eq(schema.agents.slug, slug));
        expect(rows).toHaveLength(0);
        expect(await getPersistentAgentForOwner(slug, ownerWallet, tx)).toBeNull();
      });
    });
  });

  describe("wallet sessions", () => {
    // These go through the module-level pool inside lib/auth/server, so they
    // cannot ride a rolled-back transaction. auth_challenges and users carry
    // no immutability trigger; the rows for this throwaway wallet are removed
    // afterwards.
    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);

    async function cleanup() {
      await database
        .delete(schema.authChallenges)
        .where(eq(schema.authChallenges.wallet, wallet));
      await database.delete(schema.users).where(eq(schema.users.wallet, wallet));
    }

    beforeEach(cleanup);
    afterAll(cleanup);

    it("issues a single-use challenge and a session that survives a fresh request", async () => {
      const auth = await import("../lib/auth/server");
      const challenge = await auth.createAuthenticationChallenge(wallet);

      const [stored] = await database
        .select()
        .from(schema.authChallenges)
        .where(eq(schema.authChallenges.id, challenge.challengeId));
      expect(stored?.usedAt).toBeNull();
      expect(stored?.nonceHash).not.toBe(challenge.nonce);

      const signature = bs58.encode(
        nacl.sign.detached(
          new TextEncoder().encode(challenge.message),
          keypair.secretKey,
        ),
      );
      const { token, user } = await auth.verifyAuthenticationChallenge({
        challengeId: challenge.challengeId,
        wallet,
        nonce: challenge.nonce,
        signature,
      });
      expect(user.wallet).toBe(wallet);

      // A later request presents only the cookie value.
      const session = await auth.readSessionToken(token);
      expect(session?.wallet).toBe(wallet);
      expect(session?.userId).toBe(user.id);

      const [persistedUser] = await database
        .select()
        .from(schema.users)
        .where(eq(schema.users.wallet, wallet));
      expect(persistedUser?.id).toBe(user.id);

      // The nonce is consumed: replaying the same signed challenge fails.
      await expect(
        auth.verifyAuthenticationChallenge({
          challengeId: challenge.challengeId,
          wallet,
          nonce: challenge.nonce,
          signature,
        }),
      ).rejects.toMatchObject({ code: "challenge_replayed" });
    });

    it("rejects a signature from a different key for the claimed wallet", async () => {
      const auth = await import("../lib/auth/server");
      const challenge = await auth.createAuthenticationChallenge(wallet);
      const impostor = nacl.sign.keyPair();
      const signature = bs58.encode(
        nacl.sign.detached(
          new TextEncoder().encode(challenge.message),
          impostor.secretKey,
        ),
      );

      await expect(
        auth.verifyAuthenticationChallenge({
          challengeId: challenge.challengeId,
          wallet,
          nonce: challenge.nonce,
          signature,
        }),
      ).rejects.toMatchObject({ code: "invalid_signature" });

      const [stored] = await database
        .select()
        .from(schema.authChallenges)
        .where(eq(schema.authChallenges.id, challenge.challengeId));
      expect(stored?.usedAt).toBeNull();
    });

    it("rejects a tampered or expired session token", async () => {
      const auth = await import("../lib/auth/server");
      expect(await auth.readSessionToken("not-a-token")).toBeNull();
      const { SignJWT } = await import("jose");
      const expired = await new SignJWT({ wallet })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(randomUUID())
        .setIssuer("https://navis.test")
        .setAudience("navis")
        .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
        .sign(
          new TextEncoder().encode(
            "database-persistence-test-secret-with-32-plus-characters",
          ),
        );
      expect(await auth.readSessionToken(expired)).toBeNull();
    });
  });
});
