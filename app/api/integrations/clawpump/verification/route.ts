import { NextRequest, NextResponse } from "next/server";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { createClawPumpClient } from "@/lib/integrations/clawpump/server";
import {
  getLatestClawPumpVerification,
  runClawPumpVerification,
} from "@/lib/services/clawpump-verification";

const NOT_CONFIGURED = {
  status: "not_configured",
  credential: "CLAWPUMP_API_KEY",
  requirement: "A ClawPump Partner API key in the cpk_ format, server-side only.",
  record: null,
} as const;

/** Latest stored sanitised verification record. Read-only, no provider call. */
export async function GET() {
  if (!env.clawpumpApiKey) {
    return NextResponse.json(NOT_CONFIGURED, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  const record = env.databaseUrl
    ? await getLatestClawPumpVerification(getDatabase()).catch(() => null)
    : null;
  return NextResponse.json(
    {
      status:
        record?.result === "connected"
          ? "connected"
          : record
            ? record.result
            : "configured_unverified",
      credential: "CLAWPUMP_API_KEY",
      record,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Run one real authenticated read-only request and store the sanitised
 * outcome. Session-bound so anonymous traffic cannot drive provider calls.
 */
export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate the connected wallet before verifying the provider." },
      { status: 401 },
    );
  }
  if (!env.clawpumpApiKey) {
    return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  }
  try {
    const record = await runClawPumpVerification({
      client: createClawPumpClient(),
      database: env.databaseUrl ? getDatabase() : null,
    });
    return NextResponse.json(
      { status: record.result, credential: "CLAWPUMP_API_KEY", record },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Provider verification could not be recorded." },
      { status: 500 },
    );
  }
}
