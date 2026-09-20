import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  launch: {} as Record<string, unknown>,
  updatedValues: undefined as Record<string, unknown> | undefined,
  getSignatureStatus: vi.fn(),
  getTransactionEvidence: vi.fn(),
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

vi.mock("../lib/db/client", () => ({
  getDatabase: () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => [mocks.launch],
          }),
        }),
      }),
    }),
    update: mocks.update,
  }),
}));

vi.mock("../lib/integrations/solana/server", () => ({
  createSolanaRpcClient: () => ({
    getSignatureStatus: mocks.getSignatureStatus,
    getTransactionEvidence: mocks.getTransactionEvidence,
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
      transactionSignature: "transaction-signature",
      metadata: { kind: "meteora.submitConfig" },
    };
    mocks.updatedValues = undefined;
    mocks.update.mockImplementation(() => ({
      set: (values: Record<string, unknown>) => {
        mocks.updatedValues = values;
        return {
          where: () => ({
            returning: async () => [{ ...mocks.launch, ...values }],
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
    expect((await response.json()).confirmation).toBe("unknown_pending");
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
    expect((await response.json()).confirmation).toBe("unknown_pending");
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
    expect((await response.json()).confirmation).toBe("failed");
    expect(JSON.stringify(mocks.updatedValues)).not.toContain("InstructionError");
  });

  it("does not confirm mismatched signature and transaction slots", async () => {
    mocks.getTransactionEvidence.mockResolvedValue(evidence({ slot: 43 }));

    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(response.status).toBe(202);
    expect((await response.json()).confirmation).toBe("unknown_pending");
  });

  it("confirms only complete, consistent successful evidence", async () => {
    const response = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.confirmation).toBe("confirmed");
    expect(mocks.updatedValues).toMatchObject({
      status: "confirmed",
      metadata: {
        confirmation: {
          slot: 42,
          feeLamports: 5_000,
          confirmedAt: "2023-11-14T22:13:20.000Z",
        },
      },
    });
  });

  it("does not regress terminal or pool-phase launches", async () => {
    mocks.launch = { ...mocks.launch, status: "confirmed" };
    const terminal = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );
    expect((await terminal.json()).confirmation).toBe("confirmed");

    mocks.launch = {
      ...mocks.launch,
      status: "pool_submitted",
      metadata: { pool: { messageSha256: "hash" } },
    };
    const pool = await confirmConfig(
      request("/api/integrations/meteora/config/confirm", { launchId }),
    );

    expect(pool.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.getSignatureStatus).not.toHaveBeenCalled();
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
