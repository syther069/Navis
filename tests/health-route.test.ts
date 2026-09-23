import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("../lib/db/client", () => ({
  getDatabase: () => ({ execute: mocks.execute }),
}));
vi.mock("../lib/env", async () => {
  const { parseEnvironment, toPublicCapabilities } = await import("../lib/env-core");
  const env = parseEnvironment({
    DATABASE_URL: "test-database",
    NEXT_PUBLIC_APP_URL: "https://navis.test",
  });
  return { env, getPublicCapabilities: () => toPublicCapabilities(env) };
});

import { GET } from "../app/api/health/route";

describe("truthful database readiness", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("checks auth rate limits, public demo scoping and identity uniqueness", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{ schema_ready: false, guards_ready: true }],
    });
    const response = await GET();
    expect(response.status).toBe(503);
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]).sql;
    for (const required of [
      "rate_limit_windows",
      "auth_session_revocations",
      "is_public_demo",
      "agents_public_demo_slug_unique",
      "decisions_agent_client_request_unique",
      "agents_external_agent_id_unique",
    ]) {
      expect(query).toContain(required);
    }
  });

  it("reports only a valid deployment commit, never arbitrary environment text", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{ schema_ready: true, guards_ready: true }],
    });
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
    expect((await (await GET()).json()).deployment.commit).toBe("a".repeat(40));
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "not-a-sha");
    expect((await (await GET()).json()).deployment.commit).toBeNull();
  });

  it("requires both the schema and immutability guards", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{ schema_ready: true, guards_ready: true }],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).services.database).toEqual({
      status: "ok",
      tablesReady: true,
      immutabilityGuardsReady: true,
    });
  });

  it("reports missing migrations rather than successful connectivity", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{ schema_ready: true, guards_ready: false }],
    });
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).services.database.status).toBe("schema_incomplete");
  });

  it("never returns a database error or connection value", async () => {
    mocks.execute.mockRejectedValue(new Error("private connection details"));
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("unreachable");
    expect(body).not.toContain("private connection details");
    expect(body).not.toContain("test-database");
  });
});

describe("ClawPump status in health", () => {
  it("names the missing credential and never claims connected without a key", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{ schema_ready: true, guards_ready: true }],
    });
    const body = await (await GET()).json();
    expect(body.services.clawpump).toEqual({
      status: "not_configured",
      credential: "CLAWPUMP_API_KEY",
      verification: null,
    });
  });
});
