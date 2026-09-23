import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shared: vi.fn(),
  session: { userId: "owner", wallet: "verified-wallet" } as {
    userId: string;
    wallet: string;
  } | null,
  downstream: vi.fn<(...args: unknown[]) => unknown>(() => {
    throw new Error("Downstream must not run");
  }),
}));
vi.mock("../lib/env", () => ({
  env: {
    databaseUrl: "configured",
    sessionSecret: "s".repeat(32),
    appUrl: "https://navis.test",
    executionMode: "devnet",
    cluster: "devnet",
    enableDevnetExecution: true,
    solanaRpcUrl: "https://rpc.test",
    clawpumpApiKey: "configured",
  },
}));
vi.mock("../lib/auth/server", () => ({
  SESSION_COOKIE_NAME: "navis_session",
  readSessionToken: async () => mocks.session,
}));
vi.mock("../lib/auth/shared-rate-limit", () => ({
  consumeSharedRateLimit: mocks.shared,
}));
vi.mock("../lib/db/client", () => ({
  getDatabase: () => ({
    select: mocks.downstream,
    insert: mocks.downstream,
    update: mocks.downstream,
  }),
}));
vi.mock("../lib/services/agents", () => ({
  createPersistentAgentIdempotent: mocks.downstream,
  prepareAgentCreation: mocks.downstream,
  getPersistentAgentForOwner: mocks.downstream,
}));
vi.mock("../lib/integrations/meteora/server", () => ({
  createServerMeteoraDbcClient: mocks.downstream,
}));
vi.mock("../lib/integrations/clawpump/server", () => ({
  createClawPumpClient: mocks.downstream,
  loadClawPumpPreflightDependencies: mocks.downstream,
}));
vi.mock("@solana/web3.js", async (original) => ({
  ...(await original<typeof import("@solana/web3.js")>()),
  Connection: mocks.downstream,
}));

const paths = [
  "agents",
  "agents/[slug]/clawpump-link",
  "integrations/clawpump/verification",
  "integrations/clawpump/launch/preflight",
  "integrations/meteora/config/prepare",
  "integrations/meteora/config/simulate",
  "integrations/meteora/pool/prepare",
  "integrations/meteora/pool/simulate",
  "integrations/meteora/config/confirm",
];

function request(path: string, method = "POST", origin = "https://navis.test") {
  return new NextRequest(`https://navis.test/api/${path}`, {
    method,
    headers: {
      origin,
      cookie: "navis_session=test",
      "x-forwarded-for": "spoofed-wallet",
    },
    ...(method === "POST"
      ? { body: JSON.stringify({ wallet: "spoofed-wallet" }) }
      : {}),
  });
}
const context = {
  params: Promise.resolve({
    slug: "owned",
    baseMint: "11111111111111111111111111111111",
  }),
};

describe("operation quota route barriers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { userId: "owner", wallet: "verified-wallet" };
    mocks.shared.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });
  });
  it.each(paths)(
    "blocks %s before downstream writes/provider calls using verified wallet",
    async (path) => {
      const { POST } = await import(/* @vite-ignore */ `../app/api/${path}/route`);
      const response = await POST(request(path), context);
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("17");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.shared).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ client: "verified-wallet" }),
      );
      expect(mocks.downstream).not.toHaveBeenCalled();
    },
  );
  it.each(paths)(
    "keeps origin and authentication ahead of quotas for %s",
    async (path) => {
      const { POST } = await import(/* @vite-ignore */ `../app/api/${path}/route`);
      expect(
        (await POST(request(path, "POST", "https://evil.test"), context)).status,
      ).toBe(403);
      mocks.session = null;
      expect((await POST(request(path), context)).status).toBe(401);
      expect(mocks.shared).not.toHaveBeenCalled();
      expect(mocks.downstream).not.toHaveBeenCalled();
    },
  );
  it.each([
    "solana/slot",
    "integrations/meteora/pools/[baseMint]",
    "integrations/clawpump/agents",
    "agents/[slug]/clawpump-link",
  ])("blocks expensive GET %s before downstream calls", async (path) => {
    const { GET } = await import(/* @vite-ignore */ `../app/api/${path}/route`);
    const response = await GET(request(path, "GET"), context);
    expect(response.status).toBe(429);
    expect(mocks.downstream).not.toHaveBeenCalled();
  });
  it("does not run provider calls when shared storage fails", async () => {
    mocks.shared.mockRejectedValue(new Error("SQL postgres://secret"));
    const { POST } =
      await import("../app/api/integrations/clawpump/verification/route");
    const response = await POST(request("integrations/clawpump/verification"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/SQL|postgres|secret/);
    expect(mocks.downstream).not.toHaveBeenCalled();
  });
  it("checks preflight ownership before loading external dependencies", async () => {
    mocks.shared.mockResolvedValue({ allowed: true });
    mocks.downstream.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });
    const { POST } =
      await import("../app/api/integrations/clawpump/launch/preflight/route");
    const response = await POST(
      new NextRequest("https://navis.test/api/integrations/clawpump/launch/preflight", {
        method: "POST",
        headers: { origin: "https://navis.test", cookie: "navis_session=test" },
        body: JSON.stringify({ localAgentId: "11111111-1111-4111-8111-111111111111" }),
      }),
    );
    expect(response.status).toBe(404);
    // Only the ownership SELECT ran, no dependency loader, provider, or write.
    expect(mocks.downstream).toHaveBeenCalledTimes(1);
  });
});
