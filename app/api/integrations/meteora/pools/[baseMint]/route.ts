import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db/client";
import { marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";
import { summarizeMeteoraLaunchEvidence } from "@/lib/services/meteora-reconciliation";

/**
 * Navis's own launch record for this pool, when one exists. Read separately
 * from the onchain state so a database outage never hides live pool data.
 */
async function loadLaunchEvidence(baseMint: string) {
  if (!env.databaseUrl) return null;
  try {
    const [launch] = await getDatabase()
      .select({
        id: marketLaunches.id,
        status: marketLaunches.status,
        metadata: marketLaunches.metadata,
        transactionSignature: marketLaunches.transactionSignature,
      })
      .from(marketLaunches)
      .where(
        and(
          eq(marketLaunches.provider, "meteora"),
          eq(marketLaunches.baseMint, baseMint),
          eq(marketLaunches.cluster, env.cluster),
        ),
      )
      .orderBy(desc(marketLaunches.createdAt))
      .limit(1);
    if (!launch) return null;
    return {
      launchId: launch.id,
      status: launch.status,
      evidence: summarizeMeteoraLaunchEvidence(launch.status, launch.metadata),
    };
  } catch {
    return { launchId: null, status: "unavailable", evidence: null };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ baseMint: string }> },
) {
  if (!env.solanaRpcUrl) {
    return NextResponse.json(
      { error: "Solana RPC is not configured for Meteora reads." },
      { status: 503 },
    );
  }

  const { baseMint } = await context.params;
  try {
    new PublicKey(baseMint);
  } catch {
    return NextResponse.json({ error: "Base mint is invalid." }, { status: 400 });
  }

  try {
    const pool = await createServerMeteoraDbcClient().getPoolByBaseMint(baseMint);
    if (!pool) {
      return NextResponse.json(
        { error: "No Meteora DBC pool was found for this base mint." },
        { status: 404 },
      );
    }
    const launch = await loadLaunchEvidence(baseMint);
    return NextResponse.json(
      { ...pool, launch },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Meteora pool state could not be read from the configured RPC." },
      { status: 502 },
    );
  }
}
