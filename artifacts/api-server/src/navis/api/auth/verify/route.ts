import { NextResponse } from "@workspace/navis-core/server/http";

import { AUTH_SESSION_TTL_SECONDS, verificationRequestSchema } from "@workspace/navis-core/lib/auth/core";
import { allowMutationRequest, clientIdentifier } from "@workspace/navis-core/lib/auth/rate-limit";
import { hasTrustedMutationOrigin } from "@workspace/navis-core/lib/auth/request";
import { consumeSharedRateLimit } from "@workspace/navis-core/lib/auth/shared-rate-limit";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import { classifyDatabaseError, logDatabaseError } from "@workspace/navis-core/lib/db/errors";
import { env } from "@workspace/navis-core/lib/env";
import {
  AuthenticationError,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  revokeAuthenticationSession,
  verifyAuthenticationChallenge,
} from "@workspace/navis-core/lib/auth/server";

/** Verify attempts per client per minute; each one runs signature checks. */
const VERIFY_LIMIT = 20;
const VERIFY_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }
  // Cheap in-process burst guard first; the shared limiter below is the one
  // that holds across serverless instances.
  if (
    !allowMutationRequest(request, VERIFY_LIMIT * 2, VERIFY_WINDOW_MS, "auth.verify")
  ) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const parsed = verificationRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The signed authentication response is malformed." },
      { status: 400 },
    );
  }

  try {
    if (env.databaseUrl) {
      const shared = await consumeSharedRateLimit(getDatabase(), {
        scope: "auth.verify",
        client: clientIdentifier(request),
        limit: VERIFY_LIMIT,
        windowMs: VERIFY_WINDOW_MS,
        secret: env.sessionSecret,
      });
      if (!shared.allowed) {
        return NextResponse.json(
          { error: "Too many sign-in attempts. Try again shortly." },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(shared.retryAfterSeconds),
            },
          },
        );
      }
    }
    const { user, token } = await verifyAuthenticationChallenge(parsed.data);
    // Never discard the browser's only copy of an existing session until its
    // revocation is durable. A failed replacement consumes this challenge, but
    // leaves the old cookie intact so logout/sign-in can be retried safely.
    const previousToken = request.headers
      .get("cookie")
      ?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
    if (
      previousToken &&
      (await revokeAuthenticationSession(previousToken)) === "unavailable"
    ) {
      return NextResponse.json(
        { error: "The previous session could not be ended. Try signing in again." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const response = NextResponse.json(
      {
        authenticated: true,
        wallet: user.wallet,
        expiresIn: AUTH_SESSION_TTL_SECONDS,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      const status = error.code === "not_configured" ? 503 : 401;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    const classified = classifyDatabaseError(error);
    if (classified.code !== "database_error") {
      logDatabaseError("auth.verify", classified);
      return NextResponse.json(classified.toJSON(), { status: classified.status });
    }
    return NextResponse.json(
      { error: "The wallet signature could not be verified." },
      { status: 500 },
    );
  }
}
