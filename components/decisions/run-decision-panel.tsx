"use client";

import Link from "next/link";
import { useState } from "react";

import {
  browserStorage,
  clearPendingRun,
  runRequestKeyFor,
} from "@/components/decisions/run-request-key";

import { PreStocksResearchView } from "@/components/markets/prestocks/prestocks-research";
import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import { PolicyExplanationPanel } from "@/components/shared/policy-explanation-panel";
import { assuranceForReceipt } from "@/lib/assurance";
import { describeDecisionDetailAccess } from "@/lib/decisions/detail-link";
import { verifyProofReceipt } from "@/lib/proofs/receipt";
import { decisionScenarios, type DecisionScenario } from "@/lib/decisions/scenarios";
import {
  decisionUniverses,
  type DecisionUniverseSource,
} from "@/lib/decisions/universe";
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
  const warnedRules = run.policyEvaluation.checks.filter(
    (check) => check.status === "warn",
  );
  const whyLine = run.policyEvaluation.approved
    ? warnedRules.length > 0
      ? `Policy approved: ${run.policyEvaluation.checks.length - warnedRules.length} of ${run.policyEvaluation.checks.length} checks passed and ${warnedRules.length} warned. Demo mode records a simulated execution only.`
      : `Policy approved: all ${run.policyEvaluation.checks.length} checks passed. Demo mode records a simulated execution only.`
    : `Policy rejected: ${failedRules
        .map((check) => check.rule.replaceAll("_", " "))
        .join(", ")} failed. Nothing was executed.`;
  const assurance = assuranceForReceipt(run.receipt);
  const universe = run.universe;
  const prestocks = universe.prestocks;
  const universeLabel =
    decisionUniverses.find((item) => item.value === universe.used)?.label ??
    universe.used;
  const stored = run.persisted.store === "database";
  const assetsByMint = new Map(
    run.receipt.decision.context.assets.map((asset) => [asset.mint, asset]),
  );
  const describeMint = (mint: string) => {
    const asset = assetsByMint.get(mint);
    return asset ? `${asset.symbol} (${asset.name})` : mint;
  };
  const proposalLine =
    run.proposal.action === "HOLD"
      ? "HOLD: no asset moves."
      : `${run.proposal.action} ${describeMint(run.proposal.inputMint)} into ${describeMint(run.proposal.outputMint)}, amount ${run.proposal.inputAmount.uiAmount} ${describeMint(run.proposal.inputMint).split(" ")[0]} (${run.proposal.inputAmount.rawAmount} base units at ${run.proposal.inputAmount.decimals} decimals), max slippage ${run.proposal.maxSlippageBps} bps.`;
  const executionState = run.receipt.execution.state;
  const simulationLine =
    executionState === "simulated"
      ? "Simulated: a demo execution attempt was recorded. No transaction was built, signed or sent."
      : executionState === "rejected"
        ? "Rejected: the execution attempt was closed by the policy result. Nothing was executed."
        : `${executionState}`;
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const proofPath = run.proofId ? `/proofs/${run.proofId}` : null;

  async function copyProofLink() {
    if (!proofPath) return;
    try {
      const url = new URL(proofPath, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="decision-run-result" data-testid="decision-run-result">
      <div className="proof-verification-heading">
        <div>
          <span className="route-eyebrow">
            Fresh proposal{run.scenario ? ` · ${run.scenario} scenario` : ""}
            {` · ${universeLabel}`}
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
      {universe.note ? (
        <p
          className="decision-run-universe-note"
          data-testid="decision-run-universe-note"
        >
          {universe.note}
        </p>
      ) : null}
      <PolicyExplanationPanel
        approved={run.policyEvaluation.approved}
        checks={run.policyEvaluation.checks}
        headingId={`policy-explanation-${run.decisionId}`}
        factSources={prestocks?.factsUsed}
        factSourceLabel="PreStocks fact"
        note={
          prestocks
            ? "Trade size, positions and turnover are measured from the proposal at PreStocks token prices against the fictional research holdings. The reserve floor, slippage, cooldown and mode checks use the scenario and the agent policy only: the research portfolio has no cash leg."
            : undefined
        }
      />
      {prestocks ? (
        <PreStocksResearchView
          research={prestocks.research}
          capturedAt={prestocks.capturedAt}
          sourceUrl={prestocks.sourceUrl}
          positions={prestocks.allocation.positions}
          portfolioValueUsdMicros={prestocks.allocation.portfolioValueUsdMicros}
          excluded={prestocks.excluded}
          headingId={`prestocks-research-${run.decisionId}`}
          eyebrow="PreStocks research used by this run"
          title="Premium, discount, valuation gap and allocation impact"
        />
      ) : null}
      <dl className="decision-run-facts">
        <div>
          <dt>Decision ID</dt>
          <dd data-testid="decision-run-id">{run.decisionId}</dd>
        </div>
        <div>
          <dt>Generated at</dt>
          <dd>{run.generatedAt}</dd>
        </div>
        <div>
          <dt>Asset and proposed action</dt>
          <dd data-testid="decision-run-proposal">{proposalLine}</dd>
        </div>
        <div>
          <dt>Policy result</dt>
          <dd>
            {run.policyEvaluation.approved
              ? "Approved by the deterministic policy checks."
              : "Rejected by the deterministic policy checks."}{" "}
            This is policy approval only; it is not wallet authorization and not onchain
            execution.
          </dd>
        </div>
        <div>
          <dt>Simulation status</dt>
          <dd data-testid="decision-run-simulation">{simulationLine}</dd>
        </div>
        <div>
          <dt>What the receipt proves</dt>
          <dd data-testid="decision-run-assurance">
            Offchain integrity evidence: {assurance.explanation} Wallet authorization:
            not requested. Onchain settlement: none.
          </dd>
        </div>
        <div>
          <dt>Asset universe</dt>
          <dd>
            {universeLabel}
            {universe.requested !== universe.used
              ? ` (requested ${universe.requested})`
              : ""}
            {run.receipt.dataSource
              ? `. Data source: ${run.receipt.dataSource.source}, read ${run.receipt.dataSource.capturedAt}.`
              : ""}
          </dd>
        </div>
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
          <dd data-testid="decision-run-persistence">{run.persisted.note}</dd>
        </div>
        {run.proofId ? (
          <div>
            <dt>Proof ID</dt>
            <dd data-testid="decision-run-proof-id">{run.proofId}</dd>
          </div>
        ) : null}
        {run.modelMetadata.fallback ? (
          <div>
            <dt>Provider fallback</dt>
            <dd>{run.modelMetadata.fallback.reason}</dd>
          </div>
        ) : null}
      </dl>
      <div className="decision-run-actions info-hint-anchor">
        <button className="secondary-button" type="button" onClick={verify}>
          Verify receipt
        </button>
        <InfoHint topic="verifyReceipt" label="About verifying a receipt" />
        <StatusBadge tone={verified ? "pass" : "block"}>
          {verified ? "Receipt verified" : "Receipt invalid"}
        </StatusBadge>
        {showDetailLink && access.linkable ? (
          <Link
            className="secondary-button"
            href={`/decisions/${run.decisionId}`}
            data-testid="decision-run-open-decision"
          >
            Open Decision
          </Link>
        ) : null}
        {access.linkable && proofPath ? (
          <Link
            className="secondary-button"
            href={proofPath}
            data-testid="decision-run-view-proof"
          >
            View Proof
          </Link>
        ) : null}
        {access.linkable && proofPath ? (
          <button
            className="secondary-button"
            type="button"
            onClick={copyProofLink}
            data-testid="decision-run-copy-proof-link"
          >
            {copied === "copied"
              ? "Proof link copied"
              : copied === "failed"
                ? "Copy failed, use View Proof"
                : "Copy Proof Link"}
          </button>
        ) : null}
        <small>
          {access.note}
          {stored
            ? " Receipt verification status above was recomputed in this browser from the stored document."
            : ""}
        </small>
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
  // Stored agents keep their own immutable allowlist, so the universe choice
  // only applies to the in-memory Atlas demo run.
  const [universe, setUniverse] = useState<DecisionUniverseSource>(
    persisted ? "fixture" : "prestocks",
  );
  const selectedUniverse = decisionUniverses.find((item) => item.value === universe);
  const [run, setRun] = useState<DecisionRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    // One key per submission. It survives a failed or interrupted request so
    // a retry returns the stored run instead of a twin; a confirmed run
    // clears it so the next click produces a fresh decision.
    const store = browserStorage();
    const requestKey = persisted
      ? undefined
      : runRequestKeyFor(store, { agentSlug, scenario, universe });
    try {
      const response = await fetch("/api/decisions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentSlug,
          scenario,
          universe,
          ...(requestKey ? { requestKey } : {}),
        }),
      });
      const body = (await response.json()) as DecisionRunResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Decision run failed.");
      if (requestKey) clearPendingRun(store);
      setRun(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision run failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="route-panel decision-run-panel" aria-labelledby="run-title">
      <div className="panel-heading info-hint-anchor">
        <div>
          <span>Live service path</span>
          <div className="heading-with-hint">
            <h2 id="run-title">
              {persisted ? "Generate decision" : "Run new decision"}
              {agentName ? ` for ${agentName}` : ""}
            </h2>
            <InfoHint topic="runDecision" label="About running a decision" />
          </div>
          <p>
            {persisted
              ? "Generate a fresh proposal, let the policy code approve or reject it, and store the decision, evaluation and receipt for this wallet. Demo mode never submits an onchain transaction."
              : "Generate a fresh proposal, let the policy code approve or reject it, and store the decision, evaluation and receipt as a public record with stable links. Demo mode never submits an onchain transaction."}
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
        {persisted ? null : (
          <>
            <label>
              Asset universe
              <select
                value={universe}
                data-testid="decision-run-universe"
                onChange={(event) =>
                  setUniverse(event.target.value as DecisionUniverseSource)
                }
              >
                {decisionUniverses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedUniverse ? (
              <small className="decision-run-scenario-note">
                {selectedUniverse.description}
              </small>
            ) : null}
          </>
        )}
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
