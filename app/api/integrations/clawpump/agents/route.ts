import { NextRequest, NextResponse } from "next/server";

import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import {
  ClawPumpError,
  describeClawPumpError,
} from "@/lib/integrations/clawpump/client";
import { createClawPumpClient } from "@/lib/integrations/clawpump/server";
import { listAttachableClawPumpAgents } from "@/lib/services/clawpump-agents";

/** Key-owned ClawPump agents not yet claimed by a Navis agent. Public identifiers only. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate the wallet first." },
      { status: 401 },
    );
  }
  if (!env.clawpumpApiKey) {
    return NextResponse.json(
      { error: "ClawPump is not configured (CLAWPUMP_API_KEY)." },
      { status: 503 },
    );
  }
  if (!env.databaseUrl) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }
  try {
    const result = await listAttachableClawPumpAgents({
      client: createClawPumpClient(),
      database: getDatabase(),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ClawPumpError
            ? describeClawPumpError(error)
            : "ClawPump agent listing failed.",
      },
      { status: 502 },
    );
  }
}
