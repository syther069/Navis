"use client";

import { Clock, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";

import { DecisionRecordView } from "@/components/decisions/decision-record-view";
import {
  browserStorage,
  clearPendingRun,
  runRequestKeyFor,
} from "@/components/decisions/run-request-key";
import { PreStocksResearchView } from "@/components/markets/prestocks/prestocks-research";
import { InfoHint } from "@/components/shared/info-hint";
import { PolicyExplanationPanel } from "@/components/shared/policy-explanation-panel";
import { assuranceForReceipt } from "@/lib/assurance";
import { describeDecisionDetailAccess } from "@/lib/decisions/detail-link";
import { decisionScenarios, type DecisionScenario } from "@/lib/decisions/scenarios";
import {
  decisionUniverses,
  type DecisionUniverseSource,
} from "@/lib/decisions/universe";
import { verifyProofReceipt } from "@/lib/proofs/receipt";
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

  const isTrade = run.proposal.action !== "HOLD";
  const inputAsset = isTrade ? assetsByMint.get(run.proposal.inputMint) : undefined;
  const outputAsset = isTrade ? assetsByMint.get(run.proposal.outputMint) : undefined;

  const proposalLine = isTrade
    ? `${run.proposal.action} ${describeMint(run.proposal.inputMint)} into ${describeMint(run.proposal.outputMint)}, amount ${run.proposal.inputAmount.uiAmount} ${describeMint(run.proposal.inputMint).split(" ")[0]} (${run.proposal.inputAmount.rawAmount} base units at ${run.proposal.inputAmount.decimals} decimals), max slippage ${run.proposal.maxSlippageBps} bps.`
    : "HOLD: no asset moves.";

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

  // Map policy checks for structured view
  const formattedPolicyChecks = run.policyEvaluation.checks.map((check) => ({
    rule: check.rule,
    label: check.rule.replaceAll("_", " "),
    observed: check.observed,
    threshold: check.threshold,
    status: check.status === "fail" ? ("block" as const) : check.status,
    explanation: check.explanation,
  }));

  // Map risk boundaries scorecard
  const riskBoundaries = [
    "max_trade_bps",
    "max_position_bps",
    "min_reserve_bps",
    "max_slippage_bps",
    "max_daily_turnover_bps",
  ].flatMap((rule) => {
    const check = run.policyEvaluation.checks.find(
      (candidate) => candidate.rule === rule,
    );
    if (!check) return [];
    return [
      {
        label: rule.replaceAll("_", " "),
        observed: rule.endsWith("_bps")
          ? `${(Number(check.observed) / 100).toFixed(2)}%`
          : check.observed,
        threshold: rule.endsWith("_bps")
          ? `${(Number(check.threshold) / 100).toFixed(2)}%`
          : check.threshold,
        status: check.status === "fail" ? ("block" as const) : check.status,
      },
    ];
  });

  const rawPayload = {
    decisionId: run.decisionId,
    scenario: run.scenario,
    proposal: run.proposal,
    policyInputHash: run.receipt.policyEvaluation.inputHash,
    receiptHash: run.receiptHash,
    context: run.receipt.decision.context,
  };

  const decisionState = !run.policyEvaluation.approved
    ? "blocked"
    : executionState === "confirmed"
      ? "confirmed"
      : executionState === "failed" || executionState === "rejected"
        ? "failed"
        : "approved";

  return (
    <DecisionRecordView
      isInteractiveRun={true}
      decisionId={run.decisionId}
      agentName={
        run.receipt.decision.context.agentId === "demo_agent_atlas"
          ? "Atlas"
          : undefined
      }
      agentSlug="atlas"
      strategyVersion={run.receipt.decision.context.strategy?.version}
      policyVersion={run.receipt.decision.context.riskPolicy?.version}
      cluster={run.receipt.cluster}
      mode={run.receipt.mode}
      timestamp={run.generatedAt}
      state={decisionState}
      stateLabel={run.policyEvaluation.approved ? "Approved" : "Rejected"}
      action={run.proposal.action}
      scenario={run.scenario ?? undefined}
      universeLabel={universeLabel}
      thesis={whyLine}
      signalSource={
        run.proposal.evidence?.[0]?.sourceId ??
        "Deterministic demo relative-strength fixture"
      }
      confidenceBps={run.proposal.confidenceBps}
      invalidationConditions={run.proposal.invalidationConditions}
      inputAsset={
        inputAsset
          ? {
              symbol: inputAsset.symbol,
              name: inputAsset.name,
              mint: inputAsset.mint,
              decimals: inputAsset.decimals,
            }
          : undefined
      }
      outputAsset={
        outputAsset
          ? {
              symbol: outputAsset.symbol,
              name: outputAsset.name,
              mint: outputAsset.mint,
              decimals: outputAsset.decimals,
            }
          : undefined
      }
      availableLiquidityUsd={
        run.receipt.decision.context.marketInputs?.[0]?.liquidityUsdMicros
          ? (
              Number(run.receipt.decision.context.marketInputs[0].liquidityUsdMicros) /
              1_000_000
            ).toLocaleString("en-US", { minimumFractionDigits: 2 })
          : null
      }
      quoteObservedAt={run.receipt.decision.context.marketInputs?.[0]?.observedAt}
      quoteExpiresAt={run.receipt.decision.context.marketInputs?.[0]?.quoteExpiresAt}
      policyHash={run.receipt.riskPolicy.hash}
      policyApproved={run.policyEvaluation.approved}
      policyChecks={formattedPolicyChecks}
      policyExplanationChild={
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
      }
      prestocksResearch={
        prestocks ? (
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
        ) : null
      }
      riskBoundaries={riskBoundaries}
      orderAmountUi={isTrade ? run.proposal.inputAmount.uiAmount : undefined}
      orderAmountRaw={isTrade ? run.proposal.inputAmount.rawAmount : undefined}
      expectedOutputUi={isTrade ? run.proposal.minimumOutputAmount.uiAmount : undefined}
      expectedOutputRaw={
        isTrade ? run.proposal.minimumOutputAmount.rawAmount : undefined
      }
      maxSlippageBps={run.proposal.maxSlippageBps}
      proposalSummaryLine={proposalLine}
      rawPayload={rawPayload}
      approvalStatus={
        !run.policyEvaluation.approved
          ? "policy_blocked"
          : run.receipt.mode === "demo"
            ? "demo_simulation"
            : "awaiting_wallet"
      }
      approvalNote={
        run.receipt.mode === "demo"
          ? "Demo runs stop at offchain simulation. No wallet signature was requested."
          : undefined
      }
      executionState={
        executionState === "simulated"
          ? "simulated"
          : executionState === "rejected"
            ? "rejected"
            : "failed"
      }
      executionSummary={simulationLine}
      gasFeeLamports={run.receipt.execution.feeLamports}
      proofId={run.proofId}
      receiptHash={run.receiptHash}
      assuranceLevel={assurance.level}
      assuranceOrigin={assurance.origin}
      verified={verified}
      onVerify={verify}
      openDecisionHref={
        showDetailLink && access.linkable ? `/decisions/${run.decisionId}` : null
      }
      viewProofHref={access.linkable && proofPath ? proofPath : null}
      onCopyProofLink={access.linkable && proofPath ? copyProofLink : undefined}
      copiedState={copied}
      accessNote={`${access.note}${
        stored
          ? " Receipt verification status above was recomputed in this browser from the stored document."
          : ""
      }`}
      universeNote={universe.note}
      persistenceNote={run.persisted.note}
      executionEligibilityReason={run.executionEligibility.reason}
      modelFallbackReason={run.modelMetadata.fallback?.reason}
    />
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

      <form onSubmit={submit} className="decision-run-form">
        <div className="decision-form-grid">
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
            {selectedScenario ? (
              <small className="decision-run-scenario-note">
                {selectedScenario.description}
              </small>
            ) : null}
          </label>

          {persisted ? null : (
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
              {selectedUniverse ? (
                <small className="decision-run-scenario-note">
                  {selectedUniverse.description}
                </small>
              ) : null}
            </label>
          )}
        </div>

        <button className="primary-button" type="submit" disabled={pending}>
          {pending
            ? "Running decision..."
            : persisted
              ? "Generate decision"
              : "Run decision"}
        </button>
      </form>

      {/* Intentional Loading State */}
      {pending ? (
        <div className="decision-loading-state" role="status" aria-live="polite">
          <div className="decision-loading-track">
            <div className="decision-loading-indicator" />
          </div>
          <div className="decision-loading-copy">
            <strong>Formulating proposal & evaluating risk policy...</strong>
            <p>
              Simulating market order and evaluating deterministic policy boundaries.
              Typically completes in ~1-2 seconds.
            </p>
          </div>
        </div>
      ) : null}

      {/* Intentional Error State */}
      {error ? (
        <div className="decision-error-state" role="alert">
          <WarningCircle size={22} className="decision-error-icon" />
          <div className="decision-error-copy">
            <strong>Decision evaluation halted</strong>
            <p>{error}</p>
            <small>
              What you can do: check your connection, or switch to the devnet fixture
              universe and run again.
            </small>
          </div>
        </div>
      ) : null}

      {/* Intentional Empty State (when idle and no run yet) */}
      {!run && !pending && !error ? (
        <div className="decision-idle-state">
          <div className="decision-idle-icon" aria-hidden="true">
            <Clock size={20} />
          </div>
          <div className="decision-idle-copy">
            <strong>Ready to evaluate a decision</strong>
            <p>
              Choose a scenario and asset universe above, then trigger a run. Atlas will
              formulate a candidate trade order, test it against hard deterministic
              policy rules, and generate a verifiable cryptographic proof receipt.
            </p>
          </div>
        </div>
      ) : null}

      {/* Decision Record Result */}
      {run ? <DecisionRunResultView run={run} /> : null}
    </section>
  );
}
