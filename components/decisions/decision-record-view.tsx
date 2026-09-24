import {
  ArrowRight,
  CopySimple,
  FileCode,
  Fingerprint,
  Signature,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import React from "react";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import {
  ClusterStamp,
  DecisionStateBadge,
  ModeStamp,
  PolicyResult,
  StatusBadge,
  type DecisionState,
} from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import {
  describeAssurance,
  type AssuranceLevel,
  type EvidenceOrigin,
} from "@/lib/assurance";
import type { SolanaCluster } from "@/lib/env-core";

export type DecisionCheckItem = {
  rule: string;
  label: string;
  observed: string;
  threshold: string;
  status: "pass" | "warn" | "fail" | "block";
  explanation?: string;
};

export type DecisionRiskBoundary = {
  label: string;
  observed: string;
  threshold: string;
  status: "pass" | "warn" | "block";
};

export type DecisionRecordProps = {
  // 1. Decision
  decisionId: string;
  agentName?: string;
  agentSlug?: string;
  strategyVersion?: number;
  policyVersion?: number;
  cluster: string;
  mode: string;
  timestamp: string;
  state: DecisionState;
  stateLabel?: string;
  action: string;
  scenario?: string;
  universeLabel?: string;

  // 2. Rationale
  thesis: string;
  signalSource?: string;
  confidenceBps?: number;
  invalidationConditions?: readonly string[];

  // 3. Market Inputs
  inputAsset?: { symbol: string; name: string; mint: string; decimals: number };
  outputAsset?: { symbol: string; name: string; mint: string; decimals: number };
  availableLiquidityUsd?: string | null;
  quoteObservedAt?: string;
  quoteExpiresAt?: string;
  prestocksResearch?: React.ReactNode;

  // 4. Policy
  policyHash?: string;
  policyApproved: boolean;
  policyChecks: readonly DecisionCheckItem[];
  policyExplanationChild?: React.ReactNode;

  // 5. Risk
  riskBoundaries?: readonly DecisionRiskBoundary[];

  // 6. Proposed Action
  orderAmountUi?: string;
  orderAmountRaw?: string;
  expectedOutputUi?: string;
  expectedOutputRaw?: string;
  maxSlippageBps?: number;
  proposalSummaryLine?: string;
  rawPayload?: Record<string, unknown> | null;

  // 7. User Approval
  approvalStatus:
    "demo_simulation" | "awaiting_wallet" | "policy_blocked" | "confirmed";
  approvalNote?: string;

  // 8. Result
  executionState: "simulated" | "rejected" | "confirmed" | "failed";
  executionSummary: string;
  gasFeeLamports?: string | number | null;

  // 9. Proof
  proofId?: string | null;
  receiptHash: string;
  assuranceLevel: AssuranceLevel;
  assuranceOrigin: EvidenceOrigin;
  verified?: boolean | null;
  onVerify?: () => void;
  openDecisionHref?: string | null;
  viewProofHref?: string | null;
  onCopyProofLink?: () => void;
  copiedState?: "idle" | "copied" | "failed";
  accessNote?: string;
  universeNote?: string | null;
  persistenceNote?: string;
  executionEligibilityReason?: string;
  modelFallbackReason?: string | null;

  // Test anchor IDs
  isInteractiveRun?: boolean;
};

export function DecisionRecordView(props: DecisionRecordProps) {
  const assurance = describeAssurance(props.assuranceLevel, props.assuranceOrigin);
  const confidencePercent = props.confidenceBps
    ? (props.confidenceBps / 100).toFixed(2)
    : null;

  return (
    <article
      className="decision-record-view"
      data-testid={props.isInteractiveRun ? "decision-run-result" : undefined}
      aria-label="Structured decision record"
    >
      {/* ───────────────────────────────────────────────────────────
          1. DECISION
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-decision"
        aria-labelledby="step-decision-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">01</span>
            <span className="record-step-label">Decision</span>
          </div>
          <div className="record-step-tags">
            <ModeStamp mode={props.mode as "demo" | "devnet" | "mainnet"} />
            <ClusterStamp cluster={props.cluster as SolanaCluster} />
            <InfoHint topic="atlas" label="About Atlas" />
          </div>
        </header>

        <div className="record-decision-hero">
          <div className="record-decision-meta">
            <div className="record-decision-tags">
              <span className="record-agent-name">{props.agentName ?? "Atlas"}</span>
              {props.strategyVersion ? (
                <span className="record-version-tag">
                  Strategy v{props.strategyVersion}.0
                </span>
              ) : null}
              {props.scenario ? (
                <span className="record-scenario-tag">{props.scenario} scenario</span>
              ) : null}
              {props.universeLabel ? (
                <span className="record-universe-tag">{props.universeLabel}</span>
              ) : null}
            </div>
            <h2 id="step-decision-title" className="record-decision-action">
              {props.action}
            </h2>
            <div className="record-id-row">
              <span className="record-label">Decision ID:</span>
              <code
                className="record-id-value"
                data-testid={props.isInteractiveRun ? "decision-run-id" : undefined}
              >
                {props.decisionId}
              </code>
              <span className="record-dot">·</span>
              <time className="record-timestamp" dateTime={props.timestamp}>
                {props.timestamp}
              </time>
            </div>
          </div>
          <div className="record-decision-status">
            <DecisionStateBadge state={props.state} label={props.stateLabel} />
          </div>
        </div>

        {props.universeNote ? (
          <p
            className="decision-run-universe-note record-callout"
            data-testid={
              props.isInteractiveRun ? "decision-run-universe-note" : undefined
            }
          >
            {props.universeNote}
          </p>
        ) : null}
      </section>

      {/* ───────────────────────────────────────────────────────────
          2. RATIONALE
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-rationale"
        aria-labelledby="step-rationale-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">02</span>
            <span className="record-step-label">Rationale</span>
          </div>
          <InfoHint topic="proposal" label="About trade proposal" />
        </header>

        <div className="record-rationale-body">
          <p
            className="decision-run-why record-thesis"
            data-testid={props.isInteractiveRun ? "decision-run-why" : undefined}
          >
            {props.thesis}
          </p>

          <div className="record-metrics-grid">
            {props.signalSource ? (
              <div className="record-metric-item">
                <span className="record-metric-label">Signal Source</span>
                <strong className="record-metric-val">{props.signalSource}</strong>
              </div>
            ) : null}

            {confidencePercent ? (
              <div className="record-metric-item">
                <span className="record-metric-label">Thesis Confidence</span>
                <strong className="record-metric-val tabular-num">
                  {confidencePercent}%
                </strong>
                <div
                  className="record-confidence-bar"
                  role="progressbar"
                  aria-valuenow={props.confidenceBps}
                  aria-valuemin={0}
                  aria-valuemax={10000}
                >
                  <div
                    className="record-confidence-fill"
                    style={{ width: `${Number(confidencePercent)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {props.invalidationConditions && props.invalidationConditions.length > 0 ? (
            <div className="record-invalidation-box">
              <span className="record-invalidation-label">Invalidation Conditions</span>
              <ul className="record-invalidation-list">
                {props.invalidationConditions.map((cond, index) => (
                  <li key={index}>{cond}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          3. MARKET INPUTS
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-market"
        aria-labelledby="step-market-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">03</span>
            <span className="record-step-label">Market Inputs</span>
          </div>
        </header>

        <div className="record-market-grid">
          {props.inputAsset && props.outputAsset ? (
            <div className="record-pair-card">
              <div className="record-pair-leg">
                <span className="record-leg-label">Input Asset</span>
                <strong className="record-asset-symbol">
                  {props.inputAsset.symbol}
                </strong>
                <span className="record-asset-name">{props.inputAsset.name}</span>
                <code className="record-mint-abbr">
                  {props.inputAsset.mint.slice(0, 8)}...
                  {props.inputAsset.mint.slice(-6)}
                </code>
              </div>
              <div className="record-pair-arrow" aria-hidden="true">
                <ArrowRight size={18} />
              </div>
              <div className="record-pair-leg">
                <span className="record-leg-label">Output Asset</span>
                <strong className="record-asset-symbol">
                  {props.outputAsset.symbol}
                </strong>
                <span className="record-asset-name">{props.outputAsset.name}</span>
                <code className="record-mint-abbr">
                  {props.outputAsset.mint.slice(0, 8)}...
                  {props.outputAsset.mint.slice(-6)}
                </code>
              </div>
            </div>
          ) : null}

          <div className="record-market-facts">
            {props.availableLiquidityUsd ? (
              <div className="record-fact-row">
                <span>Available Pair Liquidity</span>
                <strong className="tabular-num">
                  ${props.availableLiquidityUsd} USD
                </strong>
              </div>
            ) : null}
            {props.quoteObservedAt ? (
              <div className="record-fact-row">
                <span>Quote Observed At</span>
                <time className="tabular-num">{props.quoteObservedAt}</time>
              </div>
            ) : null}
            {props.quoteExpiresAt ? (
              <div className="record-fact-row">
                <span>Quote Expiration</span>
                <time className="tabular-num">{props.quoteExpiresAt}</time>
              </div>
            ) : null}
          </div>
        </div>

        {props.prestocksResearch ? (
          <div className="record-prestocks-slot">{props.prestocksResearch}</div>
        ) : null}
      </section>

      {/* ───────────────────────────────────────────────────────────
          4. POLICY
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-policy"
        aria-labelledby="step-policy-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">04</span>
            <span className="record-step-label">Deterministic Policy</span>
          </div>
          <div className="record-step-tags">
            <StatusBadge tone={props.policyApproved ? "pass" : "block"}>
              {props.policyApproved ? "Policy Passed" : "Policy Rejected"}
            </StatusBadge>
            <InfoHint topic="policy" label="About deterministic policy" />
          </div>
        </header>

        {props.policyExplanationChild ? (
          props.policyExplanationChild
        ) : (
          <div className="record-policy-list">
            {props.policyChecks.map((check) => (
              <PolicyResult
                key={check.rule}
                label={check.label}
                observed={check.observed}
                threshold={check.threshold}
                detail={check.explanation}
                status={check.status === "fail" ? "block" : check.status}
              />
            ))}
          </div>
        )}
      </section>

      {/* ───────────────────────────────────────────────────────────
          5. RISK
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-risk"
        aria-labelledby="step-risk-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">05</span>
            <span className="record-step-label">Risk Boundaries</span>
          </div>
          <InfoHint topic="risk" label="About risk boundaries" />
        </header>

        <div className="record-risk-scorecard">
          {(props.riskBoundaries ?? []).map((boundary) => (
            <div
              key={boundary.label}
              className="record-risk-card"
              data-status={boundary.status}
            >
              <div className="record-risk-card-head">
                <span className="record-risk-card-label">{boundary.label}</span>
                <StatusBadge tone={boundary.status}>
                  {boundary.status === "pass" ? "Passed" : "Breached"}
                </StatusBadge>
              </div>
              <div className="record-risk-values">
                <div className="record-risk-col">
                  <span className="record-risk-sub">Observed</span>
                  <strong className="record-risk-num tabular-num">
                    {boundary.observed}
                  </strong>
                </div>
                <div className="record-risk-divider" aria-hidden="true">
                  /
                </div>
                <div className="record-risk-col">
                  <span className="record-risk-sub">Limit</span>
                  <strong className="record-risk-limit tabular-num">
                    {boundary.threshold}
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          6. PROPOSED ACTION
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-proposal"
        aria-labelledby="step-proposal-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">06</span>
            <span className="record-step-label">Proposed Action</span>
          </div>
          <InfoHint topic="proposal" label="About trade proposal" />
        </header>

        <div className="record-proposal-box">
          <p
            className="record-proposal-summary"
            data-testid={props.isInteractiveRun ? "decision-run-proposal" : undefined}
          >
            {props.proposalSummaryLine ??
              `${props.action} order with max slippage ${props.maxSlippageBps ?? 75} bps.`}
          </p>

          <div className="record-action-table">
            <div className="record-action-row">
              <span className="record-action-key">Action Type</span>
              <strong className="record-action-val">{props.action}</strong>
            </div>
            {props.orderAmountUi && props.inputAsset ? (
              <div className="record-action-row">
                <span className="record-action-key">Notional Amount</span>
                <strong className="record-action-val tabular-num">
                  {props.orderAmountUi} {props.inputAsset.symbol}
                  {props.orderAmountRaw ? (
                    <small className="record-action-sub">
                      ({props.orderAmountRaw} base units at {props.inputAsset.decimals}{" "}
                      decimals)
                    </small>
                  ) : null}
                </strong>
              </div>
            ) : null}
            {props.expectedOutputUi && props.outputAsset ? (
              <div className="record-action-row">
                <span className="record-action-key">Minimum Output</span>
                <strong className="record-action-val tabular-num">
                  {props.expectedOutputUi} {props.outputAsset.symbol}
                  {props.expectedOutputRaw ? (
                    <small className="record-action-sub">
                      ({props.expectedOutputRaw} base units at{" "}
                      {props.outputAsset.decimals} decimals)
                    </small>
                  ) : null}
                </strong>
              </div>
            ) : null}
            {props.maxSlippageBps !== undefined ? (
              <div className="record-action-row">
                <span className="record-action-key">Max Slippage</span>
                <strong className="record-action-val tabular-num">
                  {props.maxSlippageBps} bps ({(props.maxSlippageBps / 100).toFixed(2)}
                  %)
                </strong>
              </div>
            ) : null}
          </div>

          {/* Progressive disclosure for technical payloads */}
          {props.rawPayload ? (
            <details className="record-raw-disclosure">
              <summary className="record-raw-summary">
                <FileCode size={14} />
                <span>Show technical transaction payload</span>
              </summary>
              <pre className="record-raw-json">
                <code>{JSON.stringify(props.rawPayload, null, 2)}</code>
              </pre>
            </details>
          ) : null}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          7. USER APPROVAL (WALLET AUTHORITY BOUNDARY)
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-approval"
        aria-labelledby="step-approval-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">07</span>
            <span className="record-step-label">User Approval</span>
          </div>
          <InfoHint topic="approval" label="About user approval" />
        </header>

        <div className="record-approval-container">
          <div className="record-approval-boundary">
            <div className="record-boundary-icon" aria-hidden="true">
              <Signature size={22} />
            </div>
            <div>
              <h3 className="record-boundary-heading">
                Non-Custodial Wallet Authority Boundary
              </h3>
              <p className="record-boundary-text">
                Autonomous agents operate with zero private keys and zero signing
                capabilities. Funds cannot move without explicit cryptographic
                authorization from your connected wallet.
              </p>
            </div>
          </div>

          <div className="record-approval-status-bar">
            <div className="record-approval-info">
              <span className="record-approval-state-label">
                Execution Authority Status:
              </span>
              <strong className="record-approval-state-val">
                {props.approvalStatus === "demo_simulation"
                  ? "Simulated Demo (No wallet signature requested)"
                  : props.approvalStatus === "policy_blocked"
                    ? "Blocked by Policy (Signing prohibited)"
                    : props.approvalStatus === "confirmed"
                      ? "Executed & Confirmed"
                      : "Awaiting Wallet Signature"}
              </strong>
            </div>
            <div className="record-approval-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={props.mode === "demo" || !props.policyApproved}
                title={
                  props.mode === "demo"
                    ? "Demo runs stop at simulated offchain execution."
                    : !props.policyApproved
                      ? "Cannot sign a proposal that failed risk policy."
                      : "Review transaction in wallet"
                }
              >
                <Signature size={15} />
                Approve in Wallet
              </button>
            </div>
          </div>
          {props.approvalNote ? (
            <small className="record-approval-note">{props.approvalNote}</small>
          ) : null}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          8. RESULT
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-result"
        aria-labelledby="step-result-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">08</span>
            <span className="record-step-label">Result & Simulation</span>
          </div>
          <div className="record-step-tags">
            <StatusBadge
              tone={
                props.executionState === "confirmed"
                  ? "confirmed"
                  : props.executionState === "rejected" ||
                      props.executionState === "failed"
                    ? "failed"
                    : "simulation"
              }
            >
              {props.executionState === "simulated"
                ? "Simulated"
                : props.executionState === "confirmed"
                  ? "Confirmed"
                  : props.executionState === "rejected"
                    ? "Rejected"
                    : "Failed"}
            </StatusBadge>
            <InfoHint topic="simulation" label="About transaction simulation" />
          </div>
        </header>

        <div className="record-result-box">
          <p
            className="record-result-summary"
            data-testid={props.isInteractiveRun ? "decision-run-simulation" : undefined}
          >
            {props.executionSummary}
          </p>

          <dl className="record-result-facts">
            <div className="record-result-row">
              <dt>Execution State</dt>
              <dd className="record-exec-dd">{props.executionState}</dd>
            </div>
            <div className="record-result-row">
              <dt>Settlement Fee</dt>
              <dd className="tabular-num">
                {props.gasFeeLamports !== undefined && props.gasFeeLamports !== null
                  ? `${props.gasFeeLamports} lamports`
                  : "0 lamports (simulated run)"}
              </dd>
            </div>
            {props.executionEligibilityReason ? (
              <div className="record-result-row">
                <dt>Execution Eligibility</dt>
                <dd>{props.executionEligibilityReason}</dd>
              </div>
            ) : null}
            {props.modelFallbackReason ? (
              <div className="record-result-row">
                <dt>Provider Fallback</dt>
                <dd>{props.modelFallbackReason}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          9. PROOF
          ─────────────────────────────────────────────────────────── */}
      <section
        className="record-step record-step-proof"
        aria-labelledby="step-proof-title"
      >
        <header className="record-step-header">
          <div className="record-step-badge">
            <span className="record-step-num">09</span>
            <span className="record-step-label">Proof Receipt</span>
          </div>
          <div className="record-step-tags">
            <AssuranceBadge assurance={assurance} compact />
            <InfoHint topic="proof" label="About proof receipt" />
          </div>
        </header>

        <div className="record-proof-container">
          <div className="record-proof-hashes">
            <div className="record-hash-row">
              <span className="record-hash-key">Canonical Receipt Hash</span>
              <code className="record-hash-val tabular-num">{props.receiptHash}</code>
            </div>
            {props.proofId ? (
              <div className="record-hash-row">
                <span className="record-hash-key">Proof Identifier</span>
                <code
                  className="record-hash-val tabular-num"
                  data-testid={
                    props.isInteractiveRun ? "decision-run-proof-id" : undefined
                  }
                >
                  {props.proofId}
                </code>
              </div>
            ) : null}
          </div>

          <p
            className="record-assurance-copy"
            data-testid={props.isInteractiveRun ? "decision-run-assurance" : undefined}
          >
            Offchain integrity evidence: {assurance.explanation} Wallet authorization:
            not requested. Onchain settlement: none.
          </p>

          {props.persistenceNote ? (
            <p
              className="record-persistence-note"
              data-testid={
                props.isInteractiveRun ? "decision-run-persistence" : undefined
              }
            >
              Persistence: {props.persistenceNote}
            </p>
          ) : null}

          {/* Action Row */}
          <div className="record-proof-actions info-hint-anchor">
            {props.onVerify ? (
              <button
                className="secondary-button"
                type="button"
                onClick={props.onVerify}
              >
                <Fingerprint size={16} />
                Verify receipt
              </button>
            ) : null}

            <InfoHint topic="verifyReceipt" label="About verifying a receipt" />

            {props.verified !== undefined && props.verified !== null ? (
              <StatusBadge tone={props.verified ? "pass" : "block"}>
                {props.verified ? "Receipt verified" : "Receipt invalid"}
              </StatusBadge>
            ) : null}

            {props.openDecisionHref ? (
              <Link
                className="secondary-button"
                href={props.openDecisionHref}
                data-testid={
                  props.isInteractiveRun ? "decision-run-open-decision" : undefined
                }
              >
                Open Decision
              </Link>
            ) : null}

            {props.viewProofHref ? (
              <Link
                className="secondary-button"
                href={props.viewProofHref}
                data-testid={
                  props.isInteractiveRun ? "decision-run-view-proof" : undefined
                }
              >
                View Proof
              </Link>
            ) : null}

            {props.onCopyProofLink ? (
              <button
                className="secondary-button"
                type="button"
                onClick={props.onCopyProofLink}
                data-testid={
                  props.isInteractiveRun ? "decision-run-copy-proof-link" : undefined
                }
              >
                <CopySimple size={15} />
                {props.copiedState === "copied"
                  ? "Proof link copied"
                  : props.copiedState === "failed"
                    ? "Copy failed, use View Proof"
                    : "Copy Proof Link"}
              </button>
            ) : null}
          </div>

          {props.accessNote ? (
            <small className="record-proof-footnote">{props.accessNote}</small>
          ) : null}
        </div>
      </section>
    </article>
  );
}
