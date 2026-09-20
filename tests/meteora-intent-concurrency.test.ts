import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const intentId = "58eddfb8-d139-42cd-baf8-1b69896752ce";
const launchId = "b8e178c7-d667-4d18-814b-d6b36cf022ad";
const mocks = vi.hoisted(() => ({
  selectedRows: [] as (Record<string, unknown> | undefined)[],
  updateResults: [] as Record<string, unknown>[][],
  updatedValues: [] as Record<string, unknown>[],
  simulate: vi.fn(),
  sendPool: vi.fn(),
}));

vi.mock("../lib/env", async () => {
  const { parseEnvironment, toPublicCapabilities } = await import("../lib/env-core");
  const env = parseEnvironment({
    DATABASE_URL: "configured-database",
    ENABLE_DEVNET_EXECUTION: "true",
    NAVIS_EXECUTION_MODE: "devnet",
    NEXT_PUBLIC_APP_URL: "https://navis.test",
    NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
    SESSION_SECRET: "s".repeat(32),
    SOLANA_RPC_URL: "https://rpc.test",
  });
  return { env, getPublicCapabilities: () => toPublicCapabilities(env) };
});

vi.mock("../lib/auth/server", () => ({
  SESSION_COOKIE_NAME: "navis_session",
  readSessionToken: vi.fn().mockResolvedValue({
    userId: "user-1",
    wallet: "11111111111111111111111111111111",
  }),
}));

vi.mock("../lib/integrations/meteora/broadcast-safety", () => ({
  isMeteoraBroadcastAvailable: () => true,
  METEORA_BROADCAST_UNAVAILABLE_REASON: "blocked",
}));

function updateBuilder(values: Record<string, unknown>) {
  mocks.updatedValues.push(values);
  const result = mocks.updateResults.shift() ?? [];
  const whereResult = {
    returning: async () => result,
    then: (resolve: (value: undefined) => void) =>
      Promise.resolve(undefined).then(resolve),
  };
  return { where: () => whereResult };
}

vi.mock("../lib/db/client", () => ({
  getDatabase: () => {
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => {
              const row = mocks.selectedRows.shift();
              return {
                for: async () => [row],
                then: (resolve: (value: unknown[]) => void) =>
                  Promise.resolve([row]).then(resolve),
              };
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => updateBuilder(values),
      }),
    };
    return {
      ...database,
      transaction: (callback: (transaction: typeof database) => unknown) =>
        callback(database),
    };
  },
}));

vi.mock("../lib/integrations/meteora/server", () => ({
  createServerMeteoraDbcClient: () => ({
    connection: { getBlockHeight: vi.fn().mockResolvedValue(10) },
    parseVerifiedSignedTransaction: vi.fn(),
    simulateSignedConfigTransaction: mocks.simulate,
    submitSignedPoolTransaction: mocks.sendPool,
  }),
}));

import { POST as simulateConfig } from "../app/api/integrations/meteora/config/simulate/route";
import { POST as submitPool } from "../app/api/integrations/meteora/pool/submit/route";

function request(path: string) {
  return new NextRequest(`https://navis.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "navis_session=test",
      origin: "https://navis.test",
    },
    body: JSON.stringify({
      intentId,
      serializedTransaction: "a".repeat(120),
    }),
  });
}

function intent(kind: "meteora.config" | "meteora.pool") {
  return {
    id: intentId,
    kind,
    launchId,
    ownerWallet: "11111111111111111111111111111111",
    cluster: "devnet",
    status: "simulated",
    simulation: { error: null },
    expiresAt: new Date(Date.now() + 60_000),
    lastValidBlockHeight: 100,
    messageSha256: "a".repeat(64),
    feePayer: "11111111111111111111111111111111",
    accountsSummary: {
      accounts: { baseMint: "base-mint", poolAddress: "pool-address" },
    },
  };
}

function launch(status = "confirmed") {
  return {
    id: launchId,
    status,
    baseMint: null,
    poolAddress: null,
    idempotencyKey: "meteora-intent:config-intent",
    transactionSignature: "config-signature",
    metadata: { config: "config-address" },
  };
}

describe("Meteora intent concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedRows = [];
    mocks.updateResults = [];
    mocks.updatedValues = [];
    mocks.simulate.mockResolvedValue({ error: null });
    mocks.sendPool.mockResolvedValue({ transactionSignature: "pool-signature" });
  });

  it("rejects simulation completion after the intent moved to broadcasting", async () => {
    const configIntent = intent("meteora.config");
    mocks.selectedRows = [configIntent];
    mocks.updateResults = [[configIntent], []];

    const response = await simulateConfig(
      request("/api/integrations/meteora/config/simulate"),
    );

    expect(response.status).toBe(409);
    expect(mocks.updatedValues.at(-1)?.status).toBe("simulated");
  });

  it("rejects a second pool intent after the launch moved", async () => {
    mocks.selectedRows = [intent("meteora.pool"), launch("pool_broadcasting")];

    const response = await submitPool(request("/api/integrations/meteora/pool/submit"));

    expect(response.status).toBe(409);
    expect(mocks.sendPool).not.toHaveBeenCalled();
  });

  it("keeps the config idempotency key during pool submission", async () => {
    const currentLaunch = launch();
    mocks.selectedRows = [intent("meteora.pool"), currentLaunch];
    mocks.updateResults = [[], [{ ...currentLaunch, status: "pool_broadcasting" }]];

    const response = await submitPool(request("/api/integrations/meteora/pool/submit"));
    const poolTransition = mocks.updatedValues.find(
      (values) => values.status === "pool_broadcasting",
    );

    expect(response.status).toBe(201);
    expect(poolTransition).toBeDefined();
    expect(poolTransition).not.toHaveProperty("idempotencyKey");
  });
});
