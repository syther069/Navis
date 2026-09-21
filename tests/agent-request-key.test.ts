import { describe, expect, it } from "vitest";

import {
  clearPendingCreation,
  mandateFingerprint,
  PENDING_CREATION_STORAGE_KEY,
  readPendingCreation,
  requestKeyFor,
  type MandateSnapshot,
} from "../components/agent/request-key";

// Minimal sessionStorage stand-in. One instance represents one browser tab
// session; a "reload" is a fresh page reading the same instance.
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
    create(body: { name: string; clientRequestId?: string }) {
      const key = body.clientRequestId;
      if (key && agents.has(key)) {
        return { status: 200, replayed: true, agent: agents.get(key)! };
      }
      counter += 1;
      const agent = {
        slug: `${body.name.toLowerCase().replace(/\s+/g, "-")}-${counter}`,
      };
      agents.set(key ?? `anonymous-${counter}`, agent);
      return { status: 201, replayed: false, agent };
    },
  };
}

describe("agent creation request key", () => {
  it("reuses the same key for the same mandate and stores it with a fingerprint", () => {
    const store = memoryStorage();
    const first = requestKeyFor(store, mandate);
    const second = requestKeyFor(store, mandate);
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(readPendingCreation(store)).toEqual({
      fingerprint: mandateFingerprint(mandate),
      key: first,
      mandate,
    });
  });

  it("issues a fresh key as soon as the mandate changes", () => {
    const store = memoryStorage();
    const first = requestKeyFor(store, mandate);
    const edited = requestKeyFor(store, { ...mandate, maxTradeBps: 900 });
    expect(edited).not.toBe(first);
    expect(readPendingCreation(store)?.key).toBe(edited);

    // Going back to the original content is a different mandate again from
    // the stored record's point of view, so it also gets a new key.
    expect(requestKeyFor(store, mandate)).not.toBe(first);
  });

  it("ignores whitespace-only differences and the ClawPump link flag", () => {
    const store = memoryStorage();
    const first = requestKeyFor(store, mandate);
    expect(
      requestKeyFor(store, {
        ...mandate,
        name: `  ${mandate.name} `,
        linkClawPump: true,
      }),
    ).toBe(first);
  });

  it("survives a reload: retrying the same mandate replays the first agent", () => {
    const api = fakeAgentsApi();
    const session = memoryStorage();

    // Page load 1: the owner reviews and submits; the response is lost.
    const key1 = requestKeyFor(session, mandate);
    const first = api.create({ name: mandate.name, clientRequestId: key1 });
    expect(first.status).toBe(201);

    // Page load 2 (reload): a fresh form reads the same sessionStorage,
    // restores the mandate, and the retry sends the same key.
    const restored = readPendingCreation(session);
    expect(restored?.mandate).toEqual(mandate);
    const key2 = requestKeyFor(session, restored!.mandate);
    expect(key2).toBe(key1);
    const retry = api.create({ name: mandate.name, clientRequestId: key2 });
    expect(retry).toEqual({ status: 200, replayed: true, agent: first.agent });
    expect(api.agents.size).toBe(1);

    // Success clears the record so the next mandate starts clean.
    clearPendingCreation(session);
    expect(readPendingCreation(session)).toBeNull();
    expect(requestKeyFor(session, mandate)).not.toBe(key1);
  });

  it("does not use a key for a different mandate after a reload", () => {
    const api = fakeAgentsApi();
    const session = memoryStorage();
    const key1 = requestKeyFor(session, mandate);
    api.create({ name: mandate.name, clientRequestId: key1 });

    const changed = {
      ...mandate,
      objective: `${mandate.objective} Prefer larger names.`,
    };
    const key2 = requestKeyFor(session, changed);
    expect(key2).not.toBe(key1);
    expect(api.create({ name: changed.name, clientRequestId: key2 }).status).toBe(201);
    expect(api.agents.size).toBe(2);
  });

  it("discards corrupt or tampered records and works without storage", () => {
    const store = memoryStorage();
    store.setItem(PENDING_CREATION_STORAGE_KEY, "{not json");
    expect(readPendingCreation(store)).toBeNull();

    store.setItem(
      PENDING_CREATION_STORAGE_KEY,
      JSON.stringify({
        fingerprint: mandateFingerprint(mandate),
        key: "reused-key-12345",
        mandate: { ...mandate, maxTradeBps: 9_999 },
      }),
    );
    expect(readPendingCreation(store)).toBeNull();
    expect(requestKeyFor(store, { ...mandate, maxTradeBps: 9_999 })).not.toBe(
      "reused-key-12345",
    );

    const a = requestKeyFor(null, mandate);
    const b = requestKeyFor(null, mandate);
    expect(a).not.toBe(b);
    expect(() => clearPendingCreation(null)).not.toThrow();
  });
});
