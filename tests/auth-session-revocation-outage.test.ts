import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  failReads: true,
  failWrites: true,
  failPrune: false,
  databaseUrl: "postgres://unit-test-unreachable" as string | undefined,
}));

vi.mock("@/lib/env", () => ({
  env: {
    appUrl: "https://navis.example",
    sessionSecret: "unit-test-only-not-a-production-session-secret",
    get databaseUrl() {
      return db.databaseUrl;
    },
  },
}));

// Database access is fully controllable so each failure mode stays isolated.
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            db.failReads
              ? Promise.reject(new Error("database unreachable"))
              : Promise.resolve([]),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () =>
          db.failWrites
            ? Promise.reject(new Error("database unreachable"))
            : Promise.resolve(),
      }),
    }),
    delete: () => ({
      where: () =>
        db.failPrune
          ? Promise.reject(new Error("database unreachable"))
          : Promise.resolve(),
    }),
  }),
}));

vi.spyOn(console, "error").mockImplementation(() => undefined);

const { readSessionToken, revokeAuthenticationSession } =
  await import("../lib/auth/server");

const wallet = "So11111111111111111111111111111111111111112";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const key = new TextEncoder().encode("unit-test-only-not-a-production-session-secret");

function signToken({ withJti = true }: { withJti?: boolean } = {}) {
  let token = new SignJWT({ wallet })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("https://navis.example")
    .setAudience("navis")
    .setIssuedAt()
    .setExpirationTime("1h");
  if (withJti) token = token.setJti("11111111-2222-4333-8444-555555555555");
  return token.sign(key);
}

describe("wallet sessions during a revocation-storage outage", () => {
  beforeEach(() => {
    db.failReads = true;
    db.failWrites = true;
    db.failPrune = false;
    db.databaseUrl = "postgres://unit-test-unreachable";
  });

  it("rejects otherwise valid sessions when the revocation list cannot be read", async () => {
    // Fail closed: an unreadable revocation list must never authenticate.
    expect(await readSessionToken(await signToken())).toBeNull();
  });

  it("reports unavailable when the revocation row cannot be written", async () => {
    // The logout route must keep the cookie on this outcome so the owner can
    // retry; reporting success would re-enable a copied token after recovery.
    expect(await revokeAuthenticationSession(await signToken())).toBe("unavailable");
  });

  it("treats invalid and legacy tokens as needing no server-side revocation", async () => {
    expect(await revokeAuthenticationSession("not-a-token")).toBe("not_revocable");
    expect(await revokeAuthenticationSession(await signToken({ withJti: false }))).toBe(
      "not_revocable",
    );
  });

  it("classifies tokens before consulting storage configuration", async () => {
    db.databaseUrl = undefined;
    // Invalid and legacy tokens never need storage, even when it is missing.
    expect(await revokeAuthenticationSession("not-a-token")).toBe("not_revocable");
    expect(await revokeAuthenticationSession(await signToken({ withJti: false }))).toBe(
      "not_revocable",
    );
    // A valid revocable token does need storage: the owner must be able to
    // retry rather than lose the only revocable cookie copy.
    expect(await revokeAuthenticationSession(await signToken())).toBe("unavailable");
  });

  it("reports revoked when the row is durable even if pruning fails", async () => {
    db.failWrites = false;
    db.failPrune = true;
    expect(await revokeAuthenticationSession(await signToken())).toBe("revoked");
  });
});
