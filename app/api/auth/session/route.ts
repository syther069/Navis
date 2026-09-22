import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  readSessionToken,
  revokeAuthenticationSession,
  sessionCookieOptions,
} from "@/lib/auth/server";
import { hasTrustedMutationOrigin } from "@/lib/auth/request";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;

  return NextResponse.json(
    session ? { authenticated: true, ...session } : { authenticated: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }

  // Server-side revocation: the token comes from the session cookie, never
  // from the request body, so logout can only end the caller's own session.
  // The outcome is not reflected in the response.
  const token = request.headers
    .get("cookie")
    ?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  if (token) await revokeAuthenticationSession(token);

  const response = NextResponse.json(
    { authenticated: false },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
