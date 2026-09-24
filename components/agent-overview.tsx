import { Sparkle, Stack, TrendUp } from "@phosphor-icons/react/dist/ssr";
import React from "react";

import { DecisionRecordView } from "@/components/decisions/decision-record-view";
import { PolicyResult, StatusBadge } from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { demoProof } from "@/fixtures/demo-proof";

type TreasuryPosition = Readonly<{
  key: string;
  symbol: string;
  amount: string;
  valuation: string | null;
  reason: string | null;
}>;

export function AgentOverview({
  treasury,
  policyChecks,
}: {
  treasury: {
    capturedAt: string;
    pricedSubtotalMicros: string;
    positions: readonly TreasuryPosition[];
  };
  policyChecks: readonly React.ComponentProps<typeof PolicyResult>[];
}) {
  const pricedSubtotal = Number(treasury.pricedSubtotalMicros) / 1_000_000;
  const { proposal, context } = demoProof.document.decision;
  const inputAsset = demoAgentBundle.assets[0];
  const outputAsset = demoAgentBundle.assets[1];

  // Map risk boundaries from policy checks
  const riskBoundaries = policyChecks.map((check) => ({
    label: check.label,
    observed: check.observed,
    threshold: check.threshold,
    status: check.status,
  }));

  const formattedChecks = policyChecks.map((check) => ({
    rule: check.label.replaceAll(" ", "_"),
    label: check.label,
    observed: check.observed,
    threshold: check.threshold,
    status: check.status,
    explanation: check.detail,
  }));

  return (
    <>
      <section className="agent-heading" aria-labelledby="agent-title">
        <div>
          <div className="heading-meta">
            <StatusBadge tone="active">Monitoring</StatusBadge>
            <span>Strategy v1.0</span>
            <span>Demo fixture</span>
            <InfoHint topic="atlas" label="About Atlas" />
          </div>
          <h2 id="agent-title">Atlas</h2>
          <p>
            Preserve capital while rotating into a bounded basket of tokenized equities.
          </p>
        </div>
        <div className="agent-owner">
          <span>Agent treasury</span>
          <strong>Deterministic fixture</strong>
          <small>No live wallet or funds are represented</small>
        </div>
      </section>

      {/* 9-Part Structured Decision Record for Prepared Demo Decision */}
      <section
        className="prepared-decision-record-section"
        aria-label="Prepared decision record"
      >
        <div className="section-kicker">
          <Sparkle aria-hidden="true" size={16} />
          <span>Prepared Baseline Decision Record</span>
        </div>

        <DecisionRecordView
          decisionId="demo-decision"
          agentName="Atlas"
          agentSlug="atlas"
          strategyVersion={1}
          policyVersion={1}
          cluster="devnet"
          mode="demo"
          timestamp={demoProof.document.decision.context.requestedAt}
          state="approved"
          stateLabel="Approved · Simulated"
          action={proposal.action}
          scenario="balanced"
          universeLabel="4 demo assets"
          thesis={proposal.thesis}
          signalSource={
            proposal.evidence?.[0]?.sourceId ??
            "Deterministic demo relative-strength fixture"
          }
          confidenceBps={proposal.confidenceBps}
          invalidationConditions={proposal.invalidationConditions}
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
          availableLiquidityUsd="2,000.00"
          quoteObservedAt={context.marketInputs?.[0]?.observedAt}
          quoteExpiresAt={context.marketInputs?.[0]?.quoteExpiresAt}
          policyHash={demoProof.document.riskPolicy.hash}
          policyApproved={demoProof.document.policyEvaluation.approved}
          policyChecks={formattedChecks}
          riskBoundaries={riskBoundaries}
          orderAmountUi={
            proposal.action !== "HOLD" ? proposal.inputAmount.uiAmount : undefined
          }
          orderAmountRaw={
            proposal.action !== "HOLD" ? proposal.inputAmount.rawAmount : undefined
          }
          expectedOutputUi={
            proposal.action !== "HOLD"
              ? proposal.minimumOutputAmount.uiAmount
              : undefined
          }
          expectedOutputRaw={
            proposal.action !== "HOLD"
              ? proposal.minimumOutputAmount.rawAmount
              : undefined
          }
          maxSlippageBps={proposal.maxSlippageBps}
          proposalSummaryLine={
            proposal.action !== "HOLD"
              ? `${proposal.action} ${inputAsset?.symbol ?? "EQA"} into ${outputAsset?.symbol ?? "EQB"}, amount ${proposal.inputAmount.uiAmount} (${proposal.inputAmount.rawAmount} base units at 6 decimals), max slippage ${proposal.maxSlippageBps} bps.`
              : "HOLD: no asset moves."
          }
          rawPayload={{
            decisionId: "demo-decision",
            proposal,
            context,
          }}
          approvalStatus="demo_simulation"
          approvalNote="The prepared Atlas demo runs in simulated demo mode. No transaction was built, signed, or transmitted on Solana."
          executionState="simulated"
          executionSummary="Simulated: a demo execution attempt was recorded. No transaction was built, signed, or sent."
          gasFeeLamports={0}
          proofId="demo-proof"
          receiptHash={demoProof.receiptHash}
          assuranceLevel="offchain_integrity"
          assuranceOrigin="demo_simulation"
          openDecisionHref="/agents/atlas/decisions/demo-decision"
          viewProofHref="/proofs/demo-proof"
          accessNote="Public reference demo record with canonical hash anchoring."
        />
      </section>

      {/* Treasury Portfolio Section */}
      <section
        className="route-panel treasury-summary-panel"
        aria-labelledby="treasury-title"
      >
        <div className="panel-heading">
          <Stack aria-hidden="true" size={22} />
          <div>
            <span>Treasury</span>
            <h2 id="treasury-title">Demo portfolio snapshot</h2>
          </div>
        </div>

        <div className="treasury-priced-total">
          <span>Priced subtotal</span>
          <strong className="tabular-num">
            $
            {pricedSubtotal.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USD
          </strong>
          <small>Excludes unpriced balances · Captured at {treasury.capturedAt}</small>
        </div>

        <div className="treasury-positions-grid">
          {treasury.positions.map((position) => (
            <div
              key={position.key}
              className="treasury-position-card"
              data-unpriced={position.valuation === null || undefined}
            >
              <div className="position-head">
                <strong className="position-symbol">{position.symbol}</strong>
                <span className="position-amount tabular-num">
                  {position.amount} units
                </span>
              </div>
              <div className="position-val-row">
                {position.valuation ? (
                  <strong className="position-valuation tabular-num">
                    $
                    {(Number(position.valuation) / 1_000_000).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    USD
                  </strong>
                ) : (
                  <span className="treasury-unpriced">
                    <TrendUp size={14} /> Unpriced
                  </span>
                )}
              </div>
              {position.reason ? (
                <small className="position-reason">{position.reason}</small>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
