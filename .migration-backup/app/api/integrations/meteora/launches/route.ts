import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  projectSavedMeteoraLaunch,
  type MeteoraRecoveryLaunchRow,
} from "@/lib/integrations/meteora/recovery";

const privateHeaders = { "Cache-Control": "private, no-store" };

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await readSessionToken(token) : null;
    if (!session) {
      return json({ error: "Authenticate before recovering Meteora launches." }, 401);
    }
    if (!env.databaseUrl) {
      return json(
        { error: "Meteora launch recovery requires a configured database." },
        503,
      );
    }

    const rows = await getDatabase()
      .select({
        id: marketLaunches.id,
        agentId: marketLaunches.agentId,
        cluster: marketLaunches.cluster,
        status: marketLaunches.status,
        transactionSignature: marketLaunches.transactionSignature,
        baseMint: marketLaunches.baseMint,
        poolAddress: marketLaunches.poolAddress,
        metadata: marketLaunches.metadata,
      })
      .from(marketLaunches)
      .innerJoin(agents, eq(agents.id, marketLaunches.agentId))
      .where(
        and(
          eq(marketLaunches.provider, "meteora"),
          eq(marketLaunches.cluster, env.cluster),
          eq(agents.ownerId, session.userId),
          eq(marketLaunches.payoutWallet, session.wallet),
        ),
      )
      .orderBy(desc(marketLaunches.updatedAt))
      .limit(20);

    return json(
      {
        launches: (rows as MeteoraRecoveryLaunchRow[]).map(projectSavedMeteoraLaunch),
      },
      200,
    );
  } catch {
    return json({ error: "Meteora launches could not be recovered." }, 503);
  }
}
