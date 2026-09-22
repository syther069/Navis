import { NextResponse } from "next/server";

import { AUTH_SESSION_TTL_SECONDS, verificationRequestSchema } from "@/lib/auth/core";
import { allowMutationRequest, clientIdentifier } from "@/lib/auth/rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { consumeSharedRateLimit } from "@/lib/auth/shared-rate-limit";
import { getDatabase } from "@/lib/db/client";
import { classifyDatabaseError, logDatabaseError } from "@/lib/db/errors";
import { env } from "@/lib/env";
import {
  AuthenticationError,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyAuthenticationChallenge,
} from "@/lib/auth/server";

/** Verify attempts per client per minute; each one runs signature checks. */
const VERIFY_LIMIT = 20;
const VERIFY_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }
  // Cheap in-process burst guard first; the shared limiter below is the one
  // that holds across serverless instances.
  if (!allowMutationRequest(request, VERIFY_LIMIT * 2, VERIFY_WINDOW_MS, "auth.verify")) {
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
