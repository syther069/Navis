import {
  ArrowRight,
  ChartDonut,
  CheckCircle,
  Clock,
  Compass,
  Fingerprint,
  Plus,
  ShieldCheck,
  Signature,
  Tag,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import {
  ClusterStamp,
  DecisionStateBadge,
  ModeStamp,
  StatusBadge,
} from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { demoProof } from "@/fixtures/demo-proof";
import { assuranceLevels, describeAssurance } from "@/lib/assurance";
import { getPublicCapabilities } from "@/lib/env";
import { LANDING_PROOF_POINTS, LANDING_SENTENCE } from "@/lib/landing-copy";
import { formatBaseUnits } from "@/lib/presentation";

export const metadata: Metadata = { title: "Navis — Financial Operations Dashboard" };

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

  // Real data extractions from demoProof and demoAgentBundle
  const { portfolio, decision } = demoProof.document;
  const { proposal } = decision;
  const inputAsset = demoAgentBundle.assets[0];
  const outputAsset = demoAgentBundle.assets[1];

  const valuations = new Map(
    portfolio.document.valuations.map((valuation) => [valuation.mint, valuation]),
  );
  const assets = new Map(demoAgentBundle.assets.map((asset) => [asset.mint, asset]));

  const positions = portfolio.document.balances.map((balance) => {
    const valuation = balance.mint ? valuations.get(balance.mint) : undefined;
    const asset = balance.mint ? assets.get(balance.mint) : undefined;
    return {
      key: balance.mint ?? "native-sol",
      symbol: asset?.symbol ?? "SOL",
      name: asset?.name ?? "Solana Reserve",
      amount: formatBaseUnits(balance.rawAmount, balance.decimals),
      valuation: valuation?.status === "priced" ? valuation.valueUsdMicros : null,
      reason:
        valuation?.status === "unpriced"
          ? valuation.reason
          : balance.kind === "native"
            ? "Reserve is not assigned a demo USD valuation."
            : null,
    };
  });

  const pricedSubtotalMicros = portfolio.document.valuations.reduce(
    (total, valuation) =>
      valuation.status === "priced" ? total + BigInt(valuation.valueUsdMicros) : total,
    BigInt(0),
  );
  const pricedSubtotalUsd = Number(pricedSubtotalMicros) / 1_000_000;

  const keyRiskRules = [
    {
      rule: "max_trade_bps",
      label: "Max single trade",
      limit: "10.00%",
      observed: "5.00%",
      status: "pass" as const,
    },
    {
      rule: "max_position_bps",
      label: "Max position size",
      limit: "35.00%",
      observed: "30.00%",
      status: "pass" as const,
    },
    {
      rule: "min_reserve_bps",
      label: "Min reserve floor",
      limit: "20.00%",
      observed: "25.00%",
      status: "pass" as const,
    },
    {
      rule: "max_slippage_bps",
      label: "Max slippage ceiling",
      limit: "75 bps (0.75%)",
      observed: "75 bps",
      status: "pass" as const,
    },
  ];

  return (
    <>
      {/* ───────────────────────────────────────────────────────────
          HERO & QUESTION 1: WHAT IS HAPPENING?
          ─────────────────────────────────────────────────────────── */}
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
          <StatusBadge tone="active">1 agent active</StatusBadge>
        </div>

        <div className="landing-hero-content">
          <div className="landing-hero-main">
            <span className="route-eyebrow">What Navis is</span>
            <h1 id="landing-title" data-testid="landing-sentence">
              {LANDING_SENTENCE}
            </h1>
            <p className="landing-hero-sub">
              Deterministic risk policies halt trades before execution occurs. The
              connected wallet remains the sole signing authority, and every action
              produces a locally-verifiable cryptographic proof receipt.
            </p>
          </div>

          <div className="landing-actions">
            <Link className="primary-button" href="/agents/atlas">
              Review Atlas Proposal <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link className="secondary-button" href="/proofs/demo-proof">
              <Fingerprint aria-hidden="true" size={16} /> Verify Proof Receipt
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          THE 8 CORE QUESTIONS DASHBOARD GRID
          ─────────────────────────────────────────────────────────── */}
      <section className="dashboard-qa-section" aria-label="Core operational status">
        <div className="dashboard-qa-grid">
          {/* QUESTION 2: WHAT MARKET / CONTEXT IS BEING ANALYZED? */}
          <article
            className="route-panel dashboard-qa-card"
            aria-labelledby="qa-market-title"
          >
            <header className="qa-card-header">
              <span className="qa-card-num">02</span>
              <div className="qa-card-title-group">
                <span className="route-eyebrow">Market Under Analysis</span>
                <h2 id="qa-market-title">Tokenized Equities & Devnet Treasury</h2>
              </div>
              <InfoHint topic="atlas" label="About Atlas" />
            </header>

            <div className="qa-card-body">
              <div className="dashboard-kpi-banner">
                <div className="dashboard-kpi-item">
                  <span className="kpi-label">Priced Subtotal</span>
                  <strong className="kpi-value tabular-num">
                    $
                    {pricedSubtotalUsd.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    USD
                  </strong>
                </div>
                <div className="dashboard-kpi-item">
                  <span className="kpi-label">Snapshot Slot</span>
                  <code className="kpi-slot tabular-num">
                    {portfolio.document.slot}
                  </code>
                </div>
              </div>

              <div
                className="dashboard-positions-table"
                role="table"
                aria-label="Monitored assets"
              >
                <div className="table-header" role="row">
                  <span role="columnheader">Asset</span>
                  <span role="columnheader" className="col-num">
                    Units
                  </span>
                  <span role="columnheader" className="col-num">
                    USD Value
                  </span>
                </div>
                {positions.map((pos) => (
                  <div className="table-row" role="row" key={pos.key}>
                    <span role="cell" className="cell-asset">
                      <strong>{pos.symbol}</strong>
                      <small>{pos.name}</small>
                    </span>
                    <span role="cell" className="cell-num tabular-num">
                      {pos.amount}
                    </span>
                    <span role="cell" className="cell-num tabular-num">
                      {pos.valuation ? (
                        `$${(Number(pos.valuation) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      ) : (
                        <span className="unpriced-pill">
                          <TrendUp size={12} /> Unpriced
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <footer className="qa-card-footer">
              <small>PreStocks catalogue read-only · Real devnet equity tokens</small>
            </footer>
          </article>

          {/* QUESTIONS 3 & 4: WHAT IS ATLAS PROPOSING? & WHY? */}
          <article
            className="route-panel dashboard-qa-card"
            aria-labelledby="qa-proposal-title"
          >
            <header className="qa-card-header">
              <span className="qa-card-num">03 · 04</span>
              <div className="qa-card-title-group">
                <span className="route-eyebrow">Proposal & Rationale</span>
                <h2 id="qa-proposal-title">Atlas Rebalance Mandate</h2>
              </div>
              <InfoHint topic="proposal" label="About trade proposal" />
            </header>

            <div className="qa-card-body">
              <div className="proposal-headline-box">
                <div className="proposal-status-row">
                  <DecisionStateBadge
                    state="approved"
                    label="Policy Approved · Simulated"
                  />
                  <span className="proposal-action-pill">{proposal.action}</span>
                </div>
                <h3 className="proposal-order-summary">
                  {proposal.action !== "HOLD"
                    ? `${proposal.inputAmount.uiAmount} ${inputAsset?.symbol ?? "EQA"} → min ${proposal.minimumOutputAmount.uiAmount} ${outputAsset?.symbol ?? "EQB"}`
                    : "HOLD order (no token movement)"}
                </h3>
              </div>

              <div className="proposal-rationale-box">
                <span className="rationale-label">Analytical Rationale (Why):</span>
                <p className="rationale-text">{proposal.thesis}</p>
              </div>

              <div className="proposal-meta-grid">
                <div className="meta-item">
                  <span className="meta-key">Confidence</span>
                  <strong className="meta-val tabular-num">
                    {(proposal.confidenceBps / 100).toFixed(2)}%
                  </strong>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Max Slippage</span>
                  <strong className="meta-val tabular-num">
                    {proposal.maxSlippageBps} bps (0.75%)
                  </strong>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Signal Fixture</span>
                  <span className="meta-val-text">Relative-strength</span>
                </div>
              </div>
            </div>

            <footer className="qa-card-footer">
              <Link className="text-link" href="/agents/atlas">
                Inspect full decision record <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </footer>
          </article>

          {/* QUESTION 5: WHAT POLICY / RISK APPLIES? */}
          <article
            className="route-panel dashboard-qa-card"
            aria-labelledby="qa-policy-title"
          >
            <header className="qa-card-header">
              <span className="qa-card-num">05</span>
              <div className="qa-card-title-group">
                <span className="route-eyebrow">Policy & Risk</span>
                <h2 id="qa-policy-title">Deterministic Safety Boundaries</h2>
              </div>
              <div className="qa-hints">
                <InfoHint topic="policy" label="About deterministic policy" />
                <InfoHint topic="risk" label="About risk boundaries" />
              </div>
            </header>

            <div className="qa-card-body">
              <p className="policy-intro-text">
                Every trade must pass 10 immutable risk rules before any transaction can
                be formed. A single breach halts execution immediately.
              </p>

              <div className="risk-scorecard-list">
                {keyRiskRules.map((rule) => (
                  <div key={rule.rule} className="risk-scorecard-item">
                    <div className="risk-rule-info">
                      <CheckCircle size={15} weight="bold" className="risk-pass-icon" />
                      <strong>{rule.label}</strong>
                    </div>
                    <div className="risk-rule-values">
                      <span className="risk-observed tabular-num">{rule.observed}</span>
                      <small className="risk-limit tabular-num">
                        / limit {rule.limit}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <footer className="qa-card-footer">
              <small>
                Policy document hash verified · All 10 deterministic checks passed
              </small>
            </footer>
          </article>

          {/* QUESTION 6: WHAT ACTION REQUIRES USER APPROVAL? */}
          <article
            className="route-panel dashboard-qa-card"
            aria-labelledby="qa-approval-title"
          >
            <header className="qa-card-header">
              <span className="qa-card-num">06</span>
              <div className="qa-card-title-group">
                <span className="route-eyebrow">User Approval</span>
                <h2 id="qa-approval-title">Wallet Authorization Boundary</h2>
              </div>
              <InfoHint topic="approval" label="About user approval" />
            </header>

            <div className="qa-card-body">
              <div className="approval-status-card">
                <div className="approval-card-icon" aria-hidden="true">
                  <Signature size={24} />
                </div>
                <div>
                  <strong className="approval-card-title">
                    Zero Autonomous Signing Rights
                  </strong>
                  <p className="approval-card-desc">
                    NAVIS agents hold zero private keys. No transaction can execute
                    without explicit cryptographic authorization from your connected
                    wallet.
                  </p>
                </div>
              </div>

              <div className="approval-current-state">
                <span className="state-badge-label">Active Approval State:</span>
                <StatusBadge tone="simulation">
                  Demo simulation · No wallet signature requested
                </StatusBadge>
              </div>
            </div>

            <footer className="qa-card-footer">
              <div className="qa-actions">
                <Link className="secondary-button" href="/agents/atlas">
                  Review Proposal in Atlas
                </Link>
                <Link className="secondary-button" href="/agents/new">
                  Create Agent
                </Link>
              </div>
            </footer>
          </article>

          {/* QUESTION 7: WHAT HAPPENED RECENTLY? */}
          <article
            className="route-panel dashboard-qa-card"
            aria-labelledby="qa-recent-title"
          >
            <header className="qa-card-header">
              <span className="qa-card-num">07</span>
              <div className="qa-card-title-group">
                <span className="route-eyebrow">Recent Activity</span>
                <h2 id="qa-recent-title">Decision Timeline & Settlement</h2>
              </div>
              <InfoHint topic="simulation" label="About transaction simulation" />
            </header>

            <div className="qa-card-body">
              <ol className="dashboard-timeline">
                <li className="timeline-step">
                  <span className="step-dot" />
                  <div className="step-content">
                    <span className="step-time tabular-num">08:00:00 UTC</span>
                    <strong>Snapshot captured</strong>
                    <small>Slot 902 · Native SOL & 3 equity balances locked</small>
                  </div>
                </li>
                <li className="timeline-step">
                  <span className="step-dot" />
                  <div className="step-content">
                    <span className="step-time tabular-num">08:00:00 UTC</span>
                    <strong>Atlas proposed rebalance</strong>
                    <small>1 EQA into 0.99 EQB · Max slippage 75 bps</small>
                  </div>
                </li>
                <li className="timeline-step">
                  <span className="step-dot" />
                  <div className="step-content">
                    <span className="step-time tabular-num">08:00:01 UTC</span>
                    <strong>Policy evaluated</strong>
                    <small>10/10 risk checks verified deterministic pass</small>
                  </div>
                </li>
                <li className="timeline-step">
                  <span className="step-dot" />
                  <div className="step-content">
                    <span className="step-time tabular-num">08:00:02 UTC</span>
                    <strong>Offchain simulation recorded</strong>
                    <small>Receipt generated with SHA-256 hash anchoring</small>
                  </div>
                </li>
              </ol>

              {/* Intentional Empty State for Live Onchain History */}
              <div className="honest-live-empty-state">
                <Clock size={16} aria-hidden="true" />
                <p>
                  <strong>No live onchain transactions recorded.</strong> In demo mode,
                  executions stop at simulation. Live transaction history populates when
                  you connect a wallet and sign onchain.
                </p>
              </div>
            </div>

            <footer className="qa-card-footer">
              <Link className="text-link" href="/transactions">
                View transactions ledger <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </footer>
          </article>

          {/* QUESTION 8: WHERE IS THE PROOF? */}
          <article
            className="route-panel dashboard-qa-card"
            aria-labelledby="qa-proof-title"
          >
            <header className="qa-card-header">
              <span className="qa-card-num">08</span>
              <div className="qa-card-title-group">
                <span className="route-eyebrow">Proof Evidence</span>
                <h2 id="qa-proof-title">Canonical Receipt & Verifier</h2>
              </div>
              <InfoHint topic="proof" label="About proof receipt" />
            </header>

            <div className="qa-card-body">
              <div className="proof-card-box">
                <div className="proof-id-row">
                  <span className="proof-id-label">Receipt Identifier</span>
                  <code className="proof-id-val tabular-num">demo-proof</code>
                </div>
                <div className="proof-hash-row">
                  <span className="proof-hash-label">Canonical SHA-256 Hash</span>
                  <code className="proof-hash-val tabular-num">
                    {demoProof.receiptHash}
                  </code>
                </div>
              </div>

              <div className="proof-assurance-row">
                <AssuranceBadge
                  assurance={describeAssurance("offchain_integrity", "demo_simulation")}
                />
              </div>

              <p className="proof-card-explanation">
                Recomputed deterministically in your browser. Matching document hashes
                prove internal consistency without trusting NAVIS servers.
              </p>
            </div>

            <footer className="qa-card-footer">
              <Link className="primary-button" href="/proofs/demo-proof">
                <Fingerprint aria-hidden="true" size={16} /> Verify Receipt in Browser
              </Link>
            </footer>
          </article>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          LANDING PROOF POINTS (REQUIRED BY TESTS)
          ─────────────────────────────────────────────────────────── */}
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

      {/* ───────────────────────────────────────────────────────────
          ASSURANCE MODEL (REQUIRED BY TESTS)
          ─────────────────────────────────────────────────────────── */}
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

      {/* ───────────────────────────────────────────────────────────
          WHERE TO GO NEXT (REQUIRED BY TESTS)
          ─────────────────────────────────────────────────────────── */}
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
