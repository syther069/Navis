import bs58 from "bs58";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const intentId = "58eddfb8-d139-42cd-baf8-1b69896752ce";
const mocks = vi.hoisted(() => ({
  intent: undefined as Record<string, unknown> | undefined,
  parse: vi.fn(),
  send: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  inserted: undefined as Record<string, unknown> | undefined,
  updated: [] as Record<string, unknown>[],
  existingLaunch: { id: "launch-existing", status: "submitted" } as Record<
    string,
    unknown
  >,
}));

const signatureBytes = Buffer.alloc(64, 9);
const recordedSignature = bs58.encode(signatureBytes);

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

function returning(value: Record<string, unknown>) {
  mocks.updated.push(value);
  return {
    where: () => ({
      returning: async () => [{ id: "launch-1", ...value }],
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
            limit: () => ({
              for: async () => [mocks.intent],
              then: (resolve: (value: unknown) => void) =>
                resolve([mocks.existingLaunch]),
            }),
          }),
        }),
      }),
      update: (...args: unknown[]) => {
        mocks.update(...args);
        return { set: (values: Record<string, unknown>) => returning(values) };
      },
      insert: (...args: unknown[]) => {
        mocks.insert(...args);
        return {
          values: (values: Record<string, unknown>) => {
            mocks.inserted = values;
            return {
              returning: async () => [{ id: "launch-1", ...values }],
            };
          },
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
    accountsSummary: {
      accounts: {
        config: "config-1",
        quoteMint: "So11111111111111111111111111111111111111112",
      },
      quote: { profileId: "navis-equity-v1", source: "wrapped_sol", symbol: "SOL" },
    },
    ...overrides,
  };
}

describe("Meteora execution intents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.intent = validIntent();
    mocks.inserted = undefined;
    mocks.updated = [];
    mocks.parse.mockReturnValue({ transaction: { signature: signatureBytes } });
    mocks.send.mockResolvedValue({ transactionSignature: recordedSignature });
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

  it("records the derived signature on intent and launch before broadcast", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.insert).toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalled();
    expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.send.mock.invocationCallOrder[0],
    );
    expect(mocks.inserted).toMatchObject({
      status: "submitting",
      transactionSignature: recordedSignature,
    });
    expect(mocks.updated[0]).toMatchObject({
      status: "submitting",
      transactionSignature: recordedSignature,
    });
    expect(mocks.updated.at(-1)).toMatchObject({ status: "submitted" });
  });

  it("leaves the record unknown_pending when the send fails after recording", async () => {
    mocks.send.mockRejectedValueOnce(new Error("socket hang up"));
    const response = await POST(request());
    expect(response.status).toBe(202);
    const statuses = mocks.updated.map((values) => values.status);
    expect(statuses).toContain("unknown_pending");
    expect(statuses).not.toContain("failed");
    expect(statuses).not.toContain("broadcast_failed");
    // The signature written before the send is never cleared by the failure path.
    const failureUpdates = mocks.updated.filter(
      (values) => values.status === "unknown_pending",
    );
    expect(failureUpdates.every((values) => !("transactionSignature" in values))).toBe(
      true,
    );
    expect(mocks.inserted?.transactionSignature).toBe(recordedSignature);
  });

  it("fails the record only when the RPC rejected it before broadcast", async () => {
    mocks.send.mockRejectedValueOnce(
      new Error("Transaction simulation failed: Blockhash not found"),
    );
    const response = await POST(request());
    expect(response.status).toBe(502);
    const statuses = mocks.updated.map((values) => values.status);
    expect(statuses).toContain("broadcast_failed");
    expect(statuses).toContain("failed");
  });

  it("refuses to trust an RPC signature that differs from the recorded one", async () => {
    mocks.send.mockResolvedValueOnce({ transactionSignature: "different" });
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(mocks.updated.map((values) => values.status)).toContain("unknown_pending");
  });

  it("refuses to broadcast an intent without an approved quote profile", async () => {
    mocks.intent = validIntent({
      accountsSummary: { accounts: { config: "config-1" } },
    });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not rebroadcast an intent already being processed", async () => {
    mocks.intent = validIntent({ status: "broadcasting" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["submitting", "submitted", "unknown_pending", "consumed"])(
    "returns the existing launch for a %s intent instead of sending again",
    async (status) => {
      mocks.intent = validIntent({ status });
      const response = await POST(request());
      expect(response.status).toBe(200);
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.insert).not.toHaveBeenCalled();
      const body = (await response.json()) as { launch: Record<string, unknown> };
      expect(body.launch.id).toBe("launch-existing");
    },
  );

  it("rejects a blockhash-expired intent without recording a signature", async () => {
    mocks.intent = validIntent({ lastValidBlockHeight: 5 });
    expect((await POST(request())).status).toBe(410);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
