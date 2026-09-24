import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { assuranceForReceipt } from "@workspace/navis-core/lib/assurance";

import {
  bpsToPercent,
  deriveLifecycle,
  formatTimestamp,
  relativeTime,
  shortHash,
  walletApprovalFor,
} from "./lifecycle";
import { LifecycleChip, LifecycleRail } from "./primitives";
import { headlineFor, policyTally, whyLineFor } from "./run-format";
import type { DecisionRunResult, StoredDecisionSummary } from "./types";
import { WorkspaceHint } from "./workspace-hint";

/**
 * The dashboard's lead surface: the newest real decision, answering what
 * Atlas proposed, why, what policy said, whether you approved, and what
 * proves it. Built from a full run when available.
 */
export function DecisionBrief({ run }: { run: DecisionRunResult }) {
  const lifecycle = deriveLifecycle({
    approved: run.policyEvaluation.approved,
    executionState: run.receipt.execution.state,
    signature: run.receipt.execution.transactionSignature,
    mode: run.receipt.mode,
  });
  const tally = policyTally(run);
  const assurance = assuranceForReceipt(run.receipt);
  const linkable = run.persisted.store === "database";
  const walletApproval = walletApprovalFor(lifecycle, run.receipt.execution.transactionSignature);

  return (
    <article className="ws-brief" aria-labelledby="brief-title" data-tone={lifecycle.tone}>
      <header className="ws-brief-head">
        <div>
          <span className="ws-eyebrow">
            Latest decision · {run.agent.name} ·{" "}
            <time dateTime={run.generatedAt} title={formatTimestamp(run.generatedAt)}>
              {relativeTime(run.generatedAt) ?? formatTimestamp(run.generatedAt)}
            </time>
          </span>
          <h2 id="brief-title" data-testid="text-latest-headline">
            {headlineFor(run)}
          </h2>
        </div>
        <div className="ws-heading-row">
          <LifecycleChip lifecycle={lifecycle} testId="status-latest-stage" />
          <WorkspaceHint topic="lifecycle" label="About decision status" align="end" />
        </div>
      </header>

      <LifecycleRail lifecycle={lifecycle} label="Latest decision lifecycle" />

      <dl className="ws-brief-grid">
        <div className="ws-brief-cell" data-span="wide">
          <dt>
            Atlas proposed <WorkspaceHint topic="proposal" label="About the proposal" />
          </dt>
          <dd className="ws-clamp">{run.proposal.thesis}</dd>
        </div>
        <div className="ws-brief-cell">
          <dt>
            Policy and risk <WorkspaceHint topic="policyVerdict" label="About the policy verdict" />
          </dt>
          <dd>
            <span className="ws-tally">
              <span data-status="pass">{tally.passed} passed</span>
              <span data-status="warn">{tally.warned} warned</span>
              <span data-status="fail">{tally.failed} failed</span>
            </span>
            <small>{whyLineFor(run)}</small>
          </dd>
        </div>
        <div className="ws-brief-cell">
          <dt>
            Your approval <WorkspaceHint topic="walletApproval" label="About your approval" />
          </dt>
          <dd>
            <strong>{walletApproval.label}</strong>
            <small>{walletApproval.detail} Policy approval is not wallet approval.</small>
          </dd>
        </div>
        <div className="ws-brief-cell">
          <dt>
            Proof <WorkspaceHint topic="proofReceipt" label="About the proof receipt" />
          </dt>
          <dd>
            <AssuranceBadge assurance={assurance} compact />
            <code className="ws-mono-inline">{shortHash(run.receiptHash, 10, 6)}</code>
          </dd>
        </div>
        <div className="ws-brief-cell">
          <dt>Confidence</dt>
          <dd>
            <strong className="ws-figure">{bpsToPercent(run.proposal.confidenceBps)}</strong>
            <small>Self-reported. Policy does not use it.</small>
          </dd>
        </div>
      </dl>

      <div className="ws-brief-actions">
        {linkable ? (
          <Link
            className="primary-button"
            href={`/decisions/${run.decisionId}`}
            data-testid="link-latest-decision"
          >
            Open decision record <ArrowRight aria-hidden="true" size={15} />
          </Link>
        ) : null}
        {linkable && run.proofId ? (
          <Link
            className="secondary-button"
            href={`/proofs/${run.proofId}`}
            data-testid="link-latest-receipt"
          >
            View Receipt
          </Link>
        ) : null}
        <span className="ws-caption">{lifecycle.summary}</span>
      </div>
    </article>
  );
}

/** Fallback when only the stored summary is available. */
export function DecisionSummaryBrief({ decision }: { decision: StoredDecisionSummary }) {
  const lifecycle = deriveLifecycle({
    approved: decision.approved,
    executionState: decision.executionState,
    mode: decision.agent.mode,
    evidence: "summary",
  });
  return (
    <article className="ws-brief" aria-labelledby="brief-title" data-tone={lifecycle.tone}>
      <header className="ws-brief-head">
        <div>
          <span className="ws-eyebrow">
            Latest decision · {decision.agent.name} ·{" "}
            <time dateTime={decision.createdAt}>
              {relativeTime(decision.createdAt) ?? formatTimestamp(decision.createdAt)}
            </time>
          </span>
          <h2 id="brief-title" data-testid="text-latest-headline">
            {decision.action} proposal
          </h2>
        </div>
        <LifecycleChip lifecycle={lifecycle} testId="status-latest-stage" />
      </header>
      <LifecycleRail lifecycle={lifecycle} label="Latest decision lifecycle" />
      <div className="ws-brief-actions">
        <Link
          className="primary-button"
          href={`/decisions/${decision.decisionId}`}
          data-testid="link-latest-decision"
        >
          Open decision record <ArrowRight aria-hidden="true" size={15} />
        </Link>
        <span className="ws-caption">{lifecycle.summary}</span>
      </div>
    </article>
  );
}
