import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";
import { createSolanaRpcClient } from "@/lib/integrations/solana/server";
import {
  MeteoraReconciliationError,
  reconcileMeteoraLaunch,
} from "@/lib/services/meteora-reconciliation";

const requestSchema = z.object({
  launchId: z.uuid(),
});

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return json({ error: "Untrusted request origin." }, 403);
  }

  if (!env.databaseUrl) {
    return json({ error: "Persistent storage is required before confirmation." }, 503);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return json(
      { error: "Authenticate a connected wallet before confirming a Meteora launch." },
      401,
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora confirmation." },
      400,
    );
  }

  const database = getDatabase();
  try {
    // Ownership check: the launch must belong to an agent owned by this session.
    const [owned] = await database
      .select({ id: marketLaunches.id })
      .from(marketLaunches)
      .innerJoin(agents, eq(agents.id, marketLaunches.agentId))
      .where(
        and(
          eq(marketLaunches.id, parsed.data.launchId),
          eq(marketLaunches.provider, "meteora"),
          eq(agents.ownerId, session.userId),
        ),
      )
      .limit(1);
    if (!owned) {
      return json({ error: "Meteora launch was not found for this wallet." }, 404);
    }

    const rpc = createSolanaRpcClient();
    const dbc = createServerMeteoraDbcClient();
    const result = await reconcileMeteoraLaunch(
      owned.id,
      {
        rpc,
        readConfig: (address) => dbc.readConfigAccount(address),
        readPool: (address) => dbc.readPoolAccount(address),
      },
      database,
      { cluster: env.cluster },
    );
    return json(
      {
        launch: result.launch,
        confirmation: result.confirmation.label ?? result.confirmation.state,
        evidence: result.confirmation,
      },
      result.httpStatus,
    );
  } catch (error) {
    if (error instanceof MeteoraReconciliationError) {
      return json({ error: error.message }, error.status);
    }
    return json(
      { error: "Meteora confirmation evidence is temporarily unavailable." },
      502,
    );
  }
}
