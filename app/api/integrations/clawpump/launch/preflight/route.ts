import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import {
  ClawPumpError,
  getClawPumpPublicError,
} from "@/lib/integrations/clawpump/client";
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
      const publicError = getClawPumpPublicError(error);
      return NextResponse.json(
        {
          state: "payment_required",
          error: publicError.message,
          requestId: error.requestId,
        },
        { status: publicError.status },
      );
    }
    if (error instanceof ClawPumpError) {
      const publicError = getClawPumpPublicError(error);
      return NextResponse.json(
        { error: publicError.message, requestId: error.requestId },
        { status: publicError.status },
      );
    }
    return NextResponse.json(
      { error: "Launch preflight could not be completed safely." },
      { status: 400 },
    );
  }
}
