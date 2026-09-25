"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChartDonut,
  CheckCircle,
  Cpu,
  FileCode,
  Fingerprint,
  PaperPlaneTilt,
  ShieldCheck,
  Signature,
  Wallet,
} from "@phosphor-icons/react";
import { useWallet } from "@solana/wallet-adapter-react";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { InfoHint } from "@/components/shared/info-hint";
import type { InfoHintKey } from "@/components/shared/info-hint-content";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { demoProof } from "@/fixtures/demo-proof";
import { describeAssurance } from "@/lib/assurance";

export type OnboardingStep = {
  id: string;
  stepNumber: number;
  title: string;
  shortLabel: string;
  eyebrow: string;
  summary: string;
  topic?: InfoHintKey;
  topicLabel?: string;
  icon: typeof Wallet;
  actionText: string;
  actionHref?: string;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "connect-wallet",
    stepNumber: 1,
    title: "Connect Your Solana Wallet",
    shortLabel: "Connect Wallet",
    eyebrow: "Step 01 · Non-Custodial Authority",
    summary:
      "NAVIS operates entirely non-custodially. You connect a standard Solana browser wallet (Phantom, Solflare, etc.). NAVIS never asks for, stores, or generates private keys.",
    topic: "approval",
    topicLabel: "About non-custodial authorization",
    icon: Wallet,
    actionText: "Next: Workspace Map",
  },
  {
    id: "understand-workspace",
    stepNumber: 2,
    title: "Understand the Workspace",
    shortLabel: "Workspace Map",
    eyebrow: "Step 02 · Operational Terminal",
    summary:
      "The NAVIS workspace is organized into five specialized surfaces: Agents (mandate definitions), Decisions (proposal logs), Markets (liquidity and bonding curves), Transactions (settlement ledger), and Proofs (cryptographic verifiers).",
    topic: "atlas",
    topicLabel: "About NAVIS agents",
    icon: Cpu,
    actionText: "Next: Inspect Market",
  },
  {
    id: "inspect-market",
    stepNumber: 3,
    title: "Inspect Market Snapshot",
    shortLabel: "Inspect Market",
    eyebrow: "Step 03 · Grounded Context",
    summary:
      "Before any action is considered, NAVIS captures an immutable snapshot of balances and asset valuations at a specific Solana slot height. This locks the factual inputs against oracle latency.",
    topic: "navMarkets",
    topicLabel: "About market data",
    icon: ChartDonut,
    actionText: "Next: Atlas Decision",
  },
  {
    id: "view-decision",
    stepNumber: 4,
    title: "View Atlas Trade Decision",
    shortLabel: "Atlas Decision",
    eyebrow: "Step 04 · Agent Analytical Intent",
    summary:
      "Atlas evaluates the portfolio balances against its investment mandate. It proposes an asset rotation with an explicit thesis, confidence score, and maximum slippage ceiling.",
    topic: "proposal",
    topicLabel: "About trade proposals",
    icon: FileCode,
    actionText: "Next: Policy Review",
  },
  {
    id: "review-policy",
    stepNumber: 5,
    title: "Review Deterministic Policy & Risk",
    shortLabel: "Policy & Risk",
    eyebrow: "Step 05 · Mathematical Safeguards",
    summary:
      "Every proposal must pass 10 immutable risk rules (max trade size, position concentration, reserve floors, slippage ceilings). A single failed check rejects the trade immediately.",
    topic: "policy",
    topicLabel: "About deterministic policy",
    icon: ShieldCheck,
    actionText: "Next: Prepare Action",
  },
  {
    id: "prepare-action",
    stepNumber: 6,
    title: "Prepare & Simulate Action",
    shortLabel: "Prepare Action",
    eyebrow: "Step 06 · Dry-Run Execution",
    summary:
      "In live mode, Meteora swap instructions are assembled and simulated against Solana RPC. In demo mode, execution stops at simulation. This verifies expected balance deltas safely.",
    topic: "simulation",
    topicLabel: "About transaction simulation",
    icon: PaperPlaneTilt,
    actionText: "Next: User Approval",
  },
  {
    id: "approve-action",
    stepNumber: 7,
    title: "Approve If Required",
    shortLabel: "User Approval",
    eyebrow: "Step 07 · Signing Boundary",
    summary:
      "Atlas has zero autonomous signing rights. No transaction can move funds without you explicitly reviewing the order and signing with your connected wallet extension.",
    topic: "approval",
    topicLabel: "About wallet approval",
    icon: Signature,
    actionText: "Next: Verify Receipt",
  },
  {
    id: "verify-receipt",
    stepNumber: 8,
    title: "Verify Proof Receipt",
    shortLabel: "Verify Receipt",
    eyebrow: "Step 08 · Cryptographic Evidence",
    summary:
      "Every completed execution yields a canonical SHA-256 proof receipt. You can recompute the receipt hash locally in your browser to verify integrity without trusting NAVIS servers.",
    topic: "proof",
    topicLabel: "About proof receipts",
    icon: Fingerprint,
    actionText: "Complete Orientation",
    actionHref: "/agents/atlas",
  },
] as const;

export function OnboardingFlow({ onComplete }: { onComplete?: () => void }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { connected, publicKey } = useWallet();

  const step = ONBOARDING_STEPS[currentStepIndex];
  const Icon = step.icon;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      if (onComplete) onComplete();
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, ONBOARDING_STEPS.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="onboarding-flow-container" aria-label="Lightweight onboarding orientation">
      {/* ── Progress Header ── */}
      <header className="onboarding-header">
        <div className="onboarding-progress-bar-wrap" role="progressbar" aria-valuenow={currentStepIndex + 1} aria-valuemin={1} aria-valuemax={8}>
          <div
            className="onboarding-progress-fill"
            style={{ width: `${((currentStepIndex + 1) / 8) * 100}%` }}
          />
        </div>

        <div className="onboarding-header-meta">
          <span className="onboarding-step-counter tabular-num">
            Step {currentStepIndex + 1} of 8
          </span>
          <Link href="/" className="onboarding-skip-link">
            Skip Orientation
          </Link>
        </div>
      </header>

      {/* ── Step Navigation Pill Ribbon ── */}
      <nav className="onboarding-steps-nav" aria-label="Orientation steps">
        {ONBOARDING_STEPS.map((s, idx) => {
          const isActive = idx === currentStepIndex;
          const isPassed = idx < currentStepIndex;
          return (
            <button
              key={s.id}
              type="button"
              className={`onboarding-step-pill ${
                isActive ? "step-pill-active" : isPassed ? "step-pill-passed" : ""
              }`}
              onClick={() => setCurrentStepIndex(idx)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="pill-num tabular-num">0{s.stepNumber}</span>
              <span className="pill-label">{s.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Main Step Card ── */}
      <article className="route-panel onboarding-card">
        <header className="onboarding-card-header">
          <div className="step-icon-wrap" aria-hidden="true">
            <Icon size={24} />
          </div>
          <div className="step-title-group">
            <span className="route-eyebrow">{step.eyebrow}</span>
            <h2 className="step-title">{step.title}</h2>
          </div>
          {step.topic ? <InfoHint topic={step.topic} label={step.topicLabel} /> : null}
        </header>

        <div className="onboarding-card-body">
          <p className="step-summary-text">{step.summary}</p>

          {/* ── Step-Specific Live Previews ── */}
          <div className="onboarding-step-preview">
            {step.id === "connect-wallet" && (
              <div className="preview-wallet-box">
                <div className="preview-row">
                  <span className="preview-label">Wallet Standard Status:</span>
                  <strong>{connected ? "Connected" : "Disconnected (Ready to connect)"}</strong>
                </div>
                {connected && publicKey ? (
                  <div className="preview-row">
                    <span className="preview-label">Connected Public Key:</span>
                    <code className="tabular-num">{publicKey.toBase58().slice(0, 8)}…{publicKey.toBase58().slice(-8)}</code>
                  </div>
                ) : (
                  <p className="preview-subtext">
                    Click the wallet button in the top navigation at any time to connect Phantom, Solflare, or standard wallets.
                  </p>
                )}
              </div>
            )}

            {step.id === "understand-workspace" && (
              <div className="preview-workspace-grid">
                <div className="workspace-pill">
                  <strong>Agents</strong>
                  <small>Mandate & strategy</small>
                </div>
                <div className="workspace-pill">
                  <strong>Decisions</strong>
                  <small>Proposals & verdicts</small>
                </div>
                <div className="workspace-pill">
                  <strong>Markets</strong>
                  <small>PreStocks & Meteora</small>
                </div>
                <div className="workspace-pill">
                  <strong>Proofs</strong>
                  <small>SHA-256 receipts</small>
                </div>
              </div>
            )}

            {step.id === "inspect-market" && (
              <div className="preview-market-box">
                <div className="preview-stat-row">
                  <div>
                    <span className="preview-label">Snapshot Slot</span>
                    <strong className="tabular-num">902</strong>
                  </div>
                  <div>
                    <span className="preview-label">Monitored Assets</span>
                    <strong>SOL, EQA, EQB, EQC</strong>
                  </div>
                  <div>
                    <span className="preview-label">Priced Subtotal</span>
                    <strong className="tabular-num">$120.00 USD</strong>
                  </div>
                </div>
              </div>
            )}

            {step.id === "view-decision" && (
              <div className="preview-proposal-box">
                <div className="preview-proposal-header">
                  <span className="proposal-tag">BUY / REBALANCE</span>
                  <span className="proposal-confidence tabular-num">94.00% Confidence</span>
                </div>
                <h4 className="preview-order-text">1.00 EQA → min 0.99 EQB</h4>
                <p className="preview-thesis">
                  &ldquo;{demoProof.document.decision.proposal.thesis}&rdquo;
                </p>
              </div>
            )}

            {step.id === "review-policy" && (
              <div className="preview-policy-box">
                <div className="preview-policy-item">
                  <CheckCircle size={15} weight="bold" />
                  <span>Max single trade: 5.00% (limit 10.00%)</span>
                </div>
                <div className="preview-policy-item">
                  <CheckCircle size={15} weight="bold" />
                  <span>Max position size: 30.00% (limit 35.00%)</span>
                </div>
                <div className="preview-policy-item">
                  <CheckCircle size={15} weight="bold" />
                  <span>Min SOL reserve: 25.00% (floor 20.00%)</span>
                </div>
                <div className="preview-policy-item">
                  <CheckCircle size={15} weight="bold" />
                  <span>Max slippage: 75 bps (limit 75 bps)</span>
                </div>
              </div>
            )}

            {step.id === "prepare-action" && (
              <div className="preview-action-box">
                <div className="preview-row">
                  <span className="preview-label">Execution Mode:</span>
                  <strong>Demo Simulation (Offchain Dry-Run)</strong>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Balance Delta:</span>
                  <span className="tabular-num">-1.00 EQA / +0.99 EQB</span>
                </div>
              </div>
            )}

            {step.id === "approve-action" && (
              <div className="preview-approval-box">
                <Signature size={20} />
                <div>
                  <strong>Zero Autonomous Keys</strong>
                  <p>Atlas cannot execute. Execution requires your explicit signature.</p>
                </div>
              </div>
            )}

            {step.id === "verify-receipt" && (
              <div className="preview-proof-box">
                <div className="preview-row">
                  <span className="preview-label">Receipt Identifier:</span>
                  <code className="tabular-num">demo-proof</code>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Canonical SHA-256:</span>
                  <code className="tabular-num">{demoProof.receiptHash.slice(0, 16)}…</code>
                </div>
                <div className="preview-assurance">
                  <AssuranceBadge
                    assurance={describeAssurance("offchain_integrity", "demo_simulation")}
                    compact
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer Navigation ── */}
        <footer className="onboarding-card-footer">
          <div className="footer-left">
            {!isFirst && (
              <button
                type="button"
                className="secondary-button"
                onClick={handlePrev}
              >
                <ArrowLeft size={14} aria-hidden="true" /> Previous
              </button>
            )}
          </div>

          <div className="footer-right">
            {step.actionHref ? (
              <Link className="primary-button" href={step.actionHref}>
                {step.actionText} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={handleNext}
              >
                {step.actionText} <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </footer>
      </article>
    </div>
  );
}
