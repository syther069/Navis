import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";

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
    return NextResponse.json(pool, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Meteora pool state could not be read from the configured RPC." },
      { status: 502 },
    );
  }
}
