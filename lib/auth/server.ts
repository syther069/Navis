import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { getDatabase } from "@/lib/db/client";
import { authChallenges, authSessionRevocations, users } from "@/lib/db/schema";
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
  // Present on tokens minted after server-side revocation support; legacy
  // tokens without it simply expire.
  jti: z.string().min(1).max(64).optional(),
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

  // Bound the table: every issued challenge removes rows that can never be
  // verified again, so flooding the nonce endpoint cannot grow it forever.
  await pruneAuthenticationChallenges(database, issuedAt);

  return {
    challengeId: challenge.id,
    nonce,
    message: buildSignInMessage(messageInput(challenge, nonce)),
    expiresAt: challenge.expiresAt.toISOString(),
  };
}

/**
 * Removes challenges that can never verify again: expired, or already
 * consumed. Called opportunistically when a new challenge is issued so the
 * table stays bounded without a separate sweeper.
 */
export async function pruneAuthenticationChallenges(
  database: ReturnType<typeof getDatabase>,
  now = new Date(),
) {
  await database
    .delete(authChallenges)
    .where(or(lt(authChallenges.expiresAt, now), isNotNull(authChallenges.usedAt)));
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
    .setJti(randomUUID())
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

    // Tokens minted after revocation support carry a jti; check the
    // server-side revocation list so a logged-out session stays rejected.
    // Legacy tokens without a jti cannot be revoked and simply expire.
    if (claims.data.jti && (await isSessionRevoked(claims.data.jti))) {
      return null;
    }

    return {
      userId: claims.data.sub,
      wallet: claims.data.wallet,
      expiresAt: new Date(claims.data.exp * 1_000).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Tokens bearing a jti are only minted when the database is configured, so a
 * missing database means the revocation list cannot be read and the safest
 * answer is to reject the token. A database failure also fails closed: with
 * storage down the rest of the app cannot serve authenticated work anyway.
 */
async function isSessionRevoked(jti: string) {
  if (!env.databaseUrl) return true;
  try {
    const database = getDatabase();
    const [row] = await database
      .select({ jti: authSessionRevocations.jti })
      .from(authSessionRevocations)
      .where(eq(authSessionRevocations.jti, jti))
      .limit(1);
    return Boolean(row);
  } catch (error) {
    console.error(
      "[navis:auth.session] revocation check failed:",
      error instanceof Error ? error.name : typeof error,
    );
    return true;
  }
}

export type SessionRevocationOutcome = "revoked" | "not_revocable" | "unavailable";

/**
 * Revokes exactly the session carried by `token`: the jti and user come from
 * the verified JWT claims, never from client-supplied input, so one wallet
 * cannot revoke another's session.
 *
 * Outcomes:
 * - "revoked": the server-side revocation row is durable.
 * - "not_revocable": the token is invalid, expired, or legacy (no jti). It
 *   can never authenticate again or expires on its own, so clearing the
 *   cookie is safe.
 * - "unavailable": revocation storage could not be written. The caller must
 *   NOT clear the cookie, so the owner can retry; otherwise a copied token
 *   would become valid again once storage recovers while the owner believes
 *   the session was ended.
 */
export async function revokeAuthenticationSession(
  token: string,
): Promise<SessionRevocationOutcome> {
  // Without the secret the token cannot even be classified, so this is an
  // outage, not proof that revocation is unnecessary.
  if (!env.sessionSecret) return "unavailable";

  let claims: z.infer<typeof sessionClaimsSchema>;
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

    const parsed = sessionClaimsSchema.safeParse(payload);
    if (!parsed.success) return "not_revocable";
    claims = parsed.data;
  } catch {
    // Invalid or expired token: it cannot authenticate, so there is nothing
    // durable left to revoke, regardless of storage state.
    return "not_revocable";
  }

  if (!claims.jti) return "not_revocable";

  // Only a valid, revocable token needs storage; without it the owner must be
  // able to retry rather than lose the cookie.
  if (!env.databaseUrl) return "unavailable";

  try {
    const database = getDatabase();
    await database
      .insert(authSessionRevocations)
      .values({
        jti: claims.jti,
        userId: claims.sub,
        expiresAt: new Date(claims.exp * 1_000),
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error(
      "[navis:auth.session] revocation failed:",
      error instanceof Error ? error.name : typeof error,
    );
    return "unavailable";
  }

  // Best effort only: the revocation row is already durable, so a pruning
  // failure must not turn a completed logout into a retryable error.
  try {
    await getDatabase()
      .delete(authSessionRevocations)
      .where(lt(authSessionRevocations.expiresAt, new Date()));
  } catch (error) {
    console.error(
      "[navis:auth.session] revocation pruning failed:",
      error instanceof Error ? error.name : typeof error,
    );
  }

  return "revoked";
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
