import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { ClawPumpError } from "@/lib/integrations/clawpump/client";
import { createClawPumpClient } from "@/lib/integrations/clawpump/server";
import { createLaunchPreflight } from "@/lib/services/launch-preflight";

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate the connected wallet before requesting a quote." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as unknown;
    const result = await createLaunchPreflight(body, {
      userId: session.userId,
      wallet: session.wallet,
      client: createClawPumpClient(),
      database: getDatabase(),
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid preflight request." },
        { status: 400 },
      );
    }
    if (error instanceof ClawPumpError && error.kind === "payment_required") {
      return NextResponse.json(
        {
          state: "payment_required",
          error: error.message,
          requestId: error.requestId,
        },
        { status: 402 },
      );
    }
    if (error instanceof ClawPumpError) {
      const status = error.kind === "forbidden" ? 403 : 502;
      return NextResponse.json(
        { error: error.message, requestId: error.requestId },
        { status },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Launch preflight failed." },
      { status: 400 },
    );
  }
}
