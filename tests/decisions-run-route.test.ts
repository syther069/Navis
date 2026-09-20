import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databaseUrl: undefined as string | undefined,
  databaseRows: [] as unknown[],
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

import { GET } from "../app/api/decisions/[decisionId]/route";
import { POST } from "../app/api/decisions/run/route";

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

  it("does not cache a persistent request for unauthenticated or other-wallet reads", async () => {
    mocks.databaseUrl = "postgres://configured";
    const decisionId = "11111111-1111-4111-8111-111111111111";
    const attemptedRun = await post(
      { agentSlug: "persistent-agent", scenario: "balanced" },
      "valid-session",
    );
    expect(attemptedRun.status).toBe(409);
    await expect(attemptedRun.json()).resolves.toEqual({
      error:
        "Fresh decisions for persistent agents are not enabled yet; demo simulation only.",
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
