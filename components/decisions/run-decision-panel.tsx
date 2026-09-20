"use client";

import Link from "next/link";
import { useState } from "react";

import { PolicyResult, StatusBadge } from "@/components/shared/domain-primitives";
import { verifyProofReceipt } from "@/lib/proofs/receipt";
import type { DecisionRunResult, DecisionScenario } from "@/lib/services/run-decision";

export function DecisionRunResultView({ run }: { run: DecisionRunResult }) {
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

  return (
    <div className="decision-run-result">
      <div className="proof-verification-heading">
        <div>
          <span className="route-eyebrow">Fresh proposal</span>
          <h2>{run.proposal.action}</h2>
          <p>{run.proposal.thesis}</p>
        </div>
        <StatusBadge tone={run.policyEvaluation.approved ? "pass" : "block"}>
          {run.policyEvaluation.approved ? "Approved" : "Rejected"}
        </StatusBadge>
      </div>
      <div className="decision-run-checks">
        {run.policyEvaluation.checks.map((check) => (
          <PolicyResult
            key={check.rule}
            label={check.rule.replaceAll("_", " ")}
            observed={check.observed}
            threshold={check.threshold}
            detail={check.explanation}
            status={check.status === "fail" ? "block" : check.status}
          />
        ))}
      </div>
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
        <Link className="secondary-button" href={`/decisions/${run.decisionId}`}>
          Open decision detail
        </Link>
        <small>
          Demo runs without a database are kept in memory for one server instance only.
        </small>
      </div>
    </div>
  );
}

export function RunDecisionPanel() {
  const [scenario, setScenario] = useState<DecisionScenario>("balanced");
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
        body: JSON.stringify({ agentSlug: "atlas", scenario }),
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
          <h2 id="run-title">Run new decision</h2>
          <p>
            Generate a fresh proposal and receipt. Demo mode never submits an onchain
            transaction.
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
            <option value="balanced">Balanced</option>
            <option value="oversized">Oversized</option>
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Running decision..." : "Run decision"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {run ? <DecisionRunResultView run={run} /> : null}
    </section>
  );
}
