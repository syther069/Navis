import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databaseUrl: "configured" as string | undefined,
  shared: vi.fn(),
  database: vi.fn(() => ({})),
}));
vi.mock("../lib/env", () => ({
  env: {
    get databaseUrl() {
      return mocks.databaseUrl;
    },
    sessionSecret: "s".repeat(32),
  },
}));
vi.mock("../lib/db/client", () => ({ getDatabase: mocks.database }));
vi.mock("../lib/auth/shared-rate-limit", () => ({
  consumeSharedRateLimit: mocks.shared,
}));

describe("operation quotas", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.databaseUrl = "configured";
    mocks.shared.mockResolvedValue({ allowed: true });
  });

  it("uses shared verified-wallet/scope counters and returns uncached retry advice", async () => {
    const { requireWalletQuota } = await import("../lib/auth/operation-quota");
    mocks.shared.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const response = await requireWalletQuota({ wallet: "verified" }, "agents.create");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("retry-after")).toBe("42");
    expect(mocks.shared).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        scope: "wallet.agents.create",
        client: "verified",
        limit: 120,
        windowMs: 600_000,
      }),
    );
  });

  it("fails closed and redacts configured database failures (including connection setup)", async () => {
    const { requireWalletQuota } = await import("../lib/auth/operation-quota");
    mocks.shared.mockRejectedValue(new Error("postgres://secret SQL wallet"));
    for (let i = 0; i < 2; i++) {
      const response = await requireWalletQuota({ wallet: "verified" }, "create");
      expect(response?.status).toBe(503);
      expect(await response?.text()).not.toMatch(/postgres|secret|SQL|wallet/);
    }
    mocks.database.mockImplementationOnce(() => {
      throw new Error("secret");
    });
    expect((await requireWalletQuota({ wallet: "verified" }, "create"))?.status).toBe(
      503,
    );
  });

  it("has a bounded best-effort no-DB burst guard isolated by wallet and scope", async () => {
    mocks.databaseUrl = undefined;
    const { requireWalletQuota } = await import("../lib/auth/operation-quota");
    for (let i = 0; i < 30; i++) {
      expect(await requireWalletQuota({ wallet: "alice" }, "create")).toBeNull();
    }
    const exhausted = await requireWalletQuota({ wallet: "alice" }, "create");
    expect(exhausted?.status).toBe(429);
    expect(Number(exhausted?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await requireWalletQuota({ wallet: "bob" }, "create")).toBeNull();
    expect(await requireWalletQuota({ wallet: "alice" }, "simulate")).toBeNull();
    expect(mocks.shared).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it("uses shared client counters for public RPC status", async () => {
    const { requirePublicRpcQuota } = await import("../lib/auth/operation-quota");
    await requirePublicRpcQuota(
      new Request("https://navis.test", {
        headers: { "x-forwarded-for": "192.0.2.1, 192.0.2.2" },
      }),
      "solana.slot",
    );
    expect(mocks.shared).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        scope: "rpc.solana.slot",
        client: "192.0.2.1",
        limit: 120,
        windowMs: 60_000,
      }),
    );
  });
  it("enforces the longer no-DB window even when requests avoid the burst limit", async () => {
    mocks.databaseUrl = undefined;
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { requireWalletQuota } = await import("../lib/auth/operation-quota");
    for (let batch = 0; batch < 4; batch++) {
      for (let i = 0; i < 30; i++) {
        expect(await requireWalletQuota({ wallet: "alice" }, "create")).toBeNull();
      }
      vi.advanceTimersByTime(60_001);
    }
    const response = await requireWalletQuota({ wallet: "alice" }, "create");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("600");
    expect(mocks.shared).not.toHaveBeenCalled();
  });
});
