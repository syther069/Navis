import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databaseUrl: "postgres://example" as string | undefined,
  session: { wallet: "FxNavisTest1111111111111111111111111111111" } as {
    wallet: string;
  } | null,
  create: vi.fn(),
  list: vi.fn(),
  prepare: vi.fn(),
}));

vi.mock("../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      appUrl: "http://localhost:3000",
      executionMode: "demo",
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
    readSessionToken: vi.fn(async () => mocks.session),
  };
});

vi.mock("../lib/db/client", () => ({ getDatabase: () => ({}) }));

vi.mock("../lib/services/agents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/services/agents")>();
  return {
    ...actual,
    createPersistentAgentIdempotent: mocks.create,
    listPersistentAgentsForOwner: mocks.list,
    prepareAgentCreation: (candidate: unknown) => {
      mocks.prepare(candidate);
      return actual.prepareAgentCreation(candidate as never);
    },
  };
});

import { DatabaseError } from "../lib/db/errors";
import { GET, POST } from "../app/api/agents/route";

const validBody = {
  name: "Ledger Sentinel",
  objective: "Hold a balanced demo book of four labelled equities.",
  maxTradeBps: 1_000,
  maxPositionBps: 3_500,
  minReserveBps: 2_000,
  maxSlippageBps: 75,
  clientRequestId: "11111111-2222-4333-8444-555555555555",
};

function post(body: unknown, cookie = "navis_session=token") {
  return POST(
    new NextRequest("http://localhost:3000/api/agents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie,
      },
      body: JSON.stringify(body),
    }),
  );
}

const bundle = {
  agent: {
    id: "agent-1",
    slug: "ledger-sentinel-abc12345",
    name: "Ledger",
    status: "draft",
  },
  strategy: { hash: "s".repeat(64) },
  riskPolicy: { hash: "r".repeat(64) },
};

describe("POST /api/agents", () => {
  beforeEach(() => {
    mocks.databaseUrl = "postgres://example";
    mocks.session = { wallet: "FxNavisTest1111111111111111111111111111111" };
    mocks.create.mockReset();
    mocks.list.mockReset();
    mocks.prepare.mockReset();
  });

  it("creates once and answers a replay with the same agent", async () => {
    mocks.create
      .mockResolvedValueOnce({ bundle, replayed: false })
      .mockResolvedValueOnce({ bundle, replayed: true });

    const first = await post(validBody);
    const second = await post(validBody);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const [a, b] = await Promise.all([first.json(), second.json()]);
    expect(a.agent.id).toBe("agent-1");
    expect(b.agent.id).toBe("agent-1");
    expect(a.replayed).toBe(false);
    expect(b.replayed).toBe(true);
    expect(mocks.create.mock.calls[0]?.[0].clientRequestId).toBe(
      validBody.clientRequestId,
    );
  });

  it("returns a typed storage failure without connection details", async () => {
    const pgError = Object.assign(
      new Error("connect ECONNREFUSED db.internal:5432 password=hunter2"),
      { code: "ECONNREFUSED" },
    );
    mocks.create.mockRejectedValueOnce(pgError);

    const response = await post(validBody);
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toEqual({
      error: "Persistent storage is unavailable right now.",
      code: "database_unreachable",
      retryable: true,
    });
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("db.internal");
  });

  it("maps a statement timeout to 504", async () => {
    mocks.create.mockRejectedValueOnce(
      Object.assign(new Error("canceling statement"), { code: "57014" }),
    );
    const response = await post(validBody);
    expect(response.status).toBe(504);
    expect((await response.json()).code).toBe("database_timeout");
  });

  it("reports a pending migration as a schema mismatch", async () => {
    mocks.create.mockRejectedValueOnce(
      Object.assign(new Error('column "client_request_id" does not exist'), {
        code: "42703",
      }),
    );
    const response = await post(validBody);
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("database_schema_mismatch");
  });

  it("keeps mandate validation failures as 400 without touching storage", async () => {
    mocks.prepare.mockImplementationOnce(() => {
      throw new Error("Strategy universe contains an asset absent from the bundle");
    });
    const response = await post(validBody);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Strategy universe contains an asset absent from the bundle",
      code: "invalid_mandate",
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("never returns an unclassified driver message with SQL or parameters", async () => {
    mocks.create.mockRejectedValueOnce(
      new Error(
        'Failed query: insert into "agents" ... params: FxNavisTest1111111111111111111111111111111,Ledger Sentinel',
      ),
    );
    const response = await post(validBody);
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(JSON.parse(text).code).toBe("database_error");
    expect(text).not.toContain("Failed query");
    expect(text).not.toContain("FxNavisTest");
  });

  it("refuses a reused request key that carries a different mandate", async () => {
    mocks.create.mockRejectedValueOnce(new DatabaseError("duplicate_request"));
    const response = await post(validBody);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("duplicate_request");
  });

  it("answers a missing DATABASE_URL with database_not_configured", async () => {
    mocks.databaseUrl = undefined;
    const response = await post(validBody);
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("database_not_configured");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an untrusted origin before touching storage", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/agents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
          cookie: "navis_session=token",
        },
        body: JSON.stringify(validBody),
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an expired or invalid session with 401", async () => {
    mocks.session = null;
    const response = await post(validBody);
    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("surfaces a typed failure from the owner list route too", async () => {
    mocks.list.mockRejectedValueOnce(
      Object.assign(new Error("timeout exceeded when trying to connect"), {}),
    );
    const response = await GET(
      new NextRequest("http://localhost:3000/api/agents", {
        headers: { cookie: "navis_session=token" },
      }),
    );
    expect(response.status).toBe(504);
    expect((await response.json()).code).toBe("database_timeout");
  });

  it("rethrows a DatabaseError from the service with its own status", async () => {
    mocks.create.mockRejectedValueOnce(
      new DatabaseError("database_transaction_failed"),
    );
    const response = await post(validBody);
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("database_transaction_failed");
  });
});
