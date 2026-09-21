import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { getDatabase } from "@/lib/db/client";
import { authChallenges, users } from "@/lib/db/schema";
import { env } from "@/lib/env";

import {
  AUTH_CHALLENGE_TTL_MS,
  AUTH_SESSION_TTL_SECONDS,
  AuthenticationError,
  assertChallengeUsable,
  buildSignInMessage,
  createAuthNonce,
  hashAuthNonce,
  verifyWalletSignature,
  walletSchema,
} from "./core";

export { AuthenticationError } from "./core";

export const SESSION_COOKIE_NAME = "navis_session";
const AUTH_STATEMENT =
  "Authenticate to Navis. This request does not authorize a transaction.";
const sessionClaimsSchema = z.object({
  sub: z.uuid(),
  wallet: walletSchema,
  exp: z.number().int().positive(),
});

function requireAuthenticationConfiguration() {
  if (!env.databaseUrl || !env.sessionSecret || !env.appOriginConfigured) {
    throw new AuthenticationError(
      "Wallet authentication requires persistent storage, a session secret, and the exact application origin.",
      "not_configured",
    );
  }
}

function messageInput(
  challenge: {
    wallet: string;
    domain: string;
    uri: string;
    statement: string;
    issuedAt: Date;
    expiresAt: Date;
  },
  nonce: string,
) {
  return {
    ...challenge,
    nonce,
    cluster: env.cluster,
  } as const;
}

export async function createAuthenticationChallenge(wallet: string) {
  requireAuthenticationConfiguration();

  const database = getDatabase();
  const nonce = createAuthNonce();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + AUTH_CHALLENGE_TTL_MS);
  const appUrl = new URL(env.appUrl);
  const domain = appUrl.host;
  const uri = appUrl.origin;

  const [challenge] = await database
    .insert(authChallenges)
    .values({
      wallet,
      nonceHash: hashAuthNonce(nonce),
      domain,
      uri,
      statement: AUTH_STATEMENT,
      issuedAt,
      expiresAt,
    })
    .returning();

  if (!challenge) throw new Error("The authentication challenge was not persisted.");

  return {
    challengeId: challenge.id,
    nonce,
    message: buildSignInMessage(messageInput(challenge, nonce)),
    expiresAt: challenge.expiresAt.toISOString(),
  };
}

export async function verifyAuthenticationChallenge(input: {
  challengeId: string;
  wallet: string;
  nonce: string;
  signature: string;
}) {
  requireAuthenticationConfiguration();

  const database = getDatabase();
  const [challenge] = await database
    .select()
    .from(authChallenges)
    .where(eq(authChallenges.id, input.challengeId))
    .limit(1);

  if (!challenge) {
    throw new AuthenticationError(
      "Authentication challenge not found.",
      "challenge_not_found",
    );
  }
  assertChallengeUsable(challenge, {
    wallet: input.wallet,
    nonce: input.nonce,
    expectedDomain: new URL(env.appUrl).host,
    expectedUri: new URL(env.appUrl).origin,
    now: new Date(),
  });

  const message = buildSignInMessage(messageInput(challenge, input.nonce));
  if (!verifyWalletSignature({ ...input, message })) {
    throw new AuthenticationError("Wallet signature is invalid.", "invalid_signature");
  }

  const now = new Date();
  const user = await database.transaction(async (transaction) => {
    const [consumed] = await transaction
      .update(authChallenges)
      .set({ usedAt: now })
      .where(
        and(
          eq(authChallenges.id, challenge.id),
          isNull(authChallenges.usedAt),
          gt(authChallenges.expiresAt, now),
        ),
      )
      .returning({ id: authChallenges.id });

    if (!consumed) {
      throw new AuthenticationError(
        "Authentication challenge was already used or expired.",
        "challenge_replayed",
      );
    }

    const [persistedUser] = await transaction
      .insert(users)
      .values({ wallet: input.wallet })
      .onConflictDoUpdate({
        target: users.wallet,
        set: { updatedAt: now },
      })
      .returning({ id: users.id, wallet: users.wallet });

    return persistedUser;
  });

  if (!user) throw new Error("The authenticated user could not be persisted.");

  return {
    user,
    token: await createSessionToken(user),
  };
}

async function createSessionToken(user: { id: string; wallet: string }) {
  if (!env.sessionSecret) {
    throw new AuthenticationError(
      "Wallet authentication is unavailable.",
      "not_configured",
    );
  }

  return new SignJWT({ wallet: user.wallet })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(env.appUrl)
    .setAudience("navis")
    .setIssuedAt()
    .setExpirationTime(`${AUTH_SESSION_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(env.sessionSecret));
}

export async function readSessionToken(token: string) {
  if (!env.sessionSecret) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.sessionSecret),
      {
        issuer: env.appUrl,
        audience: "navis",
        algorithms: ["HS256"],
      },
    );

    const claims = sessionClaimsSchema.safeParse(payload);
    if (!claims.success) return null;

    return {
      userId: claims.data.sub,
      wallet: claims.data.wallet,
      expiresAt: new Date(claims.data.exp * 1_000).toISOString(),
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Secure whenever the configured origin is https, and always in production
  // so a misconfigured origin can never downgrade the cookie to plain http.
  secure: env.appUrl.startsWith("https://") || process.env.NODE_ENV === "production",
  path: "/",
  maxAge: AUTH_SESSION_TTL_SECONDS,
};
