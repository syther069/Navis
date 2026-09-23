import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSlot: vi.fn(),
  rpcUrl: "https://rpc.example.test/private-key-in-path",
}));

vi.mock("@solana/web3.js", () => ({
  Connection: class {
    getSlot = mocks.getSlot;
  },
}));
vi.mock("../lib/env", async () => {
  const { parseEnvironment, toPublicCapabilities } = await import("../lib/env-core");
  const env = parseEnvironment({
    NEXT_PUBLIC_APP_URL: "https://navis.test",
    SOLANA_RPC_URL: mocks.rpcUrl,
  });
  return { env, getPublicCapabilities: () => toPublicCapabilities(env) };
});

import { GET } from "../app/api/solana/slot/route";

describe("read-only devnet slot probe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the current slot without caching", async () => {
    mocks.getSlot.mockResolvedValue(412_345_678);
    const response = await GET(new Request("https://navis.test/api/solana/slot"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.cluster).toBe("devnet");
    expect(body.slot).toBe(412_345_678);
  });

  it("reports unreachable without leaking the RPC endpoint", async () => {
    mocks.getSlot.mockRejectedValue(new Error(`fetch failed for ${mocks.rpcUrl}`));
    const response = await GET(new Request("https://navis.test/api/solana/slot"));
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain("unreachable");
    expect(text).not.toContain("rpc.example.test");
    expect(text).not.toContain("private-key-in-path");
  });
});
