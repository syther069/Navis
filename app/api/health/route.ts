import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db/client";
import { classifyDatabaseError, logDatabaseError } from "@/lib/db/errors";
import { env, getPublicCapabilities } from "@/lib/env";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  if (!env.databaseUrl) {
    return { status: "not_configured" as const };
  }

  try {
    const result = await getDatabase().execute<{
      schema_ready: boolean;
      guards_ready: boolean;
    }>(sql`
      select
        (select count(*) = 17 from information_schema.tables
          where table_schema = 'public' and table_name in (
            'users', 'agents', 'assets', 'agent_asset_permissions',
            'strategy_versions', 'risk_policy_versions', 'treasury_accounts',
            'portfolio_snapshots', 'decisions', 'policy_evaluations',
            'execution_attempts', 'proof_receipts', 'market_launches',
            'external_calls', 'auth_challenges', 'execution_events',
            'execution_intents'
          ))
          and exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'agents'
              and column_name = 'client_request_id') as schema_ready,
        (select count(*) = 7 from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and not t.tgisinternal
            and t.tgenabled in ('O', 'A') and t.tgname in (
              'strategy_versions_immutable', 'risk_policy_versions_immutable',
              'proof_receipts_append_only', 'portfolio_snapshots_immutable',
              'decisions_evidence_immutable', 'execution_events_immutable',
              'policy_evaluations_immutable'
            )) as guards_ready
    `);
    const readiness = result.rows[0];
    if (!readiness?.schema_ready || !readiness.guards_ready) {
      return {
        status: "schema_incomplete" as const,
        tablesReady: Boolean(readiness?.schema_ready),
        immutabilityGuardsReady: Boolean(readiness?.guards_ready),
      };
    }
    return {
      status: "ok" as const,
      tablesReady: true,
      immutabilityGuardsReady: true,
    };
  } catch (error) {
    const classified = classifyDatabaseError(error);
    logDatabaseError("health", classified);
    // Only the classification leaves the server: no host, no driver text.
    if (classified.code === "database_timeout") {
      return { status: "unreachable" as const, reason: "timeout" as const };
    }
    if (classified.code === "database_schema_mismatch") {
      return {
        status: "schema_incomplete" as const,
        tablesReady: false,
        immutabilityGuardsReady: false,
      };
    }
    return { status: "unreachable" as const, reason: "connection" as const };
  }
}

export async function GET() {
  const database = await checkDatabase();
  const capabilities = getPublicCapabilities();
  const healthy =
    database.status !== "unreachable" &&
    database.status !== "schema_incomplete" &&
    (env.executionMode === "demo" || Boolean(env.solanaRpcUrl));

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      mode: capabilities.mode,
      cluster: capabilities.cluster,
      services: {
        database,
        authenticationOrigin: {
          status: capabilities.appOriginConfigured ? "configured" : "not_configured",
        },
        solanaRpc: {
          status: env.solanaRpcUrl ? "configured" : "not_configured",
        },
        walletSessions: {
          status:
            capabilities.walletAuthenticationConfigured && database.status === "ok"
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
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
