"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ChartBar,
  CheckCircle,
  Cpu,
  FileCode,
  Fingerprint,
  PaperPlaneTilt,
  ShieldCheck,
  Signature,
  UserCheck,
} from "@phosphor-icons/react";
import Link from "next/link";

export type WorkflowStep = {
  id: string;
  stepNumber: string;
  title: string;
  eyebrow: string;
  summary: string;
  technicalDetail: string;
  input: string;
  output: string;
  safetyInvariant: string;
  icon: typeof ChartBar;
  link?: { href: string; label: string };
};

export const CORE_WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    id: "market-data",
    stepNumber: "01",
    title: "Market Data",
    eyebrow: "Snapshot Layer",
    summary:
      "Captures deterministic onchain slot heights, token balances, and reference pricing before evaluation begins.",
    technicalDetail:
      "Reads Solana RPC account balances, Pyth price references, and PreStocks catalogue entries at an exact slot height.",
    input: "Solana slot height, SPL token balances, and pricing sources",
    output: "Immutable PortfolioSnapshot document with USD valuations",
    safetyInvariant: "Stale data (>300s) or missing valuations halt the pipeline immediately.",
    icon: ChartBar,
    link: { href: "/markets/launch", label: "Inspect Markets" },
  },
  {
    id: "atlas",
    stepNumber: "02",
    title: "Atlas",
    eyebrow: "Analytical Intent",
    summary:
      "The reference AI agent evaluates the portfolio against its investment mandate and generates a proposed allocation move.",
    technicalDetail:
      "Runs mandate thesis against relative-strength signal fixtures or OpenAI models. Atlas holds zero private keys.",
    input: "PortfolioSnapshot + StrategyDocument + Investment Thesis",
    output: "Unsigned TradeProposal with target token, amount, and rationale",
    safetyInvariant: "Atlas has zero autonomous signing or funds movement authority.",
    icon: Cpu,
    link: { href: "/agents/atlas", label: "Inspect Atlas Mandate" },
  },
  {
    id: "policy-risk",
    stepNumber: "03",
    title: "Policy / Risk",
    eyebrow: "Deterministic Engine",
    summary:
      "Evaluates 10 mathematical risk bounds against the proposal. A single violation immediately aborts execution.",
    technicalDetail:
      "Deterministic TypeScript evaluator checking position caps, trade size limits, reserve floors, and slippage tolerance.",
    input: "TradeProposal + RiskPolicyVersion constraints",
    output: "Structured PolicyVerdict (10/10 PASS or blocked violation)",
    safetyInvariant: "Policy code is deterministic and cannot be bypassed or overridden by AI.",
    icon: ShieldCheck,
    link: { href: "/agents/atlas#risk", label: "View 10 Risk Rules" },
  },
  {
    id: "proposal",
    stepNumber: "04",
    title: "Proposal",
    eyebrow: "Structured Order",
    summary:
      "Formulates a typed execution payload with exact integer base units, minimum output amounts, and expiry.",
    technicalDetail:
      "Serializes input/output mints, maximum slippage (e.g. 75 bps), and canonical SHA-256 proposal hash.",
    input: "Approved PolicyVerdict + validated market parameters",
    output: "Canonical DecisionRecord document ready for authorization",
    safetyInvariant: "Proposals carry explicit 5-minute expiry windows to prevent execution drift.",
    icon: FileCode,
    link: { href: "/decisions", label: "View Decisions Ledger" },
  },
  {
    id: "user-approval",
    stepNumber: "05",
    title: "User Approval",
    eyebrow: "Custody Boundary",
    summary:
      "Presents the verified order, risk report, and exact fee breakdown to you for non-custodial human review.",
    technicalDetail:
      "Surfaces observed values versus risk limits, required token approvals, and expected balance deltas.",
    input: "DecisionRecord + human review in NAVIS workspace",
    output: "Explicit approval to build the transaction payload",
    safetyInvariant: "No transaction can be assembled or signed without explicit user trigger.",
    icon: UserCheck,
    link: { href: "/settings", label: "Review Permissions" },
  },
  {
    id: "wallet-signature",
    stepNumber: "06",
    title: "Wallet Signature",
    eyebrow: "Cryptographic Authorization",
    summary:
      "Your connected Solana browser wallet cryptographically signs the transaction. NAVIS never touches your keys.",
    technicalDetail:
      "Wallet Standard prompts ed25519 signature on the verified transaction instruction payload.",
    input: "Transaction instructions + recent Solana blockhash",
    output: "Cryptographically signed Solana transaction payload",
    safetyInvariant: "Private keys remain in the user's wallet extension at all times.",
    icon: Signature,
    link: { href: "/transactions", label: "Transactions Ledger" },
  },
  {
    id: "onchain-action",
    stepNumber: "07",
    title: "Onchain Action",
    eyebrow: "Execution & Broadcast",
    summary:
      "Broadcasts the signed transaction to the Solana network, or performs a local simulation in demo mode.",
    technicalDetail:
      "Submits via Solana RPC, confirms transaction signature, and reads final slot settlement.",
    input: "Signed transaction payload submitted to RPC",
    output: "Solana transaction signature and confirmed slot number",
    safetyInvariant: "Demo executions halt at simulation; live execution requires explicit flags.",
    icon: PaperPlaneTilt,
    link: { href: "/transactions", label: "View Settlement" },
  },
  {
    id: "proof",
    stepNumber: "08",
    title: "Proof",
    eyebrow: "Canonical Receipt",
    summary:
      "Binds the entire execution lifecycle into a SHA-256 canonical receipt verifiable in your own browser.",
    technicalDetail:
      "Links market snapshot, proposal, policy verdict, and transaction signature into an immutable record.",
    input: "Full execution evidence chain + canonicalization serializer",
    output: "ProofReceipt document with SHA-256 hash and assurance level",
    safetyInvariant: "Receipts can be recomputed locally without trusting NAVIS servers.",
    icon: Fingerprint,
    link: { href: "/proofs/demo-proof", label: "Verify Proof in Browser" },
  },
] as const;

export function CoreWorkflowDiagram() {
  const [activeStepId, setActiveStepId] = useState<string>("market-data");
  const activeStep =
    CORE_WORKFLOW_STEPS.find((s) => s.id === activeStepId) ?? CORE_WORKFLOW_STEPS[0];

  return (
    <div className="core-workflow-container" aria-label="Core workflow sequence">
      {/* ── Visual Flow Ribbon (Legible at a glance) ── */}
      <div className="workflow-ribbon" role="list" aria-label="Workflow pipeline steps">
        {CORE_WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === activeStepId;
          const isLast = index === CORE_WORKFLOW_STEPS.length - 1;

          return (
            <div key={step.id} className="workflow-ribbon-item" role="listitem">
              <button
                type="button"
                className={`workflow-node ${isActive ? "workflow-node-active" : ""}`}
                onClick={() => setActiveStepId(step.id)}
                aria-pressed={isActive}
                aria-label={`Step ${step.stepNumber}: ${step.title}`}
              >
                <div className="node-badge-row">
                  <span className="node-num tabular-num">{step.stepNumber}</span>
                  <Icon className="node-icon" size={16} weight={isActive ? "bold" : "regular"} />
                </div>
                <strong className="node-title">{step.title}</strong>
                <span className="node-eyebrow">{step.eyebrow}</span>
              </button>

              {!isLast ? (
                <div className="workflow-connector" aria-hidden="true">
                  <ArrowRight className="connector-icon desktop-only" size={14} />
                  <ArrowDown className="connector-icon mobile-only" size={14} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── Active Step Inspection Card (Exact Details) ── */}
      <div className="workflow-inspector-panel">
        <header className="inspector-header">
          <div className="inspector-title-row">
            <span className="inspector-step-tag tabular-num">
              Step {activeStep.stepNumber} of 08
            </span>
            <span className="route-eyebrow">{activeStep.eyebrow}</span>
          </div>
          <h3 className="inspector-heading">{activeStep.title}</h3>
          <p className="inspector-summary">{activeStep.summary}</p>
        </header>

        <div className="inspector-grid">
          <div className="inspector-col">
            <span className="inspector-label">Pipeline Input</span>
            <p className="inspector-val">{activeStep.input}</p>

            <span className="inspector-label">Pipeline Output</span>
            <p className="inspector-val">{activeStep.output}</p>
          </div>

          <div className="inspector-col">
            <span className="inspector-label">Technical Implementation</span>
            <p className="inspector-val">{activeStep.technicalDetail}</p>

            <div className="inspector-safety-box">
              <div className="safety-box-header">
                <CheckCircle size={14} weight="bold" />
                <span>Deterministic Invariant</span>
              </div>
              <p className="safety-box-copy">{activeStep.safetyInvariant}</p>
            </div>
          </div>
        </div>

        {activeStep.link ? (
          <footer className="inspector-footer">
            <Link className="text-link" href={activeStep.link.href}>
              {activeStep.link.label} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
