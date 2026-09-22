import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    appUrl: "https://navis.example",
    sessionSecret: "unit-test-only-not-a-production-session-secret",
    databaseUrl: "postgres://unit-test-unreachable",
  },
}));

// Every database access fails, simulating a storage outage.
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.reject(new Error("database unreachable")),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => Promise.reject(new Error("database unreachable")),
      }),
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
});
