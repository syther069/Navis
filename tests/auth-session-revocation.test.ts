import bs58 from "bs58";
import { eq, inArray } from "drizzle-orm";
import { SignJWT } from "jose";
import nacl from "tweetnacl";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "../lib/db/schema";
import { env } from "../lib/env";

const databaseUrl = process.env.DATABASE_URL;

// The wallet auth server module reads the shared env; give it a complete
// authentication configuration so the session tests exercise the real
// revocation table instead of the "not_configured" short circuit.
vi.mock("../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      appUrl: "https://navis.test",
      appOriginConfigured: true,
      sessionSecret: "session-revocation-test-secret-with-32-plus-characters",
    },
  };
});

// Real database round trip for session revocation. These go through the
// module-level pool inside lib/auth/server, so they cannot ride a rolled-back
// transaction; the rows for the throwaway wallets are removed afterwards.
describe.skipIf(!databaseUrl)("wallet session revocation", () => {
  const keypairA = nacl.sign.keyPair();
  const walletA = bs58.encode(keypairA.publicKey);
  const keypairB = nacl.sign.keyPair();
  const walletB = bs58.encode(keypairB.publicKey);
  const trackedJtis: string[] = [];

  async function cleanup() {
    const { getDatabase } = await import("../lib/db/client");
    const database = getDatabase();
    if (trackedJtis.length > 0) {
      await database
        .delete(schema.authSessionRevocations)
        .where(inArray(schema.authSessionRevocations.jti, trackedJtis));
    }
    for (const wallet of [walletA, walletB]) {
      await database
        .delete(schema.authChallenges)
        .where(eq(schema.authChallenges.wallet, wallet));
      await database.delete(schema.users).where(eq(schema.users.wallet, wallet));
    }
  }

  beforeEach(cleanup);
  afterAll(cleanup);

  async function mintSession(keypair: nacl.SignKeyPair, wallet: string) {
    const auth = await import("../lib/auth/server");
    const challenge = await auth.createAuthenticationChallenge(wallet);
    const signature = bs58.encode(
      nacl.sign.detached(
        new TextEncoder().encode(challenge.message),
        keypair.secretKey,
      ),
    );
    const { token, user } = await auth.verifyAuthenticationChallenge({
      challengeId: challenge.challengeId,
      wallet,
      nonce: challenge.nonce,
      signature,
    });
    const [, payloadB64] = token.split(".");
    const jti = JSON.parse(Buffer.from(payloadB64, "base64url").toString()).jti;
    trackedJtis.push(jti);
    return { token, user, jti };
  }

  it("mints sessions with a unique jti per sign-in", async () => {
    const first = await mintSession(keypairA, walletA);
    const second = await mintSession(keypairA, walletA);
    expect(first.jti).toBeTruthy();
    expect(second.jti).toBeTruthy();
    expect(first.jti).not.toBe(second.jti);
  });

  it("accepts a session before logout and rejects the same token after", async () => {
    const auth = await import("../lib/auth/server");
    const { token, jti, user } = await mintSession(keypairA, walletA);

    const before = await auth.readSessionToken(token);
    expect(before).toMatchObject({ userId: user.id, wallet: walletA });

    expect(await auth.revokeAuthenticationSession(token)).toBe(true);
    expect(await auth.readSessionToken(token)).toBeNull();

    const { getDatabase } = await import("../lib/db/client");
    const rows = await getDatabase()
      .select()
      .from(schema.authSessionRevocations)
      .where(inArray(schema.authSessionRevocations.jti, [jti]));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(user.id);
  });

  it("does not revoke the wallet's other sessions or another user's session", async () => {
    const auth = await import("../lib/auth/server");
    const revoked = await mintSession(keypairA, walletA);
    const sameWallet = await mintSession(keypairA, walletA);
    const otherUser = await mintSession(keypairB, walletB);

    expect(await auth.revokeAuthenticationSession(revoked.token)).toBe(true);

    expect(await auth.readSessionToken(revoked.token)).toBeNull();
    expect(await auth.readSessionToken(sameWallet.token)).toMatchObject({
      wallet: walletA,
    });
    expect(await auth.readSessionToken(otherUser.token)).toMatchObject({
      wallet: walletB,
    });
  });

  it("keeps legacy tokens without a jti valid until they expire", async () => {
    const auth = await import("../lib/auth/server");
    const { user } = await mintSession(keypairA, walletA);
    const legacy = await new SignJWT({ wallet: walletA })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer(env.appUrl)
      .setAudience("navis")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(env.sessionSecret!));

    expect(await auth.readSessionToken(legacy)).toMatchObject({ wallet: walletA });
    // There is no jti to record; revocation is a no-op for legacy tokens.
    expect(await auth.revokeAuthenticationSession(legacy)).toBe(false);
  });

  it("refuses to revoke malformed or expired tokens and still rejects them", async () => {
    const auth = await import("../lib/auth/server");
    expect(await auth.revokeAuthenticationSession("not-a-token")).toBe(false);

    const { user } = await mintSession(keypairA, walletA);
    const expired = await new SignJWT({ wallet: walletA })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setJti("expired-jti-under-test")
      .setIssuer(env.appUrl)
      .setAudience("navis")
      .setIssuedAt()
      .setExpirationTime("-1s")
      .sign(new TextEncoder().encode(env.sessionSecret!));

    expect(await auth.revokeAuthenticationSession(expired)).toBe(false);
    expect(await auth.readSessionToken(expired)).toBeNull();
  });

  it("prunes revocation rows whose tokens have already expired", async () => {
    const auth = await import("../lib/auth/server");
    const { getDatabase } = await import("../lib/db/client");
    const database = getDatabase();
    const staleJti = "stale-jti-under-test";
    trackedJtis.push(staleJti);
    await database.insert(schema.authSessionRevocations).values({
      jti: staleJti,
      userId: (await mintSession(keypairA, walletA)).user.id,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const fresh = await mintSession(keypairA, walletA);
    expect(await auth.revokeAuthenticationSession(fresh.token)).toBe(true);

    const rows = await database
      .select()
      .from(schema.authSessionRevocations)
      .where(inArray(schema.authSessionRevocations.jti, [staleJti]));
    expect(rows).toHaveLength(0);
  });
});
