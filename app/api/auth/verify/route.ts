import { NextResponse } from "next/server";

import { AUTH_SESSION_TTL_SECONDS, verificationRequestSchema } from "@/lib/auth/core";
import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { classifyDatabaseError, logDatabaseError } from "@/lib/db/errors";
import {
  AuthenticationError,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyAuthenticationChallenge,
} from "@/lib/auth/server";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
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
