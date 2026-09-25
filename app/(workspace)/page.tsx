import {
  ArrowRight,
  ChartDonut,
  CheckCircle,
  Clock,
  Compass,
  Cpu,
  Database,
  Eye,
  FileCode,
  Fingerprint,
  Lightning,
  LockKey,
  PaperPlaneTilt,
  Plus,
  Scales,
  ShieldCheck,
  ShieldWarning,
  Signature,
  SlidersHorizontal,
  Tag,
  TrendUp,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import {
  ClusterStamp,
  ModeStamp,
  StatusBadge,
} from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import { CoreWorkflowDiagram } from "@/components/landing/core-workflow";
import { IntegrationsGrid } from "@/components/landing/integrations-grid";
import { ActualProductDemo } from "@/components/landing/product-demo";
import { FaqSection } from "@/components/landing/faq-section";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { demoProof } from "@/fixtures/demo-proof";
import { assuranceLevels, describeAssurance } from "@/lib/assurance";
import { getPublicCapabilities } from "@/lib/env";
import { LANDING_PROOF_POINTS, LANDING_SENTENCE } from "@/lib/landing-copy";

export const metadata: Metadata = {
  title: "Navis — Financial Operations & Risk Governance Terminal",
  description:
    "Governed Solana financial operations workspace for autonomous equity agents. Deterministic policy enforcement, non-custodial wallet authorization, and SHA-256 verifiable receipts.",
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

  return (
    <div className="landing-page-root" aria-label="Navis public product experience">
      {/* ───────────────────────────────────────────────────────────
          SECTION 1: HERO
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
            <span className="route-eyebrow">Financial Operations & Risk Governance</span>
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
            <Link className="secondary-button" href="/onboarding">
              <Compass aria-hidden="true" size={16} /> Guided Onboarding
            </Link>
            <Link className="secondary-button" href="/proofs/demo-proof">
              <Fingerprint aria-hidden="true" size={16} /> Verify Proof Receipt
            </Link>
          </div>

          {/* Factual Operational Strip (No fake metrics) */}
          <div className="hero-operational-strip">
            <div className="strip-item">
              <span className="strip-label">Active Mandate</span>
              <strong className="strip-value">Atlas (Demo Agent)</strong>
            </div>
            <div className="strip-item">
              <span className="strip-label">Deterministic Invariants</span>
              <strong className="strip-value tabular-num">10/10 Enforced</strong>
            </div>
            <div className="strip-item">
              <span className="strip-label">Private Keys Held</span>
              <strong className="strip-value tabular-num">0 (Non-custodial)</strong>
            </div>
            <div className="strip-item">
              <span className="strip-label">Execution Baseline</span>
              <strong className="strip-value">
                {capabilities.mode === "demo" ? "Simulation Only" : "Devnet RPC"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 2: WHAT NAVIS IS & WHY IT EXISTS
          ─────────────────────────────────────────────────────────── */}
      <section className="landing-section" aria-labelledby="what-is-navis-title">
        <header className="section-header">
          <div className="section-title-wrap">
            <span className="route-eyebrow">Architecture & Motivation</span>
            <h2 id="what-is-navis-title" className="section-title">
              What NAVIS is and why it exists
            </h2>
          </div>
          <p className="section-desc">
            NAVIS is an execution and risk governance layer for autonomous equity agents on
            Solana. It bridges agent intent with onchain settlement through deterministic
            policy enforcement, non-custodial wallet authorization, and locally verifiable
            proof receipts.
          </p>
        </header>

        <div className="why-navis-grid">
          <article className="route-panel why-navis-card problem-card">
            <div className="card-header-icon" aria-hidden="true">
              <ShieldWarning size={22} />
            </div>
            <span className="route-eyebrow">The Core Problem</span>
            <h3>Unconstrained AI agents cannot manage capital safely</h3>
            <p>
              Granting autonomous LLMs direct access to private keys or signing authority
              inevitably leads to severe financial hazards: hallucinated token mints,
              unbounded slippage, prompt injection, and catastrophic treasury drain. An AI
              agent should propose ideas, never authorize state transitions unilaterally.
            </p>
          </article>

          <article className="route-panel why-navis-card solution-card">
            <div className="card-header-icon" aria-hidden="true">
              <ShieldCheck size={22} />
            </div>
            <span className="route-eyebrow">The NAVIS Solution</span>
            <h3>A deterministic safety boundary before money moves</h3>
            <p>
              NAVIS places an immutable mathematical policy engine between the agent and
              the blockchain. Every proposal is measured against strict position caps,
              reserve floors, and slippage ceilings in deterministic code. Only approved
              orders reach your wallet for explicit cryptographic signature.
            </p>
          </article>
        </div>

        {/* The 3 Core Proof Points (Required by tests) */}
        <div className="landing-proof-points" aria-label="Proof points">
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
        </div>

        {/* Assurance Model (Required by tests) */}
        <div className="route-panel landing-assurance" aria-labelledby="assurance-title">
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
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 3: HOW IT WORKS (CORE WORKFLOW)
          ─────────────────────────────────────────────────────────── */}
      <section className="landing-section" aria-labelledby="how-it-works-title">
        <header className="section-header">
          <div className="section-title-wrap">
            <span className="route-eyebrow">Execution Pipeline</span>
            <h2 id="how-it-works-title" className="section-title">
              How NAVIS works: The 8-step decision spine
            </h2>
          </div>
          <p className="section-desc">
            Every trade follows this rigid sequence from market observation to browser
            proof. Each transition is bounded by deterministic rules and explicit user
            authorization.
          </p>
        </header>

        <CoreWorkflowDiagram />
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 4: REAL USE CASES
          ─────────────────────────────────────────────────────────── */}
      <section className="landing-section" aria-labelledby="use-cases-title">
        <header className="section-header">
          <div className="section-title-wrap">
            <span className="route-eyebrow">Operational Workflows</span>
            <h2 id="use-cases-title" className="section-title">
              Real use cases
            </h2>
          </div>
          <p className="section-desc">
            Concrete financial operations powered by NAVIS, demonstrating bounded autonomy
            and verifiable compliance.
          </p>
        </header>

        <div className="use-cases-grid">
          <article className="route-panel use-case-card">
            <div className="use-case-icon" aria-hidden="true">
              <ChartDonut size={24} />
            </div>
            <span className="route-eyebrow">Portfolio Management</span>
            <h3>Autonomous Treasury Rebalancing with Hard Caps</h3>
            <p>
              An AI agent continuously monitors a basket of tokenized assets (such as
              PreStocks equities EQA, EQB, and EQC) and generates rebalance orders to maintain
              target weight allocations. Every order is strictly constrained by a 10.00%
              maximum trade weight, 35.00% position cap, and 20.00% SOL reserve floor.
            </p>
            <div className="use-case-footer">
              <Link className="text-link" href="/agents/atlas">
                Explore in Atlas &rarr;
              </Link>
            </div>
          </article>

          <article className="route-panel use-case-card">
            <div className="use-case-icon" aria-hidden="true">
              <Scales size={24} />
            </div>
            <span className="route-eyebrow">Liquidity Operations</span>
            <h3>Governed Dynamic Bonding Curve (DBC) via Meteora</h3>
            <p>
              Configuring, deploying, and managing automated market maker liquidity profiles
              for equity tokens using Meteora DBC and DLMM SDKs. NAVIS constructs verified
              pool parameters and swap instructions while ensuring the agent holds zero
              custody of LP tokens or treasury funds.
            </p>
            <div className="use-case-footer">
              <Link className="text-link" href="/markets/launch">
                Inspect Markets & Launch &rarr;
              </Link>
            </div>
          </article>

          <article className="route-panel use-case-card">
            <div className="use-case-icon" aria-hidden="true">
              <Fingerprint size={24} />
            </div>
            <span className="route-eyebrow">Audit & Compliance</span>
            <h3>Auditable Mandates & Cryptographic Proof Receipts</h3>
            <p>
              Providing DAO treasuries, institutional allocators, and hackathon judges with
              tamper-evident evidence. Every execution produces a canonical SHA-256 receipt
              binding the exact market snapshot, proposal thesis, and 10 policy check results
              for open verification without trusting servers.
            </p>
            <div className="use-case-footer">
              <Link className="text-link" href="/proofs/demo-proof">
                Verify Canonical Receipt &rarr;
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 5: REAL INTEGRATIONS & STATUS
          ─────────────────────────────────────────────────────────── */}
      <section className="landing-section" aria-labelledby="integrations-title">
        <header className="section-header">
          <div className="section-title-wrap">
            <span className="route-eyebrow">Ecosystem Architecture</span>
            <h2 id="integrations-title" className="section-title">
              Real integrations & accurate status
            </h2>
          </div>
          <p className="section-desc">
            NAVIS integrates with real protocols and infrastructure. Every integration is
            labeled according to its actual current operational readiness.
          </p>
        </header>

        <IntegrationsGrid />
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 6: USER CONTROL & SAFETY BOUNDARIES
          ─────────────────────────────────────────────────────────── */}
      <section className="landing-section" aria-labelledby="user-control-title">
        <header className="section-header">
          <div className="section-title-wrap">
            <span className="route-eyebrow">Custody & Authority</span>
            <h2 id="user-control-title" className="section-title">
              What the user controls
            </h2>
          </div>
          <p className="section-desc">
            Autonomous intelligence is strictly contained. You retain absolute control over
            custody, risk boundaries, and cryptographic authorization.
          </p>
        </header>

        <div className="control-pillars-grid">
          <article className="route-panel control-pillar-card">
            <div className="pillar-icon" aria-hidden="true">
              <LockKey size={22} />
            </div>
            <h3>Zero Private Keys Held</h3>
            <p>
              NAVIS never generates, touches, or stores your private keys. Your wallet
              remains in your full custody at all times.
            </p>
          </article>

          <article className="route-panel control-pillar-card">
            <div className="pillar-icon" aria-hidden="true">
              <Signature size={22} />
            </div>
            <h3>Sole Execution Authority</h3>
            <p>
              The agent cannot execute trades. Value cannot move on Solana without an
              explicit ed25519 signature from your browser wallet.
            </p>
          </article>

          <article className="route-panel control-pillar-card">
            <div className="pillar-icon" aria-hidden="true">
              <ShieldCheck size={22} />
            </div>
            <h3>Immutable Risk Rules</h3>
            <p>
              You configure the risk bounds. The AI agent cannot alter, soften, or bypass
              these mathematical thresholds under any circumstance.
            </p>
          </article>

          <article className="route-panel control-pillar-card">
            <div className="pillar-icon" aria-hidden="true">
              <Clock size={22} />
            </div>
            <h3>Simulation Isolation</h3>
            <p>
              Demo executions halt at simulation by design. We never generate fabricated
              transaction signatures or fake block explorer links.
            </p>
          </article>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 7: WHY SOLANA
          ─────────────────────────────────────────────────────────── */}
      <section className="landing-section" aria-labelledby="why-solana-title">
        <header className="section-header">
          <div className="section-title-wrap">
            <span className="route-eyebrow">Settlement Infrastructure</span>
            <h2 id="why-solana-title" className="section-title">
              Why Solana
            </h2>
          </div>
          <p className="section-desc">
            Real-time financial operations require high execution frequency, sub-second
            finality, and deterministic slot heights.
          </p>
        </header>

        <div className="solana-benefits-grid">
          <article className="route-panel solana-card">
            <div className="solana-icon" aria-hidden="true">
              <Lightning size={22} />
            </div>
            <h3>Sub-Second Slot Finality</h3>
            <p>
              Solana&apos;s 400ms slot times ensure that market snapshots, policy
              evaluations, and transaction executions stay synchronized, eliminating
              time-of-check to time-of-use oracle latency drift.
            </p>
          </article>

          <article className="route-panel solana-card">
            <div className="solana-icon" aria-hidden="true">
              <TrendUp size={22} />
            </div>
            <h3>Sub-Cent Transaction Costs</h3>
            <p>
              Low network transaction fees make frequent, disciplined rebalancing
              economically viable. Small portfolio adjustments do not suffer severe margin
              erosion from network gas spikes.
            </p>
          </article>

          <article className="route-panel solana-card">
            <div className="solana-icon" aria-hidden="true">
              <Database size={22} />
            </div>
            <h3>Composable Liquidity Infrastructure</h3>
            <p>
              Direct ecosystem composability with capital-efficient AMMs like Meteora DBC
              and DLMM, and tokenized real-world assets through PreStocks.
            </p>
          </article>

          <article className="route-panel solana-card">
            <div className="solana-icon" aria-hidden="true">
              <Fingerprint size={22} />
            </div>
            <h3>Fast Cryptographic Auditing</h3>
            <p>
              Instant RPC transaction receipts and native ed25519 signing allow NAVIS to
              generate canonical SHA-256 proof receipts confirmed onchain within seconds.
            </p>
          </article>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 8: ACTUAL PRODUCT DEMONSTRATION
          ─────────────────────────────────────────────────────────── */}
      <section className="landing-section" aria-labelledby="product-demo-title">
        <header className="section-header">
          <div className="section-title-wrap">
            <span className="route-eyebrow">Real Rendered UI</span>
            <h2 id="product-demo-title" className="section-title">
              Actual product demonstration
            </h2>
          </div>
          <p className="section-desc">
            Explore the real NAVIS terminal components rendered directly from code fixtures.
            Inspect the live proposal, policy evaluation scorecard, and verifiable proof.
          </p>
        </header>

        <ActualProductDemo />
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 9: FREQUENTLY ASKED QUESTIONS (FAQ)
          ─────────────────────────────────────────────────────────── */}
      <section className="landing-section" aria-labelledby="faq-title">
        <header className="section-header">
          <div className="section-title-wrap">
            <span className="route-eyebrow">Plain Answers & Honest Limitations</span>
            <h2 id="faq-title" className="section-title">
              Frequently asked questions
            </h2>
          </div>
          <p className="section-desc">
            Direct, plain-spoken answers addressing real user questions, technical
            boundaries, and current system capabilities.
          </p>
        </header>

        <FaqSection />
      </section>

      {/* ───────────────────────────────────────────────────────────
          SECTION 10: FINAL CTA & NAVIGATION PATHS
          ─────────────────────────────────────────────────────────── */}
      <section className="route-panel final-cta-section" aria-labelledby="cta-title">
        <div className="final-cta-content">
          <span className="route-eyebrow">Start Inspecting NAVIS</span>
          <h2 id="cta-title" className="final-cta-title">
            Begin with the Atlas demo or run the guided orientation
          </h2>
          <p className="final-cta-sub">
            Review live proposal data, watch deterministic policies approve or reject trades,
            and recompute cryptographic proofs in your browser.
          </p>

          <div className="final-cta-actions">
            <Link className="primary-button" href="/agents/atlas">
              Open Atlas Demo <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link className="secondary-button" href="/onboarding">
              <Compass aria-hidden="true" size={16} /> Guided Onboarding
            </Link>
            <Link className="secondary-button" href="/proofs/demo-proof">
              <Fingerprint aria-hidden="true" size={16} /> Verify Receipt
            </Link>
            <Link className="secondary-button" href="/settings">
              <SlidersHorizontal aria-hidden="true" size={16} /> System Capabilities
            </Link>
          </div>
        </div>

        {/* Entry links required by existing tests */}
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
            <p>Run a decision, watch the policy approve or reject it, then verify the receipt.</p>
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
            <p>ClawPump pairs, Meteora DBC profiles and the read-only PreStocks catalogue.</p>
            <span className="landing-entry-cta">
              Open <ArrowRight aria-hidden="true" size={14} />
            </span>
          </Link>
        </nav>
      </section>
    </div>
  );
}
