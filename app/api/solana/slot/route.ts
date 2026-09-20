import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

// Read-only cluster probe. It never signs, never sends, and never touches
// any account. It exists so the first screen can show one true onchain fact.
export async function GET() {
  if (!env.solanaRpcUrl) {
    return NextResponse.json(
      { status: "not_configured", cluster: env.cluster },
      { headers },
    );
  }

  try {
    const connection = new Connection(env.solanaRpcUrl, {
      commitment: "confirmed",
      disableRetryOnRateLimit: true,
    });
    const slot = await Promise.race([
      connection.getSlot("confirmed"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC timed out after 4s")), 4000),
      ),
    ]);

    return NextResponse.json(
      { status: "ok", cluster: env.cluster, slot, checkedAt: new Date().toISOString() },
      { headers },
    );
  } catch {
    // Never echo the provider error: web3.js messages can include the RPC URL.
    return NextResponse.json(
      { status: "unreachable", cluster: env.cluster },
      { status: 503, headers },
    );
  }
}
