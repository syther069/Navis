import {
  Database,
  HandPalm,
  ShieldWarning,
  Signature,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { FieldRow, RouteHeader } from "@/components/route-primitives";

export const metadata: Metadata = { title: "Risk and privacy disclosures" };

export default function DisclosuresPage() {
  return (
    <>
      <RouteHeader
        eyebrow="Compliance surface"
        title="Risk and privacy disclosures"
        description="Plain-language boundaries for the Navis demo, tokenized exposure, wallet sessions, and evidence claims."
        meta="Visible before submission"
      />

      <div className="route-grid disclosures-grid">
        <section className="route-panel">
          <div className="panel-heading">
            <ShieldWarning aria-hidden="true" size={20} />
            <div>
              <span>Product boundary</span>
              <h2>Not brokerage or investment advice</h2>
            </div>
          </div>
          <p className="route-copy">
            Navis is a hackathon prototype for governed agent workflows. It is not a
            broker, exchange, investment adviser, custodian, or legal/tax adviser. The
            demo agent and deterministic fixtures do not recommend securities, promise
            returns, or prove financial performance.
          </p>
          <div className="field-list">
            <FieldRow label="Demo performance" value="Not real" />
            <FieldRow label="Custody claim" value="None" />
            <FieldRow label="Advice claim" value="None" />
          </div>
        </section>

        <section className="route-panel route-panel-muted">
          <div className="panel-heading">
            <HandPalm aria-hidden="true" size={20} />
            <div>
              <span>Tokenized exposure</span>
              <h2>Eligibility and PreStocks limits</h2>
            </div>
          </div>
          <p className="route-copy">
            PreStocks assets, when shown, are presented as economic-exposure tokens
            only. They are not described as shares and do not imply ownership, voting
            rights, transfer rights, issuer affiliation, or guaranteed liquidity.
            PreStocks disclosures state that access is unavailable to U.S. persons and
            other ineligible persons. Navis therefore keeps PreStocks read-only and
            exposes no buy, sell, launch, or issuance path.
          </p>
          <div className="field-list">
            <FieldRow label="PreStocks action path" value="Read-only" />
            <FieldRow label="Restricted-user behavior" value="No action exposed" />
            <FieldRow label="Ticker-as-mint fallback" value="Blocked by schema" />
          </div>
        </section>

        <section className="route-panel">
          <div className="panel-heading">
            <Signature aria-hidden="true" size={20} />
            <div>
              <span>Wallet authority</span>
              <h2>Execution and proof evidence</h2>
            </div>
          </div>
          <p className="route-copy">
            Wallet connection does not give Navis custody. Value-moving transactions
            require an explicit wallet signature. Demo receipts are simulations and
            never receive transaction-looking strings, explorer links, paid fees, or
            onchain hash anchoring. Real devnet/mainnet evidence is shown only after
            Navis stores a real submitted signature and cluster-qualified explorer URL.
          </p>
          <div className="field-list">
            <FieldRow label="Demo receipt anchoring" value="Offchain only" />
            <FieldRow label="Explorer links" value="Real signatures only" />
            <FieldRow label="Mainnet default" value="Disabled" />
          </div>
        </section>

        <section className="route-panel route-panel-muted">
          <div className="panel-heading">
            <Database aria-hidden="true" size={20} />
            <div>
              <span>Privacy and storage</span>
              <h2>Data collected by this prototype</h2>
            </div>
          </div>
          <p className="route-copy">
            Navis may store wallet public keys, wallet-auth nonce hashes, session
            records, disclosure timestamps, agent configuration, strategy/policy
            versions, decisions, execution attempts, external request metadata, and
            proof receipts when persistence is configured. It must not store private
            keys or seed phrases. Server-only secrets belong in the deployment platform
            and must not be exposed in client code, screenshots, logs, or submission
            materials.
          </p>
          <div className="field-list">
            <FieldRow label="Private keys" value="Never stored" />
            <FieldRow label="Wallet public key" value="Stored only with persistence" />
            <FieldRow label="Secrets in client bundle" value="Not allowed" />
          </div>
        </section>
      </div>
    </>
  );
}
