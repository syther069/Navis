import {
  ArrowRight,
  ChartDonut,
  Compass,
  Fingerprint,
  Plus,
  ShieldCheck,
  Signature,
  Tag,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import {
  ClusterStamp,
  ModeStamp,
  StatusBadge,
} from "@/components/shared/domain-primitives";
import { assuranceLevels, describeAssurance } from "@/lib/assurance";
import { getPublicCapabilities } from "@/lib/env";
import { LANDING_PROOF_POINTS, LANDING_SENTENCE } from "@/lib/landing-copy";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Governed Solana equity-agent workspace. Policy-checked proposals, wallet authorization, and hash-verifiable receipts.",
};

const proofPointIcons = {
  policy: ShieldCheck,
  labels: Tag,
  wallet: Signature,
} as const;

export default function HomePage() {
  const capabilities = getPublicCapabilities();
  const liveExecution =
    capabilities.devnetExecutionAvailable || capabilities.mainnetExecutionAvailable;
  const executionLabel = capabilities.mainnetExecutionAvailable
    ? "Mainnet gated"
    : capabilities.devnetExecutionAvailable
      ? "Devnet signing"
      : "Simulation only";

  return (
    <div className="command-root" aria-label="Navis workspace overview">
      <section
        className="route-panel landing-hero command-hero"
        aria-labelledby="landing-title"
      >
        <div className="landing-banner" role="status" data-testid="landing-mode-banner">
          <ModeStamp mode={capabilities.mode} />
          <ClusterStamp cluster={capabilities.cluster} />
          <span className="landing-banner-copy">
            {capabilities.mode === "demo"
              ? "Demo mode: decisions are simulated and receipts stay offchain."
              : liveExecution
                ? `${capabilities.mode} mode: wallet-signed execution is enabled on ${capabilities.cluster}.`
                : `${capabilities.mode} mode: live execution is configured off, so runs stay simulated.`}
          </span>
          <StatusBadge tone="neutral">Atlas demo agent</StatusBadge>
        </div>

        <div className="landing-hero-content">
          <div className="landing-hero-main">
            <span className="route-eyebrow">Command overview</span>
            <h1 id="landing-title" data-testid="landing-sentence">
              {LANDING_SENTENCE}
            </h1>
            <p className="landing-hero-sub">
              Atlas can propose. Deterministic policy can reject. Only a connected
              wallet can authorize value movement. Receipts stay inspectable.
            </p>
          </div>

          <div className="landing-actions">
            <Link className="primary-button" href="/agents/atlas">
              Open Atlas <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link className="secondary-button" href="/proofs/demo-proof">
              <Fingerprint aria-hidden="true" size={16} /> Verify demo receipt
            </Link>
          </div>
        </div>
      </section>

      <section className="command-metrics" aria-label="Live system posture">
        <article className="command-metric">
          <span>Mode</span>
          <strong>{capabilities.mode}</strong>
        </article>
        <article className="command-metric">
          <span>Cluster</span>
          <strong className="tabular-num">{capabilities.cluster}</strong>
        </article>
        <article className="command-metric">
          <span>Execution</span>
          <strong>{executionLabel}</strong>
        </article>
        <article className="command-metric">
          <span>Mainnet broadcast</span>
          <strong>Blocked</strong>
        </article>
      </section>

      <section className="landing-proof-points" aria-label="Proof points">
        {LANDING_PROOF_POINTS.map(({ id, title, body }) => {
          const Icon = proofPointIcons[id];
          return (
            <article className="route-panel landing-proof-point" key={id}>
              <span className="landing-proof-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          );
        })}
      </section>

      <div className="command-split">
        <section
          className="route-panel landing-assurance"
          aria-labelledby="assurance-title"
        >
          <div className="panel-heading">
            <Tag aria-hidden="true" size={20} />
            <div>
              <span>Assurance model</span>
              <h2 id="assurance-title">Three levels, never upgraded by the agent</h2>
            </div>
          </div>
          <ol className="landing-assurance-levels">
            {assuranceLevels.map((level, index) => {
              const assurance = describeAssurance(
                level,
                level === "offchain_integrity" ? "demo_simulation" : "live_onchain",
              );
              return (
                <li key={level}>
                  <span className="landing-assurance-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <AssuranceBadge assurance={assurance} compact />
                    <p>{assurance.explanation}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="route-copy">
            The prepared Atlas demo and every demo-mode run stop at offchain integrity.
            Live receipts only reach wallet authorization once a wallet has signed, and
            onchain settlement once a signature is confirmed with a slot.
          </p>
        </section>

        <nav className="landing-entries" aria-label="Where to go next">
          <Link
            className="route-panel landing-entry"
            data-primary="true"
            href="/agents/atlas"
          >
            <span className="landing-proof-icon" aria-hidden="true">
              <Compass size={20} />
            </span>
            <span className="route-eyebrow">Start here</span>
            <h2>Atlas demo</h2>
            <p>
              Run a decision, watch the policy approve or reject it, then verify the
              receipt.
            </p>
            <span className="landing-entry-cta">
              Open <ArrowRight aria-hidden="true" size={14} />
            </span>
          </Link>

          <Link className="route-panel landing-entry" href="/agents/new">
            <span className="landing-proof-icon" aria-hidden="true">
              <Plus size={20} />
            </span>
            <span className="route-eyebrow">Own mandate</span>
            <h2>Create an agent</h2>
            <p>Define a mandate and risk policy for a wallet you control.</p>
            <span className="landing-entry-cta">
              Open <ArrowRight aria-hidden="true" size={14} />
            </span>
          </Link>

          <Link className="route-panel landing-entry" href="/markets/launch">
            <span className="landing-proof-icon" aria-hidden="true">
              <ChartDonut size={20} />
            </span>
            <span className="route-eyebrow">Sponsor surfaces</span>
            <h2>Markets Launch</h2>
            <p>
              ClawPump pairs, Meteora DBC profiles and the read-only PreStocks
              catalogue.
            </p>
            <span className="landing-entry-cta">
              Open <ArrowRight aria-hidden="true" size={14} />
            </span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
