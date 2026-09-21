import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import {
  ClawPumpError,
  getClawPumpPublicError,
} from "@/lib/integrations/clawpump/client";
import {
  createClawPumpClient,
  loadClawPumpPreflightDependencies,
} from "@/lib/integrations/clawpump/server";
import {
  createLaunchPreflight,
  LaunchPreflightRefused,
} from "@/lib/services/launch-preflight";

/**
 * Read-only launch preflight. Every determinate outcome (provider quote or a
 * local/provider rejection) answers 200 with `state` so the page can render
 * it; only malformed input, missing auth or infrastructure faults are errors.
 * The paid launch path is never called from here.
 */
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
  if (!env.clawpumpApiKey) {
    return NextResponse.json(
      {
        error:
          "ClawPump is not configured. Set CLAWPUMP_API_KEY (a cpk_ Partner key) on the server.",
      },
      { status: 503 },
    );
  }
  if (!env.databaseUrl) {
    return NextResponse.json(
      {
        error:
          "Persistent storage is not configured; preflight evidence cannot be stored.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as unknown;
    const dependencies = await loadClawPumpPreflightDependencies();
    const result = await createLaunchPreflight(body, {
      userId: session.userId,
      wallet: session.wallet,
      client: createClawPumpClient(),
      database: getDatabase(),
      ...dependencies,
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
    if (error instanceof LaunchPreflightRefused) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ClawPumpError) {
      // Catalogue or cost reads failed before a preflight decision existed.
      const publicError = getClawPumpPublicError(error);
      return NextResponse.json(
        { error: publicError.message, requestId: error.requestId },
        { status: publicError.status },
      );
    }
    return NextResponse.json(
      { error: "Launch preflight could not be completed safely." },
      { status: 500 },
    );
  }
}
