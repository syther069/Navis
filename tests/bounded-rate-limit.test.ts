import { afterEach, describe, expect, it, vi } from "vitest";

const request = (id: number) =>
  new Request("https://navis.test/api/auth/nonce", {
    headers: { "x-forwarded-for": `client-${id}` },
  });

describe("bounded burst limiter", () => {
  afterEach(() => vi.useRealTimers());

  it("fails closed at capacity without evicting active limits, then expires old clients", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T00:00:00Z"));
    const { allowMutationRequest } = await import("../lib/auth/rate-limit");
    for (let id = 0; id < 10_000; id++) {
      expect(allowMutationRequest(request(id), 1)).toBe(true);
    }
    expect(allowMutationRequest(request(10_000), 1)).toBe(false);
    expect(allowMutationRequest(request(0), 1)).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(allowMutationRequest(request(10_000), 1)).toBe(true);
    expect(allowMutationRequest(request(0), 1)).toBe(true);
  });

  it("does not sweep entries before their configured window expires", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { allowMutationRequest } = await import("../lib/auth/rate-limit");
    expect(allowMutationRequest(request(1), 1, 120_000)).toBe(true);
    vi.advanceTimersByTime(60_001);
    expect(allowMutationRequest(request(1), 1, 120_000)).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(allowMutationRequest(request(1), 1, 120_000)).toBe(true);
  });
});
