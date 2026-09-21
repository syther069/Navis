import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import { buildPoolConfig } from "../lib/db/connection";
import * as schema from "../lib/db/schema";
import { ClawPumpError } from "../lib/integrations/clawpump/client";
import {
  indexPreStocksMints,
  WRAPPED_SOL_MINT,
} from "../lib/integrations/clawpump/pairs";
import { createPersistentAgent } from "../lib/services/agents";
import {
  ClawPumpLinkRefused,
  getClawPumpIdentity,
  linkClawPumpAgent,
} from "../lib/services/clawpump-agents";
import {
  createLaunchPreflight,
  getLatestLaunchPreflightForOwner,
  getStoredClawPumpLaunchForOwner,
  LAUNCH_PREFLIGHT_OPERATION,
  LaunchPreflightRefused,
} from "../lib/services/launch-preflight";

const databaseUrl = process.env.DATABASE_URL;

const ownerWallet = "FxNavisTest3333333333333333333333333333333";
const otherWallet = "FxNavisTest4444444444444444444444444444444";
const EXTERNAL_WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const PAY_TO = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";
const STOCK_MINT = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
const meta = { timestamp: "2026-09-21T10:00:00.000Z", requestId: "req-link-1" };

function externalAgent(id = "agent_ext_1") {
  return {
    id,
    name: "Income Sentinel",
    status: "active",
    walletAddress: EXTERNAL_WALLET,
    skills: ["chat"],
    tokenAddress: null,
  };
}

function pairsResponse() {
  return {
    assets: [
      {
        mint: WRAPPED_SOL_MINT,
        symbol: "SOL",
        name: "Wrapped SOL",
        decimals: 9,
        imageUrl: null,
      },
      {
        mint: STOCK_MINT,
        symbol: "TSLAx",
        name: "Tesla pre-stock",
        decimals: 8,
        imageUrl: null,
      },
    ],
    creatorFeeBps: { min: 100, max: 300, default: 200 },
    meta: { ...meta, requestId: "req-pairs" },
  };
}

function costResponse() {
  return {
    paymentMethod: "sol" as const,
    quoteMint: STOCK_MINT,
    payTo: PAY_TO,
    creationFeeSol: 0.02,
    defaultDevBuySol: 0,
    standardCostSol: 0.02,
    quoteValidForSeconds: 300,
    meta: { ...meta, requestId: "req-cost" },
  };
}

function quoteResponse(payFrom: string) {
  return {
    payment: {
      method: "sol" as const,
      amountLamports: 25_000_000,
      amountSol: 0.025,
      payTo: PAY_TO,
      payFrom,
      validForSeconds: 300,
      breakdown: { creationFeeSol: 0.02, devBuySol: 0.005 },
    },
    retryWith: { txSignature: "<signature>", preflightToken: "pft_secret_token" },
    meta: { ...meta, requestId: "req-quote" },
  };
}

const verifiedMintRpc = {
  request: vi.fn(async (method: string) =>
    method === "getMultipleAccounts"
      ? {
          context: { slot: 1 },
          value: [
            {
              owner: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
              data: {
                program: "spl-token-2022",
                parsed: { type: "mint", info: { decimals: 8 } },
              },
            },
          ],
        }
      : { context: { slot: 1 }, value: 1_000_000_000 },
  ),
};

function preflightInput(localAgentId: string, quoteMint = STOCK_MINT) {
  return {
    localAgentId,
    name: "Sentinel Stock Token",
    symbol: "SST",
    description: "A tokenized-stock paired launch prepared by Navis for review only.",
    imageUrl: "https://example.com/token.png",
    quoteMint,
    creatorFeeBps: 200,
    devBuySol: 0.005,
  };
}

if (!databaseUrl) {
  console.warn(
    "[tests/clawpump-link-preflight] DATABASE_URL is not set; link and preflight persistence tests are skipped.",
  );
}

describe.skipIf(!databaseUrl)("ClawPump agent link and launch preflight", () => {
  const pool = new Pool({
    ...(databaseUrl ? buildPoolConfig(databaseUrl) : {}),
    max: 2,
  });
  const database = drizzle(pool, { schema });
  type Tx = NodePgDatabase<typeof schema>;

  afterAll(async () => {
    await pool.end();
  });

  class Rollback extends Error {}
  async function inRollback(run: (tx: Tx) => Promise<void>) {
    await database
      .transaction(async (tx) => {
        await run(tx);
        throw new Rollback("rollback");
      })
      .catch((error) => {
        if (!(error instanceof Rollback)) throw error;
      });
  }

  async function createOwnedAgent(
    tx: Tx,
    wallet = ownerWallet,
    name = "Link Test Agent",
  ) {
    const bundle = await createPersistentAgent(
      {
        slug: `cp-test-${randomUUID().slice(0, 8)}`,
        name,
        ownerWallet: wallet,
        mode: "demo",
        cluster: "devnet",
        strategy: structuredClone(demoAgentBundle.strategy.document),
        riskPolicy: structuredClone(demoAgentBundle.riskPolicy.document),
        assets: structuredClone([...demoAgentBundle.assets]),
      },
      tx,
    );
    const [user] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.wallet, wallet));
    return { agent: bundle.agent, userId: user!.id };
  }

  function linkClient(
    overrides: Partial<{
      createAgent: unknown;
      listAgents: unknown;
      getAgent: unknown;
    }> = {},
  ) {
    return {
      createAgent: vi.fn(async () => ({ ...externalAgent(), meta })),
      listAgents: vi.fn(async () => ({ agents: [externalAgent("agent_ext_2")], meta })),
      getAgent: vi.fn(async (id: string) => ({
        ...externalAgent(id),
        tokenAddress: null,
        meta,
      })),
      ...overrides,
    } as never;
  }

  it("links an owner agent by creating a ClawPump identity, then refuses a second link", async () => {
    await inRollback(async (tx) => {
      const { agent, userId } = await createOwnedAgent(tx);
      const client = linkClient();

      const link = await linkClawPumpAgent(
        agent.id,
        { mode: "create" },
        { userId, client, database: tx },
      );
      expect(link).toMatchObject({
        localAgentId: agent.id,
        externalAgentId: "agent_ext_1",
        externalWallet: EXTERNAL_WALLET,
        requestId: "req-link-1",
        tokenAddress: null,
      });

      const [row] = await tx
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, agent.id));
      expect(row).toMatchObject({
        integrationStatus: "linked",
        externalAgentId: "agent_ext_1",
        externalWallet: EXTERNAL_WALLET,
      });
      const audit = await tx
        .select()
        .from(schema.externalCalls)
        .where(
          and(
            eq(schema.externalCalls.provider, "clawpump"),
            eq(schema.externalCalls.operation, "create_agent"),
          ),
        )
        .orderBy(desc(schema.externalCalls.createdAt))
        .limit(1);
      expect(audit[0]).toMatchObject({ status: "succeeded", requestId: "req-link-1" });

      // Duplicate link for the same agent is refused before any provider call.
      const before = (client as { createAgent: ReturnType<typeof vi.fn> }).createAgent
        .mock.calls.length;
      await expect(
        linkClawPumpAgent(
          agent.id,
          { mode: "create" },
          { userId, client, database: tx },
        ),
      ).rejects.toMatchObject({ reason: "already_linked" });
      expect(
        (client as { createAgent: ReturnType<typeof vi.fn> }).createAgent.mock.calls
          .length,
      ).toBe(before);

      // The identity chain reads the stored link and refreshes it live.
      const identity = await getClawPumpIdentity(
        {
          id: row!.id,
          name: row!.name,
          slug: row!.slug,
          integrationStatus: row!.integrationStatus,
          externalAgentId: row!.externalAgentId,
          externalWallet: row!.externalWallet,
          externalRequestId: row!.externalRequestId,
        },
        client,
      );
      expect(identity.live).toMatchObject({ status: "refreshed", tokenAddress: null });
    });
  });

  it("attaches only an id the key lists, once per external id, and never a foreign or public agent", async () => {
    await inRollback(async (tx) => {
      const first = await createOwnedAgent(tx, ownerWallet, "First");
      const second = await createOwnedAgent(tx, ownerWallet, "Second");
      const foreign = await createOwnedAgent(tx, otherWallet, "Foreign");
      const client = linkClient();

      await expect(
        linkClawPumpAgent(
          first.agent.id,
          { mode: "attach", externalAgentId: "agent_not_listed" },
          { userId: first.userId, client, database: tx },
        ),
      ).rejects.toMatchObject({ reason: "external_not_owned_by_key" });

      await linkClawPumpAgent(
        first.agent.id,
        { mode: "attach", externalAgentId: "agent_ext_2" },
        { userId: first.userId, client, database: tx },
      );
      await expect(
        linkClawPumpAgent(
          second.agent.id,
          { mode: "attach", externalAgentId: "agent_ext_2" },
          { userId: second.userId, client, database: tx },
        ),
      ).rejects.toMatchObject({ reason: "external_in_use" });

      await expect(
        linkClawPumpAgent(
          foreign.agent.id,
          { mode: "create" },
          { userId: first.userId, client, database: tx },
        ),
      ).rejects.toMatchObject({ reason: "not_owned" });

      await tx
        .update(schema.agents)
        .set({ isPublicDemo: true })
        .where(eq(schema.agents.id, second.agent.id));
      await expect(
        linkClawPumpAgent(
          second.agent.id,
          { mode: "create" },
          { userId: second.userId, client, database: tx },
        ),
      ).rejects.toBeInstanceOf(ClawPumpLinkRefused);
      await expect(
        linkClawPumpAgent(
          second.agent.id,
          { mode: "create" },
          { userId: second.userId, client, database: tx },
        ),
      ).rejects.toMatchObject({ reason: "public_demo" });
    });
  });

  it("records a failed link with a sanitised error and leaves the agent linkable", async () => {
    await inRollback(async (tx) => {
      const { agent, userId } = await createOwnedAgent(tx);
      const client = linkClient({
        createAgent: vi.fn(async () => {
          throw new ClawPumpError(
            "Invalid API key cpk_leaked_value",
            "unauthorized",
            401,
            "req-401",
          );
        }),
      });
      await expect(
        linkClawPumpAgent(
          agent.id,
          { mode: "create" },
          { userId, client, database: tx },
        ),
      ).rejects.toBeInstanceOf(ClawPumpError);
      const [row] = await tx
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, agent.id));
      expect(row!.integrationStatus).toBe("failed");
      expect(row!.externalAgentId).toBeNull();
      const [audit] = await tx
        .select()
        .from(schema.externalCalls)
        .where(eq(schema.externalCalls.requestId, "req-401"));
      expect(audit).toMatchObject({ status: "failed" });
      expect(JSON.stringify(audit)).not.toContain("cpk_leaked_value");
    });
  });

  describe("launch preflight", () => {
    async function linkedAgent(tx: Tx) {
      const created = await createOwnedAgent(tx);
      await linkClawPumpAgent(
        created.agent.id,
        { mode: "create" },
        { userId: created.userId, client: linkClient(), database: tx },
      );
      return created;
    }

    function context(tx: Tx, userId: string, overrides: Record<string, unknown> = {}) {
      return {
        userId,
        wallet: ownerWallet,
        client: {
          getPumpPairs: vi.fn(async () => pairsResponse()),
          getSelfFundedLaunchCost: vi.fn(async () => costResponse()),
          preflightSelfFundedLaunch: vi.fn(async () => quoteResponse(ownerWallet)),
        },
        database: tx,
        prestocksMints: indexPreStocksMints([
          { contract_address: STOCK_MINT, symbol: "TSLAx", name: "Tesla pre-stock" },
        ]),
        mainnetRpc: verifiedMintRpc,
        mainnetRpcSource: "test mainnet rpc",
        appCluster: "mainnet-beta" as const,
        mainnetExecutionEnabled: true,
        ...overrides,
      } as never as Parameters<typeof createLaunchPreflight>[1];
    }

    it("refuses unlinked, foreign and public demo agents before any provider call", async () => {
      await inRollback(async (tx) => {
        const { agent, userId } = await createOwnedAgent(tx);
        const ctx = context(tx, userId);
        await expect(
          createLaunchPreflight(preflightInput(agent.id), ctx),
        ).rejects.toMatchObject({ status: 409 });
        await expect(
          createLaunchPreflight(preflightInput(agent.id), context(tx, randomUUID())),
        ).rejects.toBeInstanceOf(LaunchPreflightRefused);
        await tx
          .update(schema.agents)
          .set({
            isPublicDemo: true,
            integrationStatus: "linked",
            externalAgentId: "x",
            externalWallet: EXTERNAL_WALLET,
            externalRequestId: "req-x",
          })
          .where(eq(schema.agents.id, agent.id));
        await expect(
          createLaunchPreflight(preflightInput(agent.id), ctx),
        ).rejects.toMatchObject({ status: 403 });
        expect(
          (ctx.client.getPumpPairs as ReturnType<typeof vi.fn>).mock.calls.length,
        ).toBe(0);
      });
    });

    it("rejects the wrapped SOL pair locally as an unsupported quote asset", async () => {
      await inRollback(async (tx) => {
        const { agent, userId } = await linkedAgent(tx);
        const ctx = context(tx, userId);
        const result = await createLaunchPreflight(
          preflightInput(agent.id, WRAPPED_SOL_MINT),
          ctx,
        );
        expect(result).toMatchObject({
          state: "rejected",
          rejectionOrigin: "local",
          launchSubmitted: false,
          readyForAuthorisedExecution: false,
          providerValidation: { result: "not_requested" },
        });
        expect(result.rejectionReason).toContain("wrapped SOL");
        expect(ctx.client.preflightSelfFundedLaunch).not.toHaveBeenCalled();
      });
    });

    it("quotes a stock pair on the agent's cluster mismatch, listing network and funding prerequisites", async () => {
      await inRollback(async (tx) => {
        const { agent, userId } = await linkedAgent(tx);
        // The demo agent is on devnet; ClawPump is mainnet only.
        const ctx = context(tx, userId, {
          mainnetRpc: {
            request: vi.fn(async (method: string) =>
              method === "getMultipleAccounts"
                ? verifiedMintRpc.request("getMultipleAccounts")
                : { context: { slot: 1 }, value: 1_000 },
            ),
          },
        });
        const result = await createLaunchPreflight(preflightInput(agent.id), ctx);

        expect(result.state).toBe("quoted");
        expect(result.network).toBe("mainnet-beta");
        expect(result.quoteAsset).toMatchObject({
          classification: "tokenized_stock",
          tokenProgram: { program: "spl-token-2022" },
        });
        expect(result.costEstimate).toMatchObject({
          standardCostSol: 0.02,
          requestId: "req-cost",
        });
        expect(result.quote?.payment).toMatchObject({
          payFrom: ownerWallet,
          payTo: PAY_TO,
          amountLamports: 25_000_000,
        });
        expect(result.providerValidation).toMatchObject({
          result: "accepted",
          requestId: "req-quote",
        });
        const codes = result.prerequisites.map((item) => item.code);
        expect(codes).toContain("network_mismatch");
        expect(codes).toContain("insufficient_funding");
        expect(result.readyForAuthorisedExecution).toBe(false);
        expect(result.launchSubmitted).toBe(false);

        // Stored sanitised evidence: token hashed, owner bound, no raw token.
        const [row] = await tx
          .select()
          .from(schema.externalCalls)
          .where(
            and(
              eq(schema.externalCalls.operation, LAUNCH_PREFLIGHT_OPERATION),
              eq(schema.externalCalls.requestId, "req-quote"),
            ),
          )
          .orderBy(desc(schema.externalCalls.createdAt))
          .limit(1);
        expect(row).toMatchObject({ status: "quoted" });
        const metadata = row!.metadata as {
          preflightTokenSha256: string;
          ownerUserId: string;
        };
        expect(metadata.ownerUserId).toBe(userId);
        expect(metadata.preflightTokenSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(row)).not.toContain("pft_secret_token");

        const latest = await getLatestLaunchPreflightForOwner(tx, userId);
        expect(latest).toMatchObject({ outcome: "quoted" });
        expect(latest?.result.quote?.meta.requestId).toBe("req-quote");
        // Preflight is never a launch: no stored launch record exists.
        expect(await getStoredClawPumpLaunchForOwner(tx, userId)).toBeNull();
      });
    });

    it("is ready for a separate authorised step only when every prerequisite clears", async () => {
      await inRollback(async (tx) => {
        const { agent, userId } = await linkedAgent(tx);
        await tx
          .update(schema.agents)
          .set({ cluster: "mainnet-beta" })
          .where(eq(schema.agents.id, agent.id));
        const result = await createLaunchPreflight(
          preflightInput(agent.id),
          context(tx, userId),
        );
        expect(result.prerequisites).toEqual([]);
        expect(result.readyForAuthorisedExecution).toBe(true);
        expect(result.launchSubmitted).toBe(false);
        expect(result.statement).toMatch(/nothing (was |is )?launched/i);
      });
    });

    it("flags a provider payer mismatch and unverified funding when the RPC is missing", async () => {
      await inRollback(async (tx) => {
        const { agent, userId } = await linkedAgent(tx);
        const ctx = context(tx, userId, {
          mainnetRpc: null,
          mainnetRpcSource: "no mainnet rpc",
        });
        (
          ctx.client.preflightSelfFundedLaunch as ReturnType<typeof vi.fn>
        ).mockResolvedValue(quoteResponse(EXTERNAL_WALLET));
        const result = await createLaunchPreflight(preflightInput(agent.id), ctx);
        const codes = result.prerequisites.map((item) => item.code);
        expect(result.state).toBe("quoted");
        expect(codes).toEqual(
          expect.arrayContaining([
            "wallet_mismatch",
            "funding_unverified",
            "token_program_unverified",
          ]),
        );
        expect(result.readyForAuthorisedExecution).toBe(false);
      });
    });

    it("maps provider rejections (402, 403, 409, 422 wallet mismatch) to readable outcomes", async () => {
      await inRollback(async (tx) => {
        const { agent, userId } = await linkedAgent(tx);
        const cases: [ClawPumpError, Record<string, unknown>][] = [
          [
            new ClawPumpError("pay", "payment_required", 402, "req-402"),
            { httpStatus: 402, kind: "payment_required" },
          ],
          [new ClawPumpError("no", "forbidden", 403, "req-403"), { httpStatus: 403 }],
          [
            new ClawPumpError("dup", "conflict", 409, "req-409", false, {
              code: "AGENT_ALREADY_HAS_TOKEN",
            }),
            { code: "AGENT_ALREADY_HAS_TOKEN" },
          ],
          [
            new ClawPumpError("wallet", "validation", 422, "req-422", false, {
              code: "WALLET_ADDRESS_MISMATCH",
              expectedWalletAddress: EXTERNAL_WALLET,
            }),
            {
              code: "WALLET_ADDRESS_MISMATCH",
              details: { expectedWalletAddress: EXTERNAL_WALLET },
            },
          ],
        ];
        let last: Awaited<ReturnType<typeof createLaunchPreflight>> | null = null;
        for (const [error, expected] of cases) {
          const ctx = context(tx, userId);
          (
            ctx.client.preflightSelfFundedLaunch as ReturnType<typeof vi.fn>
          ).mockRejectedValue(error);
          const result = await createLaunchPreflight(preflightInput(agent.id), ctx);
          expect(result.state).toBe("rejected");
          expect(result.rejectionOrigin).toBe("provider");
          expect(result.providerValidation).toMatchObject({
            result: "rejected",
            requestId: error.requestId,
            ...expected,
          });
          expect(result.readyForAuthorisedExecution).toBe(false);
          expect(result.launchSubmitted).toBe(false);
          last = result;
        }
        // The provider's expected wallet becomes the required wallet.
        expect(last?.requiredWallet).toBe(EXTERNAL_WALLET);
        const latest = await getLatestLaunchPreflightForOwner(tx, userId);
        expect(latest?.outcome).toBe("rejected");
      });
    });
  });
});
