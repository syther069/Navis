import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    appUrl: "https://navis.test",
    databaseUrl: "configured",
    executionMode: "devnet" as "demo" | "devnet" | "mainnet",
    cluster: "devnet" as "devnet" | "mainnet-beta",
    enableDevnetExecution: true,
    enableMainnetExecution: false,
    solanaRpcUrl: "https://rpc.test",
  },
  session: null as { userId: string; wallet: string } | null,
  readSessionToken: vi.fn(),
  requireWalletQuota: vi.fn(),
  getDatabase: vi.fn(),
  createClient: vi.fn(),
  sendSignedTransaction: vi.fn(),
}));

vi.mock("../lib/env", () => ({ env: mocks.env }));
vi.mock("../lib/auth/server", () => ({
  SESSION_COOKIE_NAME: "navis_session",
  readSessionToken: mocks.readSessionToken,
}));
vi.mock("../lib/auth/operation-quota", () => ({
  requireWalletQuota: mocks.requireWalletQuota,
}));
vi.mock("../lib/db/client", () => ({
  getDatabase: mocks.getDatabase,
}));
vi.mock("../lib/integrations/meteora/server", () => ({
  createServerMeteoraDbcClient: mocks.createClient,
}));

import { POST as submitConfig } from "../app/api/integrations/meteora/config/submit/route";
import { POST as submitPool } from "../app/api/integrations/meteora/pool/submit/route";

const routes = [
  {
    name: "config submit",
    path: "/api/integrations/meteora/config/submit",
    scope: "meteora.config.submit",
    handler: submitConfig,
  },
  {
    name: "pool submit",
    path: "/api/integrations/meteora/pool/submit",
    scope: "meteora.pool.submit",
    handler: submitPool,
  },
] as const;

function request(path: string, authenticated = false) {
  return new NextRequest(`https://navis.test${path}`, {
    method: "POST",
    headers: {
      origin: "https://navis.test",
      "content-type": "application/json",
      ...(authenticated ? { cookie: "navis_session=test" } : {}),
    },
    body: JSON.stringify({}),
  });
}

function expectNoExecutionWork() {
  expect(mocks.getDatabase).not.toHaveBeenCalled();
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.sendSignedTransaction).not.toHaveBeenCalled();
}

describe("Meteora submit release barriers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.env, {
      executionMode: "devnet",
      cluster: "devnet",
      enableDevnetExecution: true,
      enableMainnetExecution: false,
      solanaRpcUrl: "https://rpc.test",
    });
    mocks.session = null;
    mocks.readSessionToken.mockImplementation(async () => mocks.session);
    mocks.requireWalletQuota.mockResolvedValue(null);
    mocks.createClient.mockReturnValue({
      sendSignedTransaction: mocks.sendSignedTransaction,
    });
  });

  it.each(routes)(
    "$name keeps approved mainnet behind the real gate before auth or execution",
    async ({ path, handler }) => {
      Object.assign(mocks.env, {
        executionMode: "mainnet",
        cluster: "mainnet-beta",
        enableDevnetExecution: false,
        enableMainnetExecution: true,
      });

      const response = await handler(request(path, true));

      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.readSessionToken).not.toHaveBeenCalled();
      expect(mocks.requireWalletQuota).not.toHaveBeenCalled();
      expectNoExecutionWork();
    },
  );

  it.each(routes)("$name blocks demo mode", async ({ path, handler }) => {
    Object.assign(mocks.env, {
      executionMode: "demo",
      cluster: "devnet",
      enableDevnetExecution: false,
    });

    expect((await handler(request(path, true))).status).toBe(503);
    expect(mocks.readSessionToken).not.toHaveBeenCalled();
    expectNoExecutionWork();
  });

  it.each(routes)(
    "$name blocks devnet mode on a mainnet cluster",
    async ({ path, handler }) => {
      mocks.env.cluster = "mainnet-beta";

      expect((await handler(request(path, true))).status).toBe(503);
      expect(mocks.readSessionToken).not.toHaveBeenCalled();
      expectNoExecutionWork();
    },
  );

  it.each(routes)(
    "$name reaches authentication when devnet release capabilities hold",
    async ({ path, handler }) => {
      const response = await handler(request(path));

      expect(response.status).toBe(401);
      expect(response.status).not.toBe(503);
      expect(mocks.requireWalletQuota).not.toHaveBeenCalled();
      expectNoExecutionWork();
    },
  );

  it.each(routes)(
    "$name returns quota denial before database or client work",
    async ({ path, scope, handler }) => {
      mocks.session = { userId: "owner", wallet: "verified-wallet" };
      mocks.requireWalletQuota.mockResolvedValueOnce(
        NextResponse.json(
          { error: "Too many requests. Try again shortly." },
          {
            status: 429,
            headers: { "Cache-Control": "no-store", "Retry-After": "17" },
          },
        ),
      );

      const response = await handler(request(path, true));

      expect(response.status).toBe(429);
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.requireWalletQuota).toHaveBeenCalledWith(mocks.session, scope);
      expectNoExecutionWork();
    },
  );
});
