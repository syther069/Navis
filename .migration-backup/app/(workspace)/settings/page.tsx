import { CheckCircle, MinusCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { FieldRow, RouteHeader } from "@/components/route-primitives";
import { env, getPublicCapabilities } from "@/lib/env";
import { getDatabase } from "@/lib/db/client";
import { getLatestClawPumpVerification } from "@/lib/services/clawpump-verification";

export const metadata: Metadata = { title: "Capabilities" };
export const dynamic = "force-dynamic";

async function describeClawPump() {
  if (!env.clawpumpApiKey) {
    return {
      value: "Provider not configured",
      detail:
        "Set CLAWPUMP_API_KEY, a cpk_ Partner key from clawpump.tech/developers, server-side only.",
    };
  }
  const record = env.databaseUrl
    ? await getLatestClawPumpVerification(getDatabase()).catch(() => null)
    : null;
  if (!record) {
    return {
      value: "Key present, not yet verified",
      detail:
        "No stored verification record. Open Markets to run a real read-only request.",
    };
  }
  if (record.result === "connected") {
    return {
      value: "Provider connected",
      detail: `GET ${record.endpoint} answered HTTP ${record.httpStatus} at ${record.providerTimestamp ?? record.checkedAt}, request ${record.requestId}. ${
        record.agentAccess === "forbidden"
          ? "GET /agents refused (HTTP 403): key not linked to an account, so agent operations are unavailable."
          : record.agentAccess === "unknown"
            ? "GET /agents did not answer; agent access not determined on this attempt."
            : `${record.agentCount} agent(s) under the key.`
      }`,
    };
  }
  return {
    value: record.result === "unauthorised" ? "Key rejected" : "Provider unreachable",
    detail: `${record.safeError ?? "Verification failed."} Checked ${record.checkedAt}.`,
  };
}

export default async function SettingsPage() {
  const capabilities = getPublicCapabilities();
  const clawpump = await describeClawPump();
  return (
    <>
      <RouteHeader
        eyebrow="System status"
        title="Capabilities"
        description="A plain account of what this Navis instance can and cannot do."
        meta={`${capabilities.mode} mode`}
      />
      <div className="route-grid settings-grid">
        <section className="route-panel">
          <div className="panel-heading">
            <CheckCircle aria-hidden="true" size={20} />
            <div>
              <span>Active foundation</span>
              <h2>Interface safeguards</h2>
            </div>
          </div>
          <div className="field-list">
            <FieldRow label="Runtime mode" value={capabilities.mode} />
            <FieldRow label="Solana cluster" value={capabilities.cluster} />
            <FieldRow label="Demo data" value="Explicitly labelled" />
            <FieldRow label="Wallet connection" value="Wallet Standard enabled" />
            <FieldRow
              label="Authentication origin"
              value={capabilities.appOriginConfigured ? "Configured" : "Not configured"}
              detail="Production wallet sessions require the exact published HTTPS origin."
            />
            <FieldRow
              label="Wallet sessions"
              value={
                capabilities.walletAuthenticationConfigured &&
                capabilities.persistenceConfigured
                  ? "Configured"
                  : "Unavailable"
              }
            />
            <FieldRow
              label="Mainnet execution"
              value={capabilities.mainnetExecutionAvailable ? "Enabled" : "Disabled"}
            />
          </div>
        </section>
        <section className="route-panel route-panel-muted">
          <div className="panel-heading">
            <MinusCircle aria-hidden="true" size={20} />
            <div>
              <span>External integrations</span>
              <h2>External capabilities</h2>
            </div>
          </div>
          <div className="field-list">
            <FieldRow
              label="Persistence"
              value={capabilities.persistenceConfigured ? "Configured" : "Unavailable"}
            />
            <FieldRow
              label="ClawPump"
              value={clawpump.value}
              detail={clawpump.detail}
            />
            <FieldRow
              label="Meteora DBC"
              value={
                capabilities.meteoraConfigured
                  ? "Onchain read/write adapter available"
                  : "RPC required"
              }
              detail="Config and pool builders remain wallet-signed and execution-gated."
            />
            <FieldRow
              label="PreStocks"
              value={
                capabilities.prestocksConfigured ? "API URL configured" : "Unavailable"
              }
              detail="Catalogue actions require verified terms before value movement."
            />
            <FieldRow
              label="AI decision provider"
              value={capabilities.aiConfigured ? "Demo provider active" : "Unavailable"}
            />
          </div>
        </section>
        <section className="route-panel settings-wide-panel">
          <div className="panel-heading">
            <ShieldCheck aria-hidden="true" size={20} />
            <div>
              <span>Safety boundary</span>
              <h2>Execution posture</h2>
            </div>
          </div>
          <p className="route-copy">
            Demo receipts can be hash-verified but can never carry a transaction
            signature or explorer link. Devnet and mainnet execution remain unavailable
            unless their explicit flag, matching cluster, RPC, authenticated wallet, and
            persistent evidence store are all configured. Meteora and ClawPump launch
            records use the same rule: no explorer link appears until Navis stores a
            real submitted signature.
          </p>
        </section>
      </div>
    </>
  );
}
