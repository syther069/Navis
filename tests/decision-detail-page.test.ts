import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databaseUrl: undefined as string | undefined,
  cookieValue: undefined as string | undefined,
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
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

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "navis_session" && mocks.cookieValue
        ? { value: mocks.cookieValue }
        : undefined,
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

vi.mock("../lib/auth/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth/server")>();
  return {
    ...actual,
    readSessionToken: vi.fn(async (token: string) =>
      token === "valid-session" ? { wallet: "owner-wallet" } : null,
    ),
  };
});

vi.mock("../lib/db/client", () => ({
  getDatabase: () => {
    const query = {
      from: () => query,
      innerJoin: () => query,
      where: () => query,
      limit: async () => [],
    };
    return { select: () => query };
  },
}));

import DecisionDetailPage from "../app/(decision-detail)/decisions/[decisionId]/page";
import { describeDecisionDetailAccess } from "../lib/decisions/detail-link";
import { demoAgentBundle } from "../fixtures/demo-agent";
import { runDecision } from "../lib/services/run-decision";

function render(decisionId: string) {
  return DecisionDetailPage({
    params: Promise.resolve({ decisionId }),
    searchParams: Promise.resolve({}),
  });
}

describe("decision detail page", () => {
  beforeEach(() => {
    mocks.databaseUrl = undefined;
    mocks.cookieValue = undefined;
    mocks.notFound.mockClear();
  });

  it("returns a 404 for an unknown decision without a database", async () => {
    await expect(render("does-not-exist")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("returns a 404 for an unknown decision even with a database session", async () => {
    mocks.databaseUrl = "postgres://example";
    mocks.cookieValue = "valid-session";
    await expect(render("2f2b6d9e-6b0e-4d8a-9c6b-1f0d3d5b7a11")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("renders a remembered in-memory run without offering a detail link", async () => {
    const run = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
    });
    const element = await render(run.decisionId);
    expect(mocks.notFound).not.toHaveBeenCalled();
    const html = JSON.stringify(element);
    expect(html).toContain('"showDetailLink":false');
  });
});

describe("decision detail link policy", () => {
  it("does not offer a link for runs held only in server memory", () => {
    const access = describeDecisionDetailAccess({ store: "memory", note: "x" });
    expect(access.linkable).toBe(false);
    expect(access.note).toMatch(/complete decision record/i);
  });

  it("offers a link for runs persisted in the database", () => {
    expect(
      describeDecisionDetailAccess({ store: "database", note: "x" }).linkable,
    ).toBe(true);
  });
});
