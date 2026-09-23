import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databaseUrl: "postgres://example" as string | undefined,
  cluster: "devnet" as "devnet" | "mainnet-beta",
  session: {
    userId: "9cab8c85-dc19-45d5-a0d4-7fc712f370ac",
    wallet: "OwnerWallet111111111111111111111111111111",
  } as { userId: string; wallet: string } | null,
  rows: [] as Record<string, unknown>[],
  selectFields: undefined as Record<string, unknown> | undefined,
  eq: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("../lib/env", async () => {
  const { parseEnvironment, toPublicCapabilities } = await import("../lib/env-core");
  const parsed = parseEnvironment({
    DATABASE_URL: "postgres://example",
    ENABLE_DEVNET_EXECUTION: "true",
    NAVIS_EXECUTION_MODE: "devnet",
    NEXT_PUBLIC_APP_URL: "https://navis.test",
    NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
    SESSION_SECRET: "s".repeat(32),
    SOLANA_RPC_URL: "https://rpc.test",
  });
  return {
    env: {
      ...parsed,
      get databaseUrl() {
        return mocks.databaseUrl;
      },
      get cluster() {
        return mocks.cluster;
      },
    },
    getPublicCapabilities: () => toPublicCapabilities(parsed),
  };
});

vi.mock("../lib/auth/server", () => ({
  SESSION_COOKIE_NAME: "navis_session",
  readSessionToken: vi.fn(async () => mocks.session),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (...args: Parameters<typeof actual.eq>) => {
      mocks.eq(...args);
      return actual.eq(...args);
    },
  };
});

vi.mock("../lib/db/client", () => ({
  getDatabase: () => ({
    select: (fields: Record<string, unknown>) => {
      mocks.selectFields = fields;
      return {
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: (count: number) => {
                  mocks.limit(count);
                  return Promise.resolve(mocks.rows);
                },
              }),
            }),
          }),
        }),
      };
    },
  }),
}));

import { GET } from "../app/api/integrations/meteora/launches/route";
import { agents, marketLaunches } from "../lib/db/schema";

function request(withCookie = true) {
  return new NextRequest("https://navis.test/api/integrations/meteora/launches", {
    headers: withCookie ? { cookie: "navis_session=test" } : undefined,
  });
}

describe("GET /api/integrations/meteora/launches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.databaseUrl = "postgres://example";
    mocks.cluster = "devnet";
    mocks.session = {
      userId: "9cab8c85-dc19-45d5-a0d4-7fc712f370ac",
      wallet: "OwnerWallet111111111111111111111111111111",
    };
    mocks.rows = [];
    mocks.selectFields = undefined;
  });

  it("requires an authenticated session", async () => {
    mocks.session = null;
    const response = await GET(request(false));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it("fails explicitly when persistent storage is unavailable", async () => {
    mocks.databaseUrl = undefined;
    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Meteora launch recovery requires a configured database.",
    });
  });

  it("scopes the latest 20 rows by provider, cluster, owner, and payout wallet", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.limit).toHaveBeenCalledWith(20);
    expect(mocks.eq).toHaveBeenCalledWith(marketLaunches.provider, "meteora");
    expect(mocks.eq).toHaveBeenCalledWith(marketLaunches.cluster, "devnet");
    expect(mocks.eq).toHaveBeenCalledWith(
      agents.ownerId,
      "9cab8c85-dc19-45d5-a0d4-7fc712f370ac",
    );
    expect(mocks.eq).toHaveBeenCalledWith(
      marketLaunches.payoutWallet,
      "OwnerWallet111111111111111111111111111111",
    );
  });

  it("returns only the recovery projection and rejects unrecognized evidence labels", async () => {
    mocks.rows = [
      {
        id: "launch-1",
        agentId: "agent-1",
        cluster: "devnet",
        status: "pool_unknown_pending",
        transactionSignature: "pool-signature",
        baseMint: "base-mint",
        poolAddress: "pool-address",
        metadata: {
          config: "config-address",
          configTransactionSignature: "config-signature",
          signedTransaction: "must-not-leak",
          secretKey: "must-not-leak",
          confirmation: { label: "made_up_verified", signature: "evidence" },
          pool: {
            intentId: "must-not-leak",
            confirmation: { label: "signature_confirmed", evidence: "private" },
          },
        },
      },
    ];

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      launches: [
        {
          id: "launch-1",
          agentId: "agent-1",
          cluster: "devnet",
          status: "pool_unknown_pending",
          phase: "pool",
          transactionSignature: "pool-signature",
          configSignature: "config-signature",
          configAddress: "config-address",
          baseMint: "base-mint",
          poolAddress: "pool-address",
          configVerification: null,
          poolVerification: "signature_confirmed",
        },
      ],
    });
    expect(Object.keys(mocks.selectFields ?? {}).sort()).toEqual(
      [
        "agentId",
        "baseMint",
        "cluster",
        "id",
        "metadata",
        "poolAddress",
        "status",
        "transactionSignature",
      ].sort(),
    );
  });
});
