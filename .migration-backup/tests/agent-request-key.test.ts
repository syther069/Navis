import { describe, expect, it } from "vitest";

import {
  browserStorage,
  clearPendingCreation,
  mandateFingerprint,
  PENDING_CREATION_STORAGE_KEY,
  readPendingCreation,
  requestKeyFor,
  type MandateSnapshot,
} from "../components/agent/request-key";

// Minimal localStorage stand-in. One instance represents one browser profile
// on one origin; a reload, a closed and reopened tab, or a restarted browser
// is a fresh page reading the same instance.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const wallet = "WaLLetAAAA1111111111111111111111111111111111";
const otherWallet = "WaLLetBBBB2222222222222222222222222222222222";

const mandate: MandateSnapshot = {
  name: "Ledger Sentinel",
  objective:
    "Rotate the demo book toward relative strength while keeping a cash buffer.",
  maxTradeBps: 1_000,
  maxPositionBps: 3_500,
  minReserveBps: 2_000,
  maxSlippageBps: 75,
  linkClawPump: false,
};

// A stand-in for POST /api/agents that honours clientRequestId the way the
// route does: first key wins, the same key replays the first agent.
function fakeAgentsApi() {
  const agents = new Map<string, { slug: string }>();
  let counter = 0;
  return {
    agents,
    create(owner: string, body: { name: string; clientRequestId?: string }) {
      // Idempotency is owner-scoped, as in app/api/agents/route.ts.
      const scoped = body.clientRequestId ? `${owner}:${body.clientRequestId}` : null;
      if (scoped && agents.has(scoped)) {
        return { status: 200, replayed: true, agent: agents.get(scoped)! };
      }
      counter += 1;
      const agent = {
        slug: `${body.name.toLowerCase().replace(/\s+/g, "-")}-${counter}`,
      };
      agents.set(scoped ?? `${owner}:anonymous-${counter}`, agent);
      return { status: 201, replayed: false, agent };
    },
  };
}

describe("agent creation request key", () => {
  it("reuses the same key for the same mandate and stores it with a fingerprint", () => {
    const store = memoryStorage();
    const first = requestKeyFor(store, wallet, mandate);
    const second = requestKeyFor(store, wallet, mandate);
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(readPendingCreation(store, wallet)).toEqual({
      fingerprint: mandateFingerprint(wallet, mandate),
      key: first,
      wallet,
      mandate,
    });
  });

  it("issues a fresh key as soon as the mandate changes", () => {
    const store = memoryStorage();
    const first = requestKeyFor(store, wallet, mandate);
    const edited = requestKeyFor(store, wallet, { ...mandate, maxTradeBps: 900 });
    expect(edited).not.toBe(first);
    expect(readPendingCreation(store, wallet)?.key).toBe(edited);

    // Going back to the original content is a different mandate again from
    // the stored record's point of view, so it also gets a new key.
    expect(requestKeyFor(store, wallet, mandate)).not.toBe(first);
  });

  it("ignores whitespace-only differences and the ClawPump link flag", () => {
    const store = memoryStorage();
    const first = requestKeyFor(store, wallet, mandate);
    expect(
      requestKeyFor(store, wallet, {
        ...mandate,
        name: `  ${mandate.name} `,
        linkClawPump: true,
      }),
    ).toBe(first);
  });

  it("survives a reload or a closed browser: retrying the same mandate replays the first agent", () => {
    const api = fakeAgentsApi();
    const session = memoryStorage();

    // Page load 1: the owner reviews and submits; the response is lost.
    const key1 = requestKeyFor(session, wallet, mandate);
    const first = api.create(wallet, { name: mandate.name, clientRequestId: key1 });
    expect(first.status).toBe(201);

    // Page load 2 (reload, or the browser was closed and reopened): a fresh
    // form reads the same localStorage, restores the mandate, and the retry
    // sends the same key.
    const restored = readPendingCreation(session, wallet);
    expect(restored?.mandate).toEqual(mandate);
    const key2 = requestKeyFor(session, wallet, restored!.mandate);
    expect(key2).toBe(key1);
    const retry = api.create(wallet, { name: mandate.name, clientRequestId: key2 });
    expect(retry).toEqual({ status: 200, replayed: true, agent: first.agent });
    expect(api.agents.size).toBe(1);

    // Success clears the record so the next mandate starts clean.
    clearPendingCreation(session);
    expect(readPendingCreation(session, wallet)).toBeNull();
    expect(requestKeyFor(session, wallet, mandate)).not.toBe(key1);
  });

  it("does not use a key for a different mandate after a reload", () => {
    const api = fakeAgentsApi();
    const session = memoryStorage();
    const key1 = requestKeyFor(session, wallet, mandate);
    api.create(wallet, { name: mandate.name, clientRequestId: key1 });

    const changed = {
      ...mandate,
      objective: `${mandate.objective} Prefer larger names.`,
    };
    const key2 = requestKeyFor(session, wallet, changed);
    expect(key2).not.toBe(key1);
    expect(
      api.create(wallet, { name: changed.name, clientRequestId: key2 }).status,
    ).toBe(201);
    expect(api.agents.size).toBe(2);
  });

  it("discards corrupt or tampered records and works without storage", () => {
    const store = memoryStorage();
    store.setItem(PENDING_CREATION_STORAGE_KEY, "{not json");
    expect(readPendingCreation(store, wallet)).toBeNull();

    store.setItem(
      PENDING_CREATION_STORAGE_KEY,
      JSON.stringify({
        fingerprint: mandateFingerprint(wallet, mandate),
        key: "reused-key-12345",
        wallet,
        mandate: { ...mandate, maxTradeBps: 9_999 },
      }),
    );
    expect(readPendingCreation(store, wallet)).toBeNull();
    expect(requestKeyFor(store, wallet, { ...mandate, maxTradeBps: 9_999 })).not.toBe(
      "reused-key-12345",
    );

    expect(() => clearPendingCreation(null)).not.toThrow();
  });

  it("never hands one wallet's pending mandate or key to another wallet", () => {
    const api = fakeAgentsApi();
    const session = memoryStorage();
    const keyA = requestKeyFor(session, wallet, mandate);
    api.create(wallet, { name: mandate.name, clientRequestId: keyA });

    // Same tab, different signed-in wallet: nothing to restore, new key.
    expect(readPendingCreation(session, otherWallet)).toBeNull();
    const keyB = requestKeyFor(session, otherWallet, mandate);
    expect(keyB).not.toBe(keyA);
    expect(
      api.create(otherWallet, { name: mandate.name, clientRequestId: keyB }).status,
    ).toBe(201);

    // Wallet A's record is gone now; that is the safe direction.
    expect(readPendingCreation(session, wallet)).toBeNull();
  });

  it("keeps one key per page load even when localStorage is unusable", () => {
    // No window in this test environment, so the browser store falls back to
    // module memory: retries on the same page still share a key.
    const store = browserStorage();
    clearPendingCreation(store);
    const first = requestKeyFor(store, wallet, mandate);
    expect(requestKeyFor(store, wallet, mandate)).toBe(first);
    expect(readPendingCreation(store, wallet)?.key).toBe(first);
    clearPendingCreation(store);
    expect(readPendingCreation(store, wallet)).toBeNull();
  });
});
