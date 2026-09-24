import { Check, Copy, ExternalLink, FileSearch, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { PreStocksResearchView } from "@/components/markets/prestocks/prestocks-research";
import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { PolicyExplanationPanel } from "@/components/shared/policy-explanation-panel";
import { assuranceForReceipt } from "@workspace/navis-core/lib/assurance";
import { describeDecisionDetailAccess } from "@workspace/navis-core/lib/decisions/detail-link";
import { decisionUniverses } from "@workspace/navis-core/lib/decisions/universe";

import {
  bpsToPercent,
  deriveLifecycle,
  formatTimestamp,
  shortHash,
  usdFromMicros,
  walletApprovalFor,
} from "./lifecycle";
import { LifecycleChip, LifecycleRail, SectionHead } from "./primitives";
import { checkReceiptIntegrity } from "./receipt-integrity";
import type { DecisionRecordInput } from "./types";
import { WorkspaceHint } from "./workspace-hint";

type RiskConstraint =
  DecisionRecordInput["receipt"]["riskPolicy"]["document"]["constraints"][number];

const recordSections = [
  { key: "decision", label: "Decision" },
  { key: "rationale", label: "Rationale" },
  { key: "market", label: "Market inputs" },
  { key: "policy", label: "Policy" },
  { key: "risk", label: "Risk" },
  { key: "action", label: "Proposed action" },
  { key: "approval", label: "User approval" },
  { key: "result", label: "Result" },
  { key: "proof", label: "Proof" },
] as const;

const constraintLabels: Record<RiskConstraint["type"], string> = {
  allowed_mints: "Allowed assets",
  max_trade_bps: "Max trade size",
  max_position_bps: "Max position",
  min_reserve_bps: "Reserve floor",
  max_slippage_bps: "Max slippage",
  max_daily_turnover_bps: "Max daily turnover",
  cooldown_seconds: "Cooldown",
  max_data_age_seconds: "Max data age",
  min_liquidity_usd_micros: "Min liquidity",
  allowed_modes: "Allowed modes",
};

function describeConstraint(constraint: RiskConstraint) {
  switch (constraint.type) {
    case "allowed_mints":
      return `${constraint.mints.length} asset${constraint.mints.length === 1 ? "" : "s"}`;
    case "allowed_modes":
      return constraint.modes.join(", ");
    case "cooldown_seconds":
    case "max_data_age_seconds":
      return constraint.value >= 120
        ? `${Math.round(constraint.value / 60)} min`
        : `${constraint.value} s`;
    case "min_liquidity_usd_micros":
      return usdFromMicros(constraint.value) ?? constraint.value;
    default:
      return bpsToPercent(constraint.value);
  }
}

function RecordSection({
  id,
  index,
  title,
  hint,
  hintLabel,
  aside,
  children,
}: {
  id: string;
  index: number;
  title: string;
  hint?: Parameters<typeof SectionHead>[0]["hint"];
  hintLabel?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ws-record-section" id={id} aria-labelledby={`${id}-title`}>
      <span className="ws-record-index" aria-hidden="true">
        {String(index).padStart(2, "0")}
      </span>
      <div className="ws-record-body">
        <SectionHead
          id={`${id}-title`}
          title={title}
          hint={hint}
          hintLabel={hintLabel}
          aside={aside}
          level={3}
        />
        {children}
      </div>
    </section>
  );
}

function Fact({
  label,
  children,
  mono = false,
  testId,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  testId?: string;
}) {
  return (
    <div className="ws-fact">
      <dt>{label}</dt>
      <dd data-mono={mono || undefined} data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

/**
 * The structured decision record: one document read top to bottom, in the
 * order authority flows. Presentation only; every value is from the run.
 */
export function DecisionRecord({
  run,
  showDetailLink = true,
}: {
  run: DecisionRecordInput;
  showDetailLink?: boolean;
}) {
  const idPrefix = `record-${run.decisionId.slice(0, 12)}`;
  const access = run.persisted.store === "static_fixture"
    ? { linkable: true, note: run.persisted.note }
    : describeDecisionDetailAccess(run.persisted);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [rechecked, setRechecked] = useState(false);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    let active = true;
    setVerified(null);
    checkReceiptIntegrity(run)
      .then((result) => {
        if (active) setVerified(result.valid);
      })
      .catch(() => {
        if (active) setVerified(false);
      });
    return () => {
      active = false;
    };
  }, [run]);

  function verify() {
    setVerified(null);
    checkReceiptIntegrity(run)
      .then((result) => setVerified(result.valid))
      .catch(() => setVerified(false))
      .finally(() => setRechecked(true));
  }

  const checks = run.policyEvaluation.checks;
  const failedRules = checks.filter((check) => check.status === "fail");
  const warnedRules = checks.filter((check) => check.status === "warn");
  const passedCount = checks.length - failedRules.length - warnedRules.length;
  const approved = run.policyEvaluation.approved;

  const whyLine = approved
    ? warnedRules.length > 0
      ? `Policy approved: ${checks.length - warnedRules.length} of ${checks.length} checks passed and ${warnedRules.length} warned. Demo mode records a simulated execution only.`
      : `Policy approved: all ${checks.length} checks passed. Demo mode records a simulated execution only.`
    : `Policy rejected: ${failedRules
        .map((check) => check.rule.replaceAll("_", " "))
        .join(", ")} failed. Nothing was executed.`;

  const assurance = assuranceForReceipt(run.receipt);
  const universe = run.universe;
  const prestocks = universe.prestocks;
  const universeLabel =
    decisionUniverses.find((item) => item.value === universe.used)?.label ?? universe.used;
  const fixtureUniverse = universe.used === "fixture";

  const assets = run.receipt.decision.context.assets;
  const assetsByMint = useMemo(
    () => new Map(assets.map((asset) => [asset.mint, asset])),
    [assets],
  );
  const marketByMint = useMemo(
    () =>
      new Map(run.receipt.decision.context.marketInputs.map((input) => [input.mint, input])),
    [run.receipt.decision.context.marketInputs],
  );
  const describeMint = (mint: string) => {
    const asset = assetsByMint.get(mint);
    return asset ? `${asset.symbol} (${asset.name})` : mint;
  };
  const symbolFor = (mint: string) => assetsByMint.get(mint)?.symbol ?? shortHash(mint, 4, 4);

  const proposal = run.proposal;
  const proposalLine =
    proposal.action === "HOLD"
      ? "HOLD: no asset moves."
      : `${proposal.action} ${describeMint(proposal.inputMint)} into ${describeMint(proposal.outputMint)}, amount ${proposal.inputAmount.uiAmount} ${describeMint(proposal.inputMint).split(" ")[0]} (${proposal.inputAmount.rawAmount} base units at ${proposal.inputAmount.decimals} decimals), max slippage ${proposal.maxSlippageBps} bps.`;
  const headline =
    proposal.action === "HOLD"
      ? "Hold. No asset moves."
      : `${proposal.action === "REBALANCE" ? "Rebalance" : proposal.action === "BUY" ? "Buy" : "Sell"} ${proposal.inputAmount.uiAmount} ${symbolFor(proposal.inputMint)} into ${symbolFor(proposal.outputMint)}`;

  const executionState = run.receipt.execution.state;
  const simulationLine =
    executionState === "simulated"
      ? "Simulated: a demo execution attempt was recorded. No transaction was built, signed or sent."
      : executionState === "rejected"
        ? "Rejected: the execution attempt was closed by the policy result. Nothing was executed."
        : `${executionState}`;

  const lifecycle = deriveLifecycle({
    approved,
    executionState,
    signature: run.receipt.execution.transactionSignature,
    mode: run.receipt.mode,
  });
  const walletApproval = walletApprovalFor(lifecycle, run.receipt.execution.transactionSignature);

  const proofPath = run.proofId ? `/proofs/${run.proofId}` : null;
  async function copyProofLink() {
    if (!proofPath) return;
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const url = new URL(`${base}${proofPath}`, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  const riskConstraints = run.receipt.riskPolicy.document.constraints;
  const checkStatusFor = (rule: string) => checks.find((check) => check.rule === rule)?.status;
  const dataSource = run.receipt.dataSource;

  return (
    <article
      className="ws-record"
      data-testid="decision-run-result"
      data-outcome={approved ? "approved" : "rejected"}
      aria-labelledby={`${idPrefix}-headline`}
    >
      <header className="ws-record-head">
        <div className="ws-record-title">
          <span className="ws-eyebrow">
            Decision record · {run.agent.name}
            {run.scenario ? ` · ${run.scenario} scenario` : ""} · {universeLabel}
          </span>
          <h2 id={`${idPrefix}-headline`}>{headline}</h2>
          <p className="ws-record-summary">{lifecycle.summary}</p>
        </div>
        <div className="ws-record-seal">
          <div className="ws-heading-row">
            <LifecycleChip lifecycle={lifecycle} testId="decision-run-stage" />
            <WorkspaceHint topic="lifecycle" label="About decision status" align="end" />
          </div>
          <StatusBadge tone={approved ? "pass" : "block"}>
            {approved ? "Policy approved" : "Policy rejected"}
          </StatusBadge>
        </div>
      </header>

      <LifecycleRail lifecycle={lifecycle} />

      <div className="ws-record-grid">
        <nav className="ws-record-nav" aria-label="Record sections">
          <ol>
            {recordSections.map((section, index) => (
              <li key={section.key}>
                <a href={`#${idPrefix}-${section.key}`}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="ws-record-sections">
          <RecordSection id={`${idPrefix}-decision`} index={1} title="Decision" hint="atlas" hintLabel="About Atlas">
            <dl className="ws-facts">
              <Fact label="Decision ID" mono testId="decision-run-id">
                {run.decisionId}
              </Fact>
              <Fact label="Generated">{formatTimestamp(run.generatedAt)}</Fact>
              <Fact label="Agent">
                {run.agent.name} · <span className="ws-mono">{run.agent.mode}</span>
              </Fact>
              <Fact label="Proposer">
                {run.modelMetadata.provider === "demo"
                  ? "Deterministic demo provider"
                  : run.modelMetadata.provider}{" "}
                · <span className="ws-mono">{run.modelMetadata.model}</span>
              </Fact>
              <Fact label="Valid until">{formatTimestamp(proposal.expiresAt)}</Fact>
              {run.modelMetadata.fallback ? (
                <Fact label="Provider fallback">{run.modelMetadata.fallback.reason}</Fact>
              ) : null}
            </dl>
          </RecordSection>

          <RecordSection id={`${idPrefix}-rationale`} index={2} title="Rationale">
            <p className="ws-thesis">{proposal.thesis}</p>
            <p className="ws-why" data-testid="decision-run-why" data-approved={approved || undefined}>
              {whyLine}
            </p>
            {proposal.evidence.length > 0 ? (
              <ul className="ws-evidence" aria-label="Evidence cited by the proposal">
                {proposal.evidence.map((item, index) => (
                  <li key={`${item.sourceId}-${index}`}>
                    <span className="ws-mono">{item.sourceId}</span>
                    <span>{item.claim}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </RecordSection>

          <RecordSection
            id={`${idPrefix}-market`}
            index={3}
            title="Market inputs"
            hint="marketInputs"
            aside={
              <span className="ws-tag" data-kind={fixtureUniverse ? "fixture" : "source"}>
                {fixtureUniverse ? "Fictional fixture prices" : "Research facts, not quotes"}
              </span>
            }
          >
            <dl className="ws-facts ws-facts-inline">
              <Fact label="Universe">
                {universeLabel}
                {universe.requested !== universe.used ? ` (requested ${universe.requested})` : ""}
              </Fact>
              {dataSource ? (
                <>
                  <Fact label="Source">{dataSource.source}</Fact>
                  <Fact label="Read at">{formatTimestamp(dataSource.capturedAt)}</Fact>
                  <Fact label="Assets" mono>
                    {dataSource.assetCount}
                  </Fact>
                </>
              ) : null}
            </dl>
            {universe.note ? (
              <p className="ws-note" data-testid="decision-run-universe-note">
                {universe.note}
              </p>
            ) : null}
            <div className="ws-table-scroll">
              <table className="ws-table">
                <caption className="sr-only">Assets evaluated by this run</caption>
                <thead>
                  <tr>
                    <th scope="col">Asset</th>
                    <th scope="col" data-numeric>
                      Price
                    </th>
                    <th scope="col">Observed</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const input = marketByMint.get(asset.mint);
                    const role =
                      proposal.action !== "HOLD"
                        ? asset.mint === proposal.inputMint
                          ? "Source"
                          : asset.mint === proposal.outputMint
                            ? "Target"
                            : null
                        : null;
                    return (
                      <tr key={asset.mint} data-role={role ?? undefined}>
                        <th scope="row">
                          <span className="ws-asset">
                            <strong>{asset.symbol}</strong>
                            <small>{asset.name}</small>
                          </span>
                          {role ? <span className="ws-role">{role}</span> : null}
                        </th>
                        <td data-numeric>
                          {usdFromMicros(input?.priceUsdMicros) ?? (
                            <span className="ws-muted">Unpriced</span>
                          )}
                        </td>
                        <td>{input ? formatTimestamp(input.observedAt) : "Not recorded"}</td>
                        <td>{input?.source ?? "Not recorded"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {prestocks ? (
              <details className="ws-disclosure">
                <summary>PreStocks research used by this run</summary>
                <div className="ws-disclosure-body">
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
                </div>
              </details>
            ) : null}
          </RecordSection>

          <RecordSection
            id={`${idPrefix}-policy`}
            index={4}
            title="Policy"
            hint="policyVerdict"
            hintLabel="About the policy verdict"
            aside={
              <span className="ws-tally" aria-label="Policy check tally">
                <span data-status="pass">{passedCount} passed</span>
                <span data-status="warn">{warnedRules.length} warned</span>
                <span data-status="fail">{failedRules.length} failed</span>
              </span>
            }
          >
            <PolicyExplanationPanel
              approved={approved}
              checks={checks}
              headingId={`policy-explanation-${run.decisionId}`}
              factSources={prestocks?.factsUsed}
              factSourceLabel="PreStocks fact"
              note={
                prestocks
                  ? "Trade size, positions and turnover are measured from the proposal at PreStocks token prices against the fictional research holdings. The reserve floor, slippage, cooldown and mode checks use the scenario and the agent policy only: the research portfolio has no cash leg."
                  : undefined
              }
            />
          </RecordSection>

          <RecordSection id={`${idPrefix}-risk`} index={5} title="Risk" hint="risk" hintLabel="About risk limits">
            <div className="ws-risk">
              <div className="ws-risk-confidence">
                <span className="ws-label">Stated confidence</span>
                <strong className="ws-figure">{bpsToPercent(proposal.confidenceBps)}</strong>
                <span className="ws-meter" aria-hidden="true">
                  <span style={{ transform: `scaleX(${Math.min(1, proposal.confidenceBps / 10_000)})` }} />
                </span>
                <small>Self-reported by the proposer. Policy does not use it.</small>
              </div>
              <div>
                <span className="ws-label">Invalidates the thesis</span>
                <ul className="ws-bullets">
                  {proposal.invalidationConditions.map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="ws-limits" role="list" aria-label="Recorded risk limits">
              {riskConstraints.map((constraint) => {
                const status = checkStatusFor(constraint.type);
                return (
                  <div role="listitem" key={constraint.type} data-status={status ?? "unchecked"}>
                    <span>{constraintLabels[constraint.type]}</span>
                    <strong>{describeConstraint(constraint)}</strong>
                    <small>
                      {status === "pass"
                        ? "Passed"
                        : status === "warn"
                          ? "Warned"
                          : status === "fail"
                            ? "Failed"
                            : "Not a separate check"}
                    </small>
                  </div>
                );
              })}
            </div>
          </RecordSection>

          <RecordSection id={`${idPrefix}-action`} index={6} title="Proposed action" hint="proposal" hintLabel="About the proposal">
            {proposal.action === "HOLD" ? (
              <p className="ws-action-hold">Hold. Atlas proposes no asset movement.</p>
            ) : (
              <div className="ws-trade" aria-label="Proposed trade">
                <div>
                  <span className="ws-label">Sell</span>
                  <strong className="ws-figure">
                    {proposal.inputAmount.uiAmount} <small>{symbolFor(proposal.inputMint)}</small>
                  </strong>
                  <small className="ws-mono">{proposal.inputAmount.rawAmount} base units</small>
                </div>
                <span className="ws-trade-arrow" aria-hidden="true" />
                <div>
                  <span className="ws-label">Receive at least</span>
                  <strong className="ws-figure">
                    {proposal.minimumOutputAmount.uiAmount}{" "}
                    <small>{symbolFor(proposal.outputMint)}</small>
                  </strong>
                  <small className="ws-mono">{proposal.minimumOutputAmount.rawAmount} base units</small>
                </div>
                <div>
                  <span className="ws-label">Max slippage</span>
                  <strong className="ws-figure">{proposal.maxSlippageBps} <small>bps</small></strong>
                  <small>{bpsToPercent(proposal.maxSlippageBps)}</small>
                </div>
              </div>
            )}
            <p className="ws-note ws-mono-line" data-testid="decision-run-proposal">
              {proposalLine}
            </p>
          </RecordSection>

          <RecordSection
            id={`${idPrefix}-approval`}
            index={7}
            title="User approval"
            hint="walletApproval"
            hintLabel="About your approval"
          >
            <div className="ws-approval">
              <div data-state={approved ? "pass" : "block"}>
                <span className="ws-label">Policy approval</span>
                <strong>{approved ? "Approved by code" : "Rejected by code"}</strong>
                <small>
                  {approved
                    ? "Approved by the deterministic policy checks."
                    : "Rejected by the deterministic policy checks."}{" "}
                  This is policy approval only; it is not wallet authorization and not onchain
                  execution.
                </small>
              </div>
              <div data-state={walletApproval.state}>
                <span className="ws-label">Wallet approval</span>
                <strong>{walletApproval.label}</strong>
                <small>
                  {walletApproval.detail} {run.executionEligibility.reason}
                </small>
              </div>
            </div>
            {lifecycle.simulated && !run.receipt.execution.transactionSignature ? (
              <p className="ws-note">
                There is no transaction to prepare or sign for this decision. Navis never
                holds keys, and no wallet prompt is shown for demo decisions.
              </p>
            ) : null}
          </RecordSection>

          <RecordSection
            id={`${idPrefix}-result`}
            index={8}
            title="Result"
            hint={executionState === "simulated" ? "simulation" : undefined}
            hintLabel="About simulation"
          >
            <dl className="ws-facts">
              <Fact label="Execution" testId="decision-run-simulation">
                {simulationLine}
              </Fact>
              <Fact label="Stored" testId="decision-run-persistence">
                {run.persisted.note}
              </Fact>
              {run.receipt.execution.explorerUrl ? (
                <Fact label="Explorer">
                  <a
                    className="text-link"
                    href={run.receipt.execution.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View transaction <ExternalLink aria-hidden="true" size={13} />
                  </a>
                </Fact>
              ) : null}
            </dl>
          </RecordSection>

          <RecordSection
            id={`${idPrefix}-proof`}
            index={9}
            title="Proof"
            hint="proofReceipt"
            hintLabel="About the proof receipt"
          >
            <AssuranceBadge assurance={assurance} />
            <p className="ws-note" data-testid="decision-run-assurance">
              Offchain integrity evidence: {assurance.explanation} Wallet authorization:{" "}
              {walletApproval.label.toLowerCase()}. Onchain settlement:{" "}
              {lifecycle.stage === "CONFIRMED" ? "recorded as confirmed" : "none recorded"}.
            </p>

            <div className="ws-proof-actions decision-run-actions">
              <div className="ws-verify">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={verify}
                  data-testid="button-verify-receipt"
                >
                  <ShieldCheck aria-hidden="true" size={15} /> Verify receipt
                </button>
                <WorkspaceHint topic="verifyReceipt" label="About verifying a receipt" />
                <span role="status" aria-live="polite" data-testid="status-receipt-verification">
                  {verified === null ? (
                    <StatusBadge tone="neutral">Checking receipt integrity</StatusBadge>
                  ) : (
                    <StatusBadge tone={verified ? "pass" : "block"}>
                      {verified ? "Receipt integrity verified" : "Receipt integrity check failed"}
                    </StatusBadge>
                  )}
                  {rechecked ? <small className="ws-muted"> Rechecked in this browser</small> : null}
                </span>
              </div>
              <div className="ws-proof-links">
                {showDetailLink && access.linkable ? (
                  <Link
                    className="secondary-button"
                    href={`/decisions/${run.decisionId}`}
                    data-testid="decision-run-open-decision"
                  >
                    <FileSearch aria-hidden="true" size={15} /> Open Decision
                  </Link>
                ) : null}
                {access.linkable && proofPath ? (
                  <Link
                    className="primary-button"
                    href={proofPath}
                    data-testid="decision-run-view-proof"
                  >
                    View Receipt
                  </Link>
                ) : null}
                {access.linkable && proofPath ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={copyProofLink}
                    data-testid="decision-run-copy-proof-link"
                  >
                    {copied === "copied" ? (
                      <Check aria-hidden="true" size={15} />
                    ) : (
                      <Copy aria-hidden="true" size={15} />
                    )}
                    {copied === "copied"
                      ? "Receipt link copied"
                      : copied === "failed"
                        ? "Copy failed, use View Receipt"
                        : "Copy Receipt Link"}
                  </button>
                ) : null}
              </div>
            </div>
            <p className="ws-caption">
              {access.note} Receipt hashes, cross-references, policy consistency, and execution evidence are checked in this browser. Integrity verification does not prove independent authorship or onchain settlement.
            </p>

            <details className="ws-disclosure">
              <summary>Technical detail: hashes and identifiers</summary>
              <dl className="ws-facts ws-hashes">
                <Fact label="Receipt hash" mono>
                  {run.receiptHash}
                </Fact>
                <Fact label="Decision hash" mono>
                  {run.receipt.decision.hash}
                </Fact>
                <Fact label="Policy input hash" mono>
                  {run.receipt.policyEvaluation.inputHash}
                </Fact>
                <Fact label="Strategy hash" mono>
                  {run.receipt.strategy.hash}
                </Fact>
                <Fact label="Risk policy hash" mono>
                  {run.receipt.riskPolicy.hash}
                </Fact>
                <Fact label="Portfolio hash" mono>
                  {run.receipt.portfolio.hash}
                </Fact>
                <Fact label="Hash anchoring">{run.receipt.hashAnchoring.explanation}</Fact>
                {run.proofId ? (
                  <Fact label="Proof ID" mono testId="decision-run-proof-id">
                    {run.proofId}
                  </Fact>
                ) : null}
              </dl>
            </details>
          </RecordSection>
        </div>
      </div>
    </article>
  );
}
