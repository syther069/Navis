import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    appUrl: "https://navis.example",
    sessionSecret: "unit-test-only-not-a-production-session-secret",
  },
}));

const { readSessionToken } = await import("../lib/auth/server");
const wallet = "So11111111111111111111111111111111111111112";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const key = new TextEncoder().encode("unit-test-only-not-a-production-session-secret");

function signToken({
  subject = userId,
  address = wallet,
  expiry = "1h",
  issuer = "https://navis.example",
}: {
  subject?: string;
  address?: string;
  expiry?: string | null;
  issuer?: string;
} = {}) {
  let token = new SignJWT({ wallet: address })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer(issuer)
    .setAudience("navis")
    .setIssuedAt();
  if (expiry !== null) token = token.setExpirationTime(expiry);
  return token.sign(key);
}

describe("wallet session token claims", () => {
  it("accepts a signed, expiring session with a valid wallet and user ID", async () => {
    expect(await readSessionToken(await signToken())).toMatchObject({
      userId,
      wallet,
      expiresAt: expect.any(String),
    });
  });

  it("rejects malformed wallet claims even when the JWT signature is valid", async () => {
    expect(
      await readSessionToken(await signToken({ address: "not-a-wallet" })),
    ).toBeNull();
  });

  it("rejects malformed user IDs", async () => {
    expect(
      await readSessionToken(await signToken({ subject: "not-a-user-id" })),
    ).toBeNull();
  });

  it("requires an expiration", async () => {
    expect(await readSessionToken(await signToken({ expiry: null }))).toBeNull();
  });

  it("rejects expired sessions", async () => {
    expect(await readSessionToken(await signToken({ expiry: "-1s" }))).toBeNull();
  });

  it("rejects sessions issued for a different application origin", async () => {
    expect(
      await readSessionToken(
        await signToken({ issuer: "https://another-app.example" }),
      ),
    ).toBeNull();
  });
});
