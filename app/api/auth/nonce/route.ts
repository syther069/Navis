import { NextResponse } from "next/server";

import { challengeRequestSchema } from "@/lib/auth/core";
import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { AuthenticationError, createAuthenticationChallenge } from "@/lib/auth/server";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
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
    const challenge = await createAuthenticationChallenge(parsed.data.wallet);
    return NextResponse.json(challenge, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthenticationError && error.code === "not_configured") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "The authentication challenge could not be created." },
      { status: 500 },
    );
  }
}
