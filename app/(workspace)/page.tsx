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
import { ClusterStamp, ModeStamp } from "@/components/shared/domain-primitives";
import { assuranceLevels, describeAssurance } from "@/lib/assurance";
import { getPublicCapabilities } from "@/lib/env";
import { LANDING_PROOF_POINTS, LANDING_SENTENCE } from "@/lib/landing-copy";

export const metadata: Metadata = { title: "Navis" };

const proofPointIcons = {
  policy: ShieldCheck,
  labels: Tag,
  wallet: Signature,
} as const;

const entryLinks = [
  {
    icon: Compass,
    href: "/agents/atlas",
    eyebrow: "Start here",
    title: "Atlas demo",
    body: "Run a decision, watch the policy approve or reject it, then verify the receipt.",
    primary: true,
  },
  {
    icon: Plus,
    href: "/agents/new",
    eyebrow: "Own mandate",
    title: "Create an agent",
    body: "Define a mandate and risk policy for a wallet you control.",
    primary: false,
  },
  {
    icon: ChartDonut,
    href: "/markets/launch",
    eyebrow: "Sponsor surfaces",
    title: "Markets Launch",
    body: "ClawPump pairs, Meteora DBC profiles and the read-only PreStocks catalogue.",
    primary: false,
  },
] as const;

export default function HomePage() {
  const capabilities = getPublicCapabilities();
  const liveExecution =
    capabilities.devnetExecutionAvailable || capabilities.mainnetExecutionAvailable;

  return (
    <>
      <section className="route-panel landing-hero" aria-labelledby="landing-title">
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
        </div>
        <span className="route-eyebrow">What Navis is</span>
        <h1 id="landing-title" data-testid="landing-sentence">
          {LANDING_SENTENCE}
        </h1>
        <div className="landing-actions">
          <Link className="primary-button" href="/agents/atlas">
            Open the Atlas demo <ArrowRight aria-hidden="true" size={16} />
          </Link>
          <Link className="secondary-button" href="/proofs/demo-proof">
            <Fingerprint aria-hidden="true" size={16} /> Verify a receipt
          </Link>
        </div>
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
        {entryLinks.map(({ icon: Icon, href, eyebrow, title, body, primary }) => (
          <Link
            className="route-panel landing-entry"
            data-primary={primary || undefined}
            href={href}
            key={href}
          >
            <span className="landing-proof-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <span className="route-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{body}</p>
            <span className="landing-entry-cta">
              Open <ArrowRight aria-hidden="true" size={14} />
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
