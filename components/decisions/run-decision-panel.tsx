"use client";

import Link from "next/link";
import { useState } from "react";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { PolicyExplanationPanel } from "@/components/shared/policy-explanation-panel";
import { assuranceForReceipt } from "@/lib/assurance";
import { describeDecisionDetailAccess } from "@/lib/decisions/detail-link";
import { verifyProofReceipt } from "@/lib/proofs/receipt";
import { decisionScenarios, type DecisionScenario } from "@/lib/decisions/scenarios";
import type { DecisionRunResult } from "@/lib/services/run-decision";

export function DecisionRunResultView({
  run,
  showDetailLink = true,
}: {
  run: DecisionRunResult;
  showDetailLink?: boolean;
}) {
  const access = describeDecisionDetailAccess(run.persisted);
  const [verified, setVerified] = useState<boolean | null>(() => {
    try {
      return verifyProofReceipt(run.receipt, run.receiptHash).valid;
    } catch {
      return false;
    }
  });

  function verify() {
    try {
      setVerified(verifyProofReceipt(run.receipt, run.receiptHash).valid);
    } catch {
      setVerified(false);
    }
  }

  const failedRules = run.policyEvaluation.checks.filter(
    (check) => check.status === "fail",
  );
  const whyLine = run.policyEvaluation.approved
    ? `Policy approved: all ${run.policyEvaluation.checks.length} checks passed. Demo mode records a simulated execution only.`
    : `Policy rejected: ${failedRules
        .map((check) => check.rule.replaceAll("_", " "))
        .join(", ")} failed. Nothing was executed.`;
  const assurance = assuranceForReceipt(run.receipt);

  return (
    <div className="decision-run-result" data-testid="decision-run-result">
      <div className="proof-verification-heading">
        <div>
          <span className="route-eyebrow">
            Fresh proposal{run.scenario ? ` · ${run.scenario} scenario` : ""}
          </span>
          <h2>{run.proposal.action}</h2>
          <p>{run.proposal.thesis}</p>
        </div>
        <StatusBadge tone={run.policyEvaluation.approved ? "pass" : "block"}>
          {run.policyEvaluation.approved ? "Approved" : "Rejected"}
        </StatusBadge>
      </div>
      <p className="decision-run-why" data-testid="decision-run-why">
        {whyLine}
      </p>
      <AssuranceBadge assurance={assurance} />
      <PolicyExplanationPanel
        approved={run.policyEvaluation.approved}
        checks={run.policyEvaluation.checks}
        headingId={`policy-explanation-${run.decisionId}`}
      />
      <dl className="decision-run-facts">
        <div>
          <dt>Execution eligibility</dt>
          <dd>{run.executionEligibility.reason}</dd>
        </div>
        <div>
          <dt>Receipt hash</dt>
          <dd>{run.receiptHash}</dd>
        </div>
        <div>
          <dt>Persistence</dt>
          <dd>{run.persisted.note}</dd>
        </div>
        {run.modelMetadata.fallback ? (
          <div>
            <dt>Provider fallback</dt>
            <dd>{run.modelMetadata.fallback.reason}</dd>
          </div>
        ) : null}
      </dl>
      <div className="decision-run-actions">
        <button className="secondary-button" type="button" onClick={verify}>
          Verify receipt
        </button>
        <StatusBadge tone={verified ? "pass" : "block"}>
          {verified ? "Receipt verified" : "Receipt invalid"}
        </StatusBadge>
        {showDetailLink && access.linkable ? (
          <Link className="secondary-button" href={`/decisions/${run.decisionId}`}>
            Open decision detail
          </Link>
        ) : null}
        {access.linkable && run.proofId ? (
          <Link className="secondary-button" href={`/proofs/${run.proofId}`}>
            Open proof receipt
          </Link>
        ) : null}
        <small>{access.note}</small>
      </div>
    </div>
  );
}

export function RunDecisionPanel({
  agentSlug = "atlas",
  agentName,
  persisted = false,
}: {
  agentSlug?: string;
  agentName?: string;
  persisted?: boolean;
}) {
  const [scenario, setScenario] = useState<DecisionScenario>("balanced");
  const selectedScenario = decisionScenarios.find((item) => item.value === scenario);
  const [run, setRun] = useState<DecisionRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/decisions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentSlug, scenario }),
      });
      const body = (await response.json()) as DecisionRunResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Decision run failed.");
      setRun(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision run failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="route-panel decision-run-panel" aria-labelledby="run-title">
      <div className="panel-heading">
        <div>
          <span>Live service path</span>
          <h2 id="run-title">
            {persisted ? "Generate decision" : "Run new decision"}
            {agentName ? ` for ${agentName}` : ""}
          </h2>
          <p>
            {persisted
              ? "Generate a fresh proposal, let the policy code approve or reject it, and store the decision, evaluation and receipt for this wallet. Demo mode never submits an onchain transaction."
              : "Generate a fresh proposal and receipt. Demo mode never submits an onchain transaction."}
          </p>
        </div>
      </div>
      <form onSubmit={submit}>
        <label>
          Scenario
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value as DecisionScenario)}
          >
            {decisionScenarios.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {selectedScenario ? (
          <small className="decision-run-scenario-note">
            {selectedScenario.description}
          </small>
        ) : null}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending
            ? "Running decision..."
            : persisted
              ? "Generate decision"
              : "Run decision"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {run ? <DecisionRunResultView run={run} /> : null}
    </section>
  );
}
