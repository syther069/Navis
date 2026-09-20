import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const intentId = "58eddfb8-d139-42cd-baf8-1b69896752ce";
const mocks = vi.hoisted(() => ({
  intent: undefined as Record<string, unknown> | undefined,
  parse: vi.fn(),
  send: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
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

function returning(value: unknown) {
  return {
    where: () => ({
      returning: async () => [value],
      then: (resolve: (value: unknown) => void) => resolve(undefined),
    }),
  };
}

vi.mock("../lib/db/client", () => ({
  getDatabase: () => {
    const transaction = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => ({ for: async () => [mocks.intent] }),
          }),
        }),
      }),
      update: (...args: unknown[]) => {
        mocks.update(...args);
        return { set: (values: unknown) => returning(values) };
      },
      insert: (...args: unknown[]) => {
        mocks.insert(...args);
        return {
          values: () => ({
            returning: async () => [{ id: "launch-1", status: "broadcasting" }],
          }),
        };
      },
    };
    return {
      transaction: (callback: (value: typeof transaction) => unknown) =>
        callback(transaction),
      update: transaction.update,
    };
  },
}));

vi.mock("../lib/integrations/meteora/server", () => ({
  createServerMeteoraDbcClient: () => ({
    connection: { getBlockHeight: vi.fn().mockResolvedValue(10) },
    parseVerifiedSignedTransaction: mocks.parse,
    submitSignedConfigTransaction: mocks.send,
  }),
}));

import { POST } from "../app/api/integrations/meteora/config/submit/route";

function request() {
  return new NextRequest("https://navis.test/api/integrations/meteora/config/submit", {
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

function validIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: intentId,
    kind: "meteora.config",
    ownerWallet: "11111111111111111111111111111111",
    cluster: "devnet",
    status: "simulated",
    simulation: { error: null },
    expiresAt: new Date(Date.now() + 60_000),
    lastValidBlockHeight: 100,
    messageSha256: "a".repeat(64),
    feePayer: "11111111111111111111111111111111",
    agentId: "agent-1",
    accountsSummary: { accounts: { config: "config-1" } },
    ...overrides,
  };
}

describe("Meteora execution intents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.intent = validIntent();
    mocks.send.mockResolvedValue({ transactionSignature: "signature-1" });
  });

  it("rejects an unknown intent", async () => {
    mocks.intent = undefined;
    expect((await POST(request())).status).toBe(404);
  });

  it("rejects the wrong owner", async () => {
    mocks.intent = validIntent({ ownerWallet: "other-wallet" });
    expect((await POST(request())).status).toBe(403);
  });

  it("rejects expired and unsimulated intents", async () => {
    mocks.intent = validIntent({ expiresAt: new Date(Date.now() - 1) });
    expect((await POST(request())).status).toBe(410);

    mocks.intent = validIntent({ status: "prepared" });
    expect((await POST(request())).status).toBe(409);
  });

  it("rejects a signed transaction hash mismatch", async () => {
    mocks.parse.mockImplementationOnce(() => {
      throw new Error("hash mismatch");
    });
    expect((await POST(request())).status).toBe(400);
  });

  it("persists broadcasting state before broadcast", async () => {
    await POST(request());
    expect(mocks.insert).toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalled();
    expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.send.mock.invocationCallOrder[0],
    );
  });

  it("does not rebroadcast an intent already being processed", async () => {
    mocks.intent = validIntent({ status: "broadcasting" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
