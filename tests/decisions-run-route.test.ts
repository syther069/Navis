import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databaseUrl: undefined as string | undefined,
  databaseRows: [] as unknown[],
  persistentBundle: null as unknown,
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

  it("lets an anonymous visitor run the Atlas demo even when a database is configured", async () => {
    mocks.databaseUrl = "postgres://configured";
    const response = await post({ agentSlug: "atlas", scenario: "oversized" });
    expect(response.status).toBe(200);
    const run = await response.json();
    expect(run.policyEvaluation.approved).toBe(false);
    expect(run.persisted.store).toBe("memory");
    expect(run.executionEligibility.eligible).toBe(false);

    const found = await GET(
      new Request(`http://localhost:3000/api/decisions/${run.decisionId}`),
      { params: Promise.resolve({ decisionId: run.decisionId }) },
    );
    expect(found.status).toBe(200);
  });

  it("still requires a wallet session for persistent agents", async () => {
    mocks.databaseUrl = "postgres://configured";
    const response = await post({
      agentSlug: "persistent-agent",
      scenario: "balanced",
    });
    expect(response.status).toBe(401);
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
