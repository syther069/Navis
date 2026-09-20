import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  launch: {} as Record<string, unknown>,
  updatedValues: undefined as Record<string, unknown> | undefined,
  getSignatureStatus: vi.fn(),
  getTransactionEvidence: vi.fn(),
  readConfigAccount: vi.fn(),
  update: vi.fn(),
}));

const QUOTE = "So11111111111111111111111111111111111111112";
const CONFIG = "Config11111111111111111111111111111111111111";

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

vi.mock("../lib/db/client", () => ({
  getDatabase: () => {
    const rows = () => (Object.keys(mocks.launch).length > 0 ? [mocks.launch] : []);
    const database = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({ limit: async () => rows() }),
          }),
          where: () => ({ limit: async () => rows() }),
        }),
      }),
      update: mocks.update,
      transaction: (callback: (transaction: unknown) => unknown) => callback(database),
    };
    return database;
  },
}));

vi.mock("../lib/integrations/solana/server", () => ({
  createSolanaRpcClient: () => ({
    getSignatureStatus: mocks.getSignatureStatus,
    getTransactionEvidence: mocks.getTransactionEvidence,
  }),
}));

vi.mock("../lib/integrations/meteora/server", () => ({
  createServerMeteoraDbcClient: () => ({
    readConfigAccount: mocks.readConfigAccount,
    readPoolAccount: vi.fn().mockResolvedValue(null),
  }),
}));

import { POST as confirmConfig } from "../app/api/integrations/meteora/config/confirm/route";
import { POST as submitConfig } from "../app/api/integrations/meteora/config/submit/route";
import { POST as submitPool } from "../app/api/integrations/meteora/pool/submit/route";
import { METEORA_BROADCAST_UNAVAILABLE_REASON } from "../lib/integrations/meteora/broadcast-safety";

const launchId = "58eddfb8-d139-42cd-baf8-1b69896752ce";

function request(path: string, body: unknown) {
  return new NextRequest(`https://navis.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "navis_session=test",
      origin: "https://navis.test",
    },
    body: JSON.stringify(body),
  });
}

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    slot: 42,
    blockTime: 1_700_000_000,
    meta: {
      err: null,
      fee: 5_000,
      preBalances: [10_000],
      postBalances: [5_000],
    },
    ...overrides,
  };
}

describe("Meteora route safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.launch = {
      id: launchId,
      status: "submitted",
      cluster: "devnet",
      provider: "meteora",
      transactionSignature: "transaction-signature",
      quoteMint: QUOTE,
      metadata: { kind: "meteora.submitConfig", config: CONFIG, intentId: null },
    };
    mocks.readConfigAccount.mockResolvedValue({ quoteMint: QUOTE });
    mocks.updatedValues = undefined;
    mocks.update.mockImplementation(() => ({
      set: (values: Record<string, unknown>) => {
        mocks.updatedValues = values;
        return {
          where: () => ({
            returning: async () => [{ ...mocks.launch, ...values }],
            then: (resolve: (value: unknown) => void) => resolve(undefined),
          }),
        };
      },
    }));
    mocks.getSignatureStatus.mockResolvedValue({
      contextSlot: BigInt(50),
      status: {
        slot: 42,
        confirmations: 1,
        err: null,
        confirmationStatus: "confirmed",
      },
    });
    mocks.getTransactionEvidence.mockResolvedValue(evidence());
  });

  it.each([
    ["/api/integrations/meteora/config/submit", submitConfig],
    ["/api/integrations/meteora/pool/submit", submitPool],
  ])("hard-blocks configured broadcast at %s", async (path, handler) => {
    const response = await handler(request(path, {}));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: METEORA_BROADCAST_UNAVAILABLE_REASON,
    });
  });

  it("keeps a missing signature unknown-pending", async () => {
    mocks.getSignatureStatus.mockResolvedValue({
      contextSlot: BigInt(50),
      status: null,
    });

    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(response.status).toBe(202);
    expect((await response.json()).confirmation).toBe("signature_not_found");
    expect(mocks.updatedValues?.status).toBe("unknown_pending");
  });

  it.each([
    ["null transaction", null],
    ["null metadata", evidence({ meta: null })],
    ["missing block time", evidence({ blockTime: null })],
  ])("keeps %s evidence unknown-pending", async (_label, transaction) => {
    mocks.getTransactionEvidence.mockResolvedValue(transaction);

    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(response.status).toBe(202);
    expect(mocks.updatedValues?.status).toBe("unknown_pending");
  });

  it("marks trustworthy transaction metadata errors failed", async () => {
    mocks.getTransactionEvidence.mockResolvedValue(
      evidence({
        meta: { ...evidence().meta, err: { InstructionError: [0, "Custom"] } },
      }),
    );

    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).confirmation).toBe("confirmed_transaction_error");
    expect(mocks.updatedValues?.status).toBe("failed");
    expect(JSON.stringify(mocks.updatedValues)).not.toContain("InstructionError");
  });

  it("does not confirm mismatched signature and transaction slots", async () => {
    mocks.getTransactionEvidence.mockResolvedValue(evidence({ slot: 43 }));

    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(response.status).toBe(202);
    expect((await response.json()).confirmation).toBe("inconsistent_chain_evidence");
    expect(mocks.updatedValues?.status).toBe("unknown_pending");
  });

  it("confirms only complete, consistent successful evidence with a verified account", async () => {
    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.confirmation).toBe("protocol_verified");
    expect(mocks.updatedValues).toMatchObject({
      status: "confirmed",
      metadata: {
        confirmation: {
          label: "protocol_verified",
          signature: {
            slot: 42,
            feeLamports: 5_000,
            confirmedAt: "2023-11-14T22:13:20.000Z",
          },
          protocol: { address: CONFIG, reason: "account_verified" },
        },
      },
    });
  });

  it("stops at signature_confirmed when the config account is not readable yet", async () => {
    mocks.readConfigAccount.mockResolvedValue(null);

    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).confirmation).toBe("signature_confirmed");
    expect(mocks.updatedValues?.status).toBe("signature_confirmed");
  });

  it("reports evidence_incomplete when the onchain config disagrees with the launch", async () => {
    mocks.readConfigAccount.mockResolvedValue({ quoteMint: CONFIG });

    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).confirmation).toBe("evidence_incomplete");
    expect(mocks.updatedValues?.status).toBe("signature_confirmed");
  });

  it("does not regress terminal launches or reconcile unsubmitted ones", async () => {
    mocks.launch = {
      ...mocks.launch,
      status: "confirmed",
      metadata: { confirmation: { state: "confirmed" } },
    };
    const terminal = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );
    expect(terminal.status).toBe(200);
    expect((await terminal.json()).confirmation).toBe("confirmed");

    mocks.launch = { ...mocks.launch, status: "prepared" };
    const prepared = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(prepared.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.getSignatureStatus).not.toHaveBeenCalled();
  });

  it("reconciles the pool phase against the pool signature", async () => {
    mocks.launch = {
      ...mocks.launch,
      status: "pool_submitted",
      baseMint: "Base111111111111111111111111111111111111111",
      poolAddress: "Poo1111111111111111111111111111111111111111",
      metadata: {
        ...(mocks.launch.metadata as Record<string, unknown>),
        pool: { intentId: null, transactionSignature: "pool-signature" },
      },
    };
    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getSignatureStatus).toHaveBeenCalledWith("pool-signature");
    expect((await response.json()).confirmation).toBe("signature_confirmed");
    expect(mocks.updatedValues?.status).toBe("pool_signature_confirmed");
  });

  it("sanitizes RPC provider failures", async () => {
    mocks.getSignatureStatus.mockRejectedValue(
      new Error("private upstream endpoint and provider details"),
    );

    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(body).toContain("temporarily unavailable");
    expect(body).not.toContain("private upstream");
  });
});
