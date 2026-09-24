import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

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

import ProofDetailPage from "../app/(decision-detail)/proofs/[proofId]/page";
import { demoProof } from "../fixtures/demo-proof";

function render(proofId: string) {
  return ProofDetailPage({
    params: Promise.resolve({ proofId }),
    searchParams: Promise.resolve({}),
  });
}

describe("proof detail page", () => {
  beforeEach(() => {
    mocks.databaseUrl = undefined;
    mocks.cookieValue = undefined;
    mocks.notFound.mockClear();
  });

  it("returns a 404 for an unknown proof without a database", async () => {
    await expect(render("does-not-exist")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("returns a 404 for an unknown proof even with a database session", async () => {
    mocks.databaseUrl = "postgres://example";
    mocks.cookieValue = "valid-session";
    await expect(render("2f2b6d9e-6b0e-4d8a-9c6b-1f0d3d5b7a11")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("renders the demo proof without touching the database", async () => {
    const element = await render(demoProof.id);
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(JSON.stringify(element)).toContain(demoProof.receiptHash);
  });
});

describe("proof detail route placement", () => {
  // A loading.tsx anywhere above the page wraps it in a Suspense boundary and
  // Next streams the shell with HTTP 200 before notFound() runs. Decisions and
  // proofs both live in a group without one so unknown IDs are real 404s.
  it("has no loading boundary between app/ and the proof page", () => {
    const appDir = join(process.cwd(), "app");
    let dir = join(appDir, "(decision-detail)", "proofs", "[proofId]");
    const offenders: string[] = [];
    while (dir.startsWith(appDir)) {
      const candidate = join(dir, "loading.tsx");
      if (existsSync(candidate)) offenders.push(candidate);
      if (dir === appDir) break;
      dir = dirname(dir);
    }
    expect(offenders).toEqual([]);
  });
});
