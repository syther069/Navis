import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databaseUrl: undefined as string | undefined,
  databaseRows: [] as unknown[],
  persistentBundle: null as unknown,
  sharedAllowed: true,
  sharedCalls: [] as unknown[],
  publicRuns: [] as unknown[],
  publicRunError: null as unknown,
}));

vi.mock("../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      get databaseUrl() {
        return mocks.databaseUrl;
      },
    },
  };
});

vi.mock("../lib/auth/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth/server")>();
  return {
    ...actual,
    readSessionToken: vi.fn(async (token: string) => {
      if (token === "valid-session") return { wallet: "owner-wallet" };
      if (token === "different-session") return { wallet: "different-wallet" };
      return null;
    }),
  };
});

// Route tests never reach the network: the default PreStocks universe falls
// back to the fixture with a note, exactly as an offline deployment would.
vi.mock("../lib/integrations/prestocks/client", () => ({
  getPreStocksCatalogue: vi.fn(async () => {
    throw new TypeError("fetch failed");
  }),
}));

vi.mock("../lib/db/client", () => ({
  getDatabase: () => {
    const query = {
      from: () => query,
      innerJoin: () => query,
      where: () => query,
      limit: async () => mocks.databaseRows,
    };
    return { select: () => query };
  },
}));

// The shared limiter and the public Atlas writer need a real database; the
// route tests stand them in and assert how the route drives them.
vi.mock("../lib/auth/shared-rate-limit", () => ({
  consumeSharedRateLimit: vi.fn(async (_db: unknown, input: unknown) => {
    mocks.sharedCalls.push(input);
    return {
      allowed: mocks.sharedAllowed,
      hits: mocks.sharedAllowed ? 1 : 99,
      limit: 12,
      retryAfterSeconds: 42,
    };
  }),
}));

vi.mock("../lib/services/run-decision", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/services/run-decision")>();
  return {
    ...actual,
    runPublicAtlasDecision: vi.fn(
      async (input: { scenario: string; clientRequestId?: string }) => {
        mocks.publicRuns.push(input);
        if (mocks.publicRunError) throw mocks.publicRunError;
        const run = await actual.runDecision({
          bundle: (await import("../fixtures/demo-agent")).demoAgentBundle,
          scenario: input.scenario as "balanced" | "oversized",
          universe: "fixture",
        });
        return {
          ...run,
          decisionId: "33333333-3333-4333-8333-333333333333",
          proofId: "44444444-4444-4444-8444-444444444444",
          persisted: {
            store: "database",
            note: actual.PUBLIC_PERSISTENCE_NOTE,
            visibility: "public",
          },
        };
      },
    ),
  };
});

vi.mock("../lib/services/agents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/services/agents")>();
  return {
    ...actual,
    getPersistentAgentForOwner: vi.fn(async (_slug: string, wallet: string) =>
      wallet === "owner-wallet" ? mocks.persistentBundle : null,
    ),
  };
});

import { GET } from "../app/api/decisions/[decisionId]/route";
import { POST } from "../app/api/decisions/run/route";
import { demoAgentBundle } from "../fixtures/demo-agent";

function post(body: unknown, session?: string) {
  return POST(
    new Request("http://localhost:3000/api/decisions/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        ...(session ? { cookie: `navis_session=${session}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("decision run routes", () => {
  beforeEach(() => {
    mocks.databaseUrl = undefined;
    mocks.databaseRows = [];
    mocks.sharedAllowed = true;
    mocks.sharedCalls = [];
    mocks.publicRuns = [];
    mocks.publicRunError = null;
  });

  it("returns a fresh, distinct decision for a replayed identical request", async () => {
    const body = { agentSlug: "atlas", scenario: "balanced" };
    const first = await (await post(body)).json();
    const second = await (await post(body)).json();
    expect(first.decisionId).not.toBe(second.decisionId);
    expect(first.receiptHash).not.toBe(second.receiptHash);
    expect(first.receipt.decision.hash).not.toBe(second.receipt.decision.hash);
    // Neither run ever claims execution; a replay cannot mint one either.
    expect(first.receipt.execution.state).toBe("simulated");
    expect(second.receipt.execution.transactionSignature).toBeNull();
    // PreStocks is the default universe; offline it falls back visibly.
    expect(first.universe).toMatchObject({ requested: "prestocks", used: "fixture" });
    expect(first.universe.note).toContain("could not be reached");
  });

  it("runs the fixture universe when asked and never notes a fallback", async () => {
    const run = await (
      await post({ agentSlug: "atlas", scenario: "balanced", universe: "fixture" })
    ).json();
    expect(run.universe).toEqual({
      requested: "fixture",
      used: "fixture",
      note: null,
      prestocks: null,
    });
  });

  it("rejects an unknown universe", async () => {
    const response = await post({
      agentSlug: "atlas",
      scenario: "balanced",
      universe: "pyth",
    });
    expect(response.status).toBe(400);
  });

  it("hides a persisted agent from a session that does not own it", async () => {
    mocks.databaseUrl = "postgres://configured";
    mocks.persistentBundle = {
      ...demoAgentBundle,
      agent: {
        ...demoAgentBundle.agent,
        id: "22222222-2222-4222-8222-222222222222",
        slug: "persistent-agent",
      },
    };
    const intruder = await post(
      { agentSlug: "persistent-agent", scenario: "balanced" },
      "different-session",
    );
    expect(intruder.status).toBe(404);
    await expect(intruder.json()).resolves.toEqual({ error: "Agent not found." });
  });

  it("rejects an invalid body", async () => {
    const response = await post({ agentSlug: "atlas", scenario: "unknown" });
    expect(response.status).toBe(400);
  });

  it("creates and retrieves a fresh demo run", async () => {
    const response = await post({ agentSlug: "atlas", scenario: "balanced" });
    expect(response.status).toBe(200);
    const run = await response.json();
    expect(run.policyEvaluation.approved).toBe(true);
    expect(run.persisted.store).toBe("memory");

    const found = await GET(
      new Request(`http://localhost:3000/api/decisions/${run.decisionId}`),
      { params: Promise.resolve({ decisionId: run.decisionId }) },
    );
    expect(found.status).toBe(200);

    const missing = await GET(
      new Request("http://localhost:3000/api/decisions/missing"),
      { params: Promise.resolve({ decisionId: "missing" }) },
    );
    expect(missing.status).toBe(404);
  });

  it("stores an anonymous Atlas run as a public record when a database is configured", async () => {
    mocks.databaseUrl = "postgres://configured";
    const response = await post({
      agentSlug: "atlas",
      scenario: "oversized",
      requestKey: "browser-key-0001",
    });
    expect(response.status).toBe(200);
    const run = await response.json();
    expect(run.policyEvaluation.approved).toBe(false);
    expect(run.persisted).toMatchObject({ store: "database", visibility: "public" });
    expect(run.proofId).toBe("44444444-4444-4444-8444-444444444444");
    expect(run.executionEligibility.eligible).toBe(false);
    // The public writer got the browser key and never a wallet or session.
    expect(mocks.publicRuns).toEqual([
      expect.objectContaining({
        scenario: "oversized",
        clientRequestId: "browser-key-0001",
      }),
    ]);
    expect(JSON.stringify(mocks.publicRuns[0])).not.toMatch(/wallet|session/i);
    // The shared limiter ran with a hashed-client scope for the public route.
    expect(mocks.sharedCalls).toEqual([
      expect.objectContaining({ scope: "decisions.run.public", limit: 12 }),
    ]);
  });

  it("answers 429 with Retry-After when the shared limit is exhausted", async () => {
    mocks.databaseUrl = "postgres://configured";
    mocks.sharedAllowed = false;
    const response = await post({ agentSlug: "atlas", scenario: "balanced" });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(mocks.publicRuns).toEqual([]);
  });

  it("rejects malformed request keys, unknown fields and oversized bodies", async () => {
    mocks.databaseUrl = "postgres://configured";
    const badKey = await post({
      agentSlug: "atlas",
      scenario: "balanced",
      requestKey: "short",
    });
    expect(badKey.status).toBe(400);
    const extra = await post({
      agentSlug: "atlas",
      scenario: "balanced",
      ownerWallet: "x",
    });
    expect(extra.status).toBe(400);
    const huge = await post({
      agentSlug: "atlas",
      scenario: "balanced",
      requestKey: "a".repeat(100),
      padding: "x".repeat(4_000),
    });
    expect(huge.status).toBe(413);
    expect(mocks.publicRuns).toEqual([]);
  });

  it("reports an explicit not-stored error without leaking database detail", async () => {
    mocks.databaseUrl = "postgres://configured";
    const { DecisionNotStoredError } = await import("../lib/services/run-decision");
    const driverError = Object.assign(
      new Error("connect ECONNREFUSED db.internal:5432"),
      {
        code: "ECONNREFUSED",
      },
    );
    mocks.publicRunError = new DecisionNotStoredError({ cause: driverError });
    const response = await post({ agentSlug: "atlas", scenario: "balanced" });
    expect(response.status).toBeGreaterThanOrEqual(500);
    const body = await response.json();
    expect(body.stored).toBe(false);
    expect(body.error).toContain("Nothing was saved");
    expect(JSON.stringify(body)).not.toMatch(/db\.internal|ECONNREFUSED|5432/);
  });

  it("still requires a wallet session for persistent agents", async () => {
    mocks.databaseUrl = "postgres://configured";
    const response = await post({
      agentSlug: "persistent-agent",
      scenario: "balanced",
    });
    expect(response.status).toBe(401);
  });

  it("stops owner runs at the wallet quota before owner reads or decision writes", async () => {
    mocks.databaseUrl = "postgres://configured";
    mocks.sharedAllowed = false;
    const { getPersistentAgentForOwner } = await import("../lib/services/agents");
    vi.mocked(getPersistentAgentForOwner).mockClear();
    const response = await post(
      { agentSlug: "persistent-agent", scenario: "balanced" },
      "valid-session",
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("42");
    expect(mocks.sharedCalls).toEqual([
      expect.objectContaining({
        scope: "wallet.decisions.run",
        client: "owner-wallet",
      }),
    ]);
    expect(getPersistentAgentForOwner).not.toHaveBeenCalled();
    expect(mocks.publicRuns).toEqual([]);
  });

  it("does not cache a persistent request for unauthenticated or other-wallet reads", async () => {
    mocks.databaseUrl = "postgres://configured";
    const decisionId = "11111111-1111-4111-8111-111111111111";
    mocks.persistentBundle = null;
    const unknownAgent = await post(
      { agentSlug: "persistent-agent", scenario: "balanced" },
      "valid-session",
    );
    expect(unknownAgent.status).toBe(404);

    // Devnet and mainnet agents still refuse fresh runs with a clear 409.
    mocks.persistentBundle = {
      ...demoAgentBundle,
      agent: {
        ...demoAgentBundle.agent,
        id: "22222222-2222-4222-8222-222222222222",
        slug: "persistent-agent",
        mode: "devnet",
        cluster: "devnet",
      },
    };
    const attemptedRun = await post(
      { agentSlug: "persistent-agent", scenario: "balanced" },
      "valid-session",
    );
    expect(attemptedRun.status).toBe(409);
    await expect(attemptedRun.json()).resolves.toEqual({
      error: expect.stringContaining("only available for demo-mode agents"),
    });

    const unauthenticated = await GET(
      new Request(`http://localhost:3000/api/decisions/${decisionId}`),
      { params: Promise.resolve({ decisionId }) },
    );
    expect(unauthenticated.status).toBe(401);

    const differentWallet = await GET(
      new Request(`http://localhost:3000/api/decisions/${decisionId}`, {
        headers: { cookie: "navis_session=different-session" },
      }),
      { params: Promise.resolve({ decisionId }) },
    );
    expect(differentWallet.status).toBe(404);
  });
});
