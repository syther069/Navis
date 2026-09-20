import { CheckCircle, MinusCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { FieldRow, RouteHeader } from "@/components/route-primitives";
import { getPublicCapabilities } from "@/lib/env";

export const metadata: Metadata = { title: "Capabilities" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const capabilities = getPublicCapabilities();
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
              value={capabilities.clawpumpConfigured ? "Configured" : "Unavailable"}
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
