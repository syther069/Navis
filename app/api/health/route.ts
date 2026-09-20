import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db/client";
import { env, getPublicCapabilities } from "@/lib/env";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  if (!env.databaseUrl) {
    return { status: "not_configured" as const };
  }

  try {
    await getDatabase().execute(sql`select 1`);
    return { status: "ok" as const };
  } catch {
    return { status: "unreachable" as const };
  }
}

export async function GET() {
  const database = await checkDatabase();
  const capabilities = getPublicCapabilities();
  const healthy =
    database.status !== "unreachable" &&
    (env.executionMode === "demo" || Boolean(env.solanaRpcUrl));

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      mode: capabilities.mode,
      cluster: capabilities.cluster,
      services: {
        database,
        solanaRpc: {
          status: env.solanaRpcUrl ? "configured" : "not_configured",
        },
        walletSessions: {
          status:
            capabilities.walletAuthenticationConfigured &&
            capabilities.persistenceConfigured
              ? "configured"
              : "not_configured",
        },
        clawpump: {
          status: capabilities.clawpumpConfigured ? "configured" : "not_configured",
        },
        meteora: {
          status: capabilities.meteoraConfigured ? "configured" : "not_configured",
        },
        prestocks: {
          status: capabilities.prestocksConfigured ? "configured" : "not_configured",
        },
        ai: {
          status: capabilities.aiConfigured ? "configured" : "not_configured",
        },
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
