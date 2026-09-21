import { describe, expect, it, vi } from "vitest";

import { ClawPumpClient } from "../lib/integrations/clawpump/client";
import { deriveClawPumpStates } from "../lib/integrations/clawpump/state";
import {
  CLAWPUMP_VERIFICATION_OPERATION,
  ensureClawPumpVerification,
  runClawPumpVerification,
  type ClawPumpVerificationRecord,
} from "../lib/services/clawpump-verification";

const meta = { timestamp: "2026-09-21T10:00:00.000Z", requestId: "req-verify-1" };
const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

function agentsResponse() {
  return {
    agents: [
      {
        id: "agent_abc",
        name: "Income Sentinel",
        status: "active",
        walletAddress: WALLET,
        skills: ["chat"],
        tokenAddress: null,
      },
    ],
    meta,
  };
}

/** Minimal insert-capturing stand-in for the Drizzle database. */
function fakeDatabase() {
  const rows: Record<string, unknown>[] = [];
  const database = {
    insert: () => ({
      values: async (value: Record<string, unknown>) => {
        rows.push(value);
      },
    }),
  };
  return { database: database as never, rows };
}

function client(fetcher: typeof fetch) {
  return new ClawPumpClient({
    apiKey: "cpk_test-secret",
    fetcher,
    sleep: async () => {},
    timeoutMs: 50,
  });
}

describe("ClawPump provider verification", () => {
  it("records a connected row only from a validated real 200 on GET /agents", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify(agentsResponse()), { status: 200 }),
      );
    const { database, rows } = fakeDatabase();

    const record = await runClawPumpVerification({
      client: client(fetcher),
      database,
      now: () => new Date("2026-09-21T10:00:01.000Z"),
    });

    expect(record).toMatchObject({
      provider: "clawpump",
      operation: CLAWPUMP_VERIFICATION_OPERATION,
      result: "connected",
      endpoint: "/agents",
      httpStatus: 200,
      responseType: "agents",
      requestId: "req-verify-1",
      providerTimestamp: meta.timestamp,
      agentIds: ["agent_abc"],
      agentCount: 1,
      agentAccess: "granted",
      network: "mainnet-beta",
      networkSource: "provider_documentation",
      safeError: null,
      stored: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: "clawpump",
      operation: CLAWPUMP_VERIFICATION_OPERATION,
      status: "succeeded",
      requestId: "req-verify-1",
    });
    // Sanitised: no key material, no raw body, no wallet from the response.
    const serialised = JSON.stringify(rows[0]);
    expect(serialised).not.toContain("cpk_");
    expect(serialised).not.toContain(WALLET);
    expect(serialised).not.toContain("Income Sentinel");
  });

  it("stores an unauthorised failure for a 401 without retrying or falling back", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "Invalid API key cpk_leaked", meta }), {
          status: 401,
        }),
    );
    const { database, rows } = fakeDatabase();

    const record = await runClawPumpVerification({ client: client(fetcher), database });

    expect(record.result).toBe("unauthorised");
    expect(record.httpStatus).toBe(401);
    expect(record.endpoint).toBe("/agents");
    expect(record.responseType).toBeNull();
    expect(record.agentIds).toEqual([]);
    expect(record.safeError).toBeTruthy();
    expect(record.safeError).not.toContain("cpk_leaked");
    expect(record.safeError).not.toContain("cpk_test-secret");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(rows[0]).toMatchObject({ status: "failed" });
  });

  it("treats a 403 on /agents as an authenticated key without account link, proven by /skills", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/agents")) {
        return new Response(JSON.stringify({ error: "Failed to list agents" }), {
          status: 403,
        });
      }
      return new Response(
        JSON.stringify({
          skills: [
            { slug: "trading", name: "Trading", description: "d", alwaysOn: false },
          ],
          meta,
        }),
        { status: 200 },
      );
    });
    const { database, rows } = fakeDatabase();

    const record = await runClawPumpVerification({ client: client(fetcher), database });

    expect(record).toMatchObject({
      result: "connected",
      endpoint: "/skills",
      httpStatus: 200,
      responseType: "skills",
      requestId: "req-verify-1",
      agentAccess: "forbidden",
      agentCount: 0,
    });
    expect(record.agentAccessError).toContain("403");
    expect(rows[0]).toMatchObject({ status: "succeeded" });
  });

  it("stores an unreachable failure when the provider times out on both endpoints", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const { database, rows } = fakeDatabase();

    const record = await runClawPumpVerification({ client: client(fetcher), database });

    expect(record.result).toBe("unreachable");
    expect(record.httpStatus).toBeNull();
    expect(record.safeError).toBeTruthy();
    expect(rows[0]).toMatchObject({ status: "failed", safeError: record.safeError });
  });

  it("never marks connected on an unexpected schema; falls back to /skills, then fails", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/agents")) {
        return new Response(JSON.stringify({ agents: "not-an-array", meta }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ skills: [{ bogus: true }], meta }), {
        status: 200,
      });
    });
    const { database } = fakeDatabase();

    const record = await runClawPumpVerification({ client: client(fetcher), database });

    expect(record.result).toBe("unreachable");
    expect(record.endpoint).toBe("/skills");
    expect(record.responseType).toBeNull();
  });

  it("returns the record unstored when no database exists", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify(agentsResponse()), { status: 200 }),
      );
    const record = await runClawPumpVerification({
      client: client(fetcher),
      database: null,
    });
    expect(record.result).toBe("connected");
    expect(record.stored).toBe(false);
  });

  it("reuses a fresh stored record and re-verifies once it is older than maxAge", async () => {
    const stored: ClawPumpVerificationRecord = {
      provider: "clawpump",
      operation: CLAWPUMP_VERIFICATION_OPERATION,
      checkedAt: "2026-09-21T10:00:00.000Z",
      providerTimestamp: meta.timestamp,
      endpoint: "/agents",
      httpStatus: 200,
      responseType: "agents",
      requestId: "req-old",
      agentIds: [],
      agentCount: 0,
      agentAccess: "granted",
      agentAccessError: null,
      network: "mainnet-beta",
      networkSource: "provider_documentation",
      result: "connected",
      safeError: null,
      latencyMs: 10,
      stored: true,
    };
    const inserted: unknown[] = [];
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: async () => [{ metadata: stored }] }),
          }),
        }),
      }),
      insert: () => ({
        values: async (value: unknown) => {
          inserted.push(value);
        },
      }),
    } as never;
    const probe = vi.fn(async () => ({
      status: "connected" as const,
      requestId: "req-new",
      timestamp: meta.timestamp,
      endpoint: "/agents" as const,
      httpStatus: 200 as const,
      agentCount: 0,
      agentIds: [],
      agentAccess: "granted" as const,
      agentAccessError: null,
    }));

    const fresh = await ensureClawPumpVerification({
      client: { probeAvailability: probe },
      database,
      maxAgeMs: 10 * 60_000,
      now: () => new Date("2026-09-21T10:05:00.000Z"),
    });
    expect(fresh.requestId).toBe("req-old");
    expect(probe).not.toHaveBeenCalled();

    const renewed = await ensureClawPumpVerification({
      client: { probeAvailability: probe },
      database,
      maxAgeMs: 10 * 60_000,
      now: () => new Date("2026-09-21T10:11:00.000Z"),
    });
    expect(renewed.requestId).toBe("req-new");
    expect(probe).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveLength(1);
  });
});

describe("ClawPump section state model", () => {
  const base = {
    configured: true,
    verified: true,
    linkedAgentCount: 0,
    stockPairCount: 0,
    latestPreflight: null,
    launch: null,
  };

  it("reports not configured without a key and unverified with an unproven key", () => {
    expect(deriveClawPumpStates({ ...base, configured: false })).toMatchObject({
      current: "not_configured",
      connection: "not_configured",
    });
    expect(deriveClawPumpStates({ ...base, verified: false })).toMatchObject({
      current: "not_configured",
      connection: "configured_unverified",
    });
  });

  it("advances through connected, agent linked, stock pair, preflight and launch not submitted", () => {
    expect(deriveClawPumpStates(base).current).toBe("connected");
    expect(deriveClawPumpStates({ ...base, linkedAgentCount: 1 }).current).toBe(
      "agent_linked",
    );
    expect(
      deriveClawPumpStates({ ...base, linkedAgentCount: 1, stockPairCount: 2 }).current,
    ).toBe("stock_pair_discovered");
    expect(
      deriveClawPumpStates({
        ...base,
        linkedAgentCount: 1,
        latestPreflight: { outcome: "rejected" },
      }).current,
    ).toBe("preflight_rejected");
    const quoted = deriveClawPumpStates({
      ...base,
      linkedAgentCount: 1,
      stockPairCount: 1,
      latestPreflight: { outcome: "quoted" },
    });
    expect(quoted.current).toBe("launch_not_submitted");
    expect(quoted.steps.find((s) => s.state === "preflight_successful")?.reached).toBe(
      true,
    );
  });

  it("hides the launch states until a stored launch record carries a real signature", () => {
    const withoutSignature = deriveClawPumpStates({
      ...base,
      linkedAgentCount: 1,
      latestPreflight: { outcome: "quoted" },
      launch: { transactionSignature: null, verifiedOnchain: false },
    });
    expect(withoutSignature.current).toBe("launch_not_submitted");
    expect(
      withoutSignature.steps.filter((s) => s.state.startsWith("launch_") && s.visible),
    ).toEqual([
      expect.objectContaining({ state: "launch_not_submitted", visible: true }),
    ]);

    const submitted = deriveClawPumpStates({
      ...base,
      linkedAgentCount: 1,
      latestPreflight: { outcome: "quoted" },
      launch: { transactionSignature: "5igNature", verifiedOnchain: false },
    });
    expect(submitted.current).toBe("launch_submitted");
    expect(submitted.steps.find((s) => s.state === "launch_submitted")?.visible).toBe(
      true,
    );
    expect(
      submitted.steps.find((s) => s.state === "launch_verified_onchain")?.visible,
    ).toBe(false);

    const verified = deriveClawPumpStates({
      ...base,
      linkedAgentCount: 1,
      latestPreflight: { outcome: "quoted" },
      launch: { transactionSignature: "5igNature", verifiedOnchain: true },
    });
    expect(verified.current).toBe("launch_verified_onchain");
  });
});
