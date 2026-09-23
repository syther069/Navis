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
  let session;
  try {
    session = token ? await readSessionToken(token, { reportUnavailable: true }) : null;
  } catch {
    return NextResponse.json(
      { error: "The session could not be checked. Try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

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
  const token = request.headers
    .get("cookie")
    ?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  if (token) {
    const outcome = await revokeAuthenticationSession(token);
    if (outcome === "unavailable") {
      // Revocation storage failed. Keep the cookie so the owner can retry:
      // clearing it would destroy the only retry path while a copied token
      // silently becomes valid again once storage recovers.
      return NextResponse.json(
        { error: "The session could not be ended on the server. Try again." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

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
