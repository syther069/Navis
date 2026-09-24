import { NextRequest, NextResponse } from "@workspace/navis-core/server/http";

import { readSessionToken, SESSION_COOKIE_NAME } from "@workspace/navis-core/lib/auth/server";
import { requireWalletQuota } from "@workspace/navis-core/lib/auth/operation-quota";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import { env } from "@workspace/navis-core/lib/env";
import {
  ClawPumpError,
  describeClawPumpError,
} from "@workspace/navis-core/lib/integrations/clawpump/client";
import { createClawPumpClient } from "@workspace/navis-core/lib/integrations/clawpump/server";
import { listAttachableClawPumpAgents } from "@workspace/navis-core/lib/services/clawpump-agents";

/** ClawPump agents registered to the signed-in wallet and not yet claimed by a Navis agent. Public identifiers only. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate the wallet first." },
      { status: 401 },
    );
  }
  const quota = await requireWalletQuota(session, "clawpump.agents");
  if (quota) return quota;
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
      userWallet: session.wallet,
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
