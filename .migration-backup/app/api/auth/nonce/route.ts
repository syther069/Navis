import { NextResponse } from "next/server";

import { challengeRequestSchema } from "@/lib/auth/core";
import { allowMutationRequest, clientIdentifier } from "@/lib/auth/rate-limit";
import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { consumeSharedRateLimit } from "@/lib/auth/shared-rate-limit";
import { getDatabase } from "@/lib/db/client";
import { classifyDatabaseError, logDatabaseError } from "@/lib/db/errors";
import { env } from "@/lib/env";
import { AuthenticationError, createAuthenticationChallenge } from "@/lib/auth/server";

/** Challenge issues per client per minute; each one writes a database row. */
const NONCE_LIMIT = 10;
const NONCE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }
  // Cheap in-process burst guard first; the shared limiter below is the one
  // that holds across serverless instances.
  if (!allowMutationRequest(request, NONCE_LIMIT * 2, NONCE_WINDOW_MS, "auth.nonce")) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const parsed = challengeRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid Solana wallet address is required." },
      { status: 400 },
    );
  }

  try {
    if (env.databaseUrl) {
      const shared = await consumeSharedRateLimit(getDatabase(), {
        scope: "auth.nonce",
        client: clientIdentifier(request),
        limit: NONCE_LIMIT,
        windowMs: NONCE_WINDOW_MS,
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
    const challenge = await createAuthenticationChallenge(parsed.data.wallet);
    return NextResponse.json(challenge, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthenticationError && error.code === "not_configured") {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503 },
      );
    }
    const classified = classifyDatabaseError(error);
    if (classified.code !== "database_error") {
      logDatabaseError("auth.nonce", classified);
      return NextResponse.json(classified.toJSON(), { status: classified.status });
    }
    return NextResponse.json(
      { error: "The authentication challenge could not be created." },
      { status: 500 },
    );
  }
}
