import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  Fingerprint,
  Flask,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { RouteHeader } from "@/components/route-primitives";
import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { InfoHint } from "@/components/shared/info-hint";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { PolicyExplanationPanel } from "@/components/shared/policy-explanation-panel";
import { assuranceForReceipt } from "@/lib/assurance";
import type { ProofReceiptDocument, verifyProofReceipt } from "@/lib/proofs/receipt";
import type { ProofTimelineEvent } from "@/lib/proofs/timeline";

function RecordField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: "policy" | "assurance";
}) {
  return (
    <div className="receipt-field">
      <dt>
        {label}
        {hint ? <InfoHint topic={hint} label={`About ${label.toLowerCase()}`} /> : null}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ProofReceiptView({
  title,
  document,
  receiptHash,
  verification,
  timeline,
  origin,
  links,
}: {
  title: string;
  document: ProofReceiptDocument;
  receiptHash: string;
  verification: ReturnType<typeof verifyProofReceipt>;
  timeline: readonly ProofTimelineEvent[];
  origin: Readonly<{ label: string; note: string }>;
  links?: Readonly<{ decisionHref?: string; agentHref?: string; agentName?: string }>;
}) {
  const approved = document.policyEvaluation.approved;
  const failed = document.policyEvaluation.checks.filter(
    (check) => check.status === "fail",
  );
  const warned = document.policyEvaluation.checks.filter(
    (check) => check.status === "warn",
  );
  const assurance = assuranceForReceipt(document);
  const proposal = document.decision.proposal;
  const execution = document.execution;
  const assets = document.decision.context.assets;
  const confirmed = execution.state === "confirmed" && !!execution.transactionSignature;
  return (
    <div className="receipt-page">
      <RouteHeader
        eyebrow="Public verifier"
        title={title}
        description="Canonical hashes and receipt cross-references are checked locally. This verifies document integrity, not independent authorship or chain confirmation."
        meta={
          verification.valid
            ? `Integrity checks valid · ${origin.label}`
            : "Verification failed"
        }
        actions={
          <Link className="secondary-button" href="/proofs">
            <ArrowLeft size={16} aria-hidden="true" /> All proofs
          </Link>
        }
      />

      <section className="receipt-verifier" aria-labelledby="receipt-verifier-title">
        <div className="receipt-verifier-main">
          <div className="receipt-verifier-icon" data-valid={verification.valid}>
            {verification.valid ? (
              <CheckCircle size={24} />
            ) : (
              <WarningCircle size={24} />
            )}
          </div>
          <div>
            <span className="receipt-kicker">
              01 / Verification{" "}
              <InfoHint topic="verifyReceipt" label="About verifying a receipt" />
            </span>
            <h2 id="receipt-verifier-title">
              {verification.valid ? "Hashes and references match" : "Mismatch detected"}
            </h2>
            <p>
              {verification.valid
                ? "The published record passes its local integrity checks. This is not a claim of settlement."
                : "One or more integrity checks failed. Do not rely on this record."}
            </p>
          </div>
        </div>
        <StatusBadge tone={verification.valid ? "pass" : "block"}>
          {verification.valid ? "Verified" : "Invalid"}
        </StatusBadge>
      </section>

      <div className="receipt-warning info-hint-anchor">
        <WarningCircle size={18} aria-hidden="true" />
        <span>{origin.note}</span>
        <InfoHint topic="proofReceipt" label="About what this page checks" />
      </div>

      <section className="receipt-sheet" aria-labelledby="receipt-sheet-title">
        <div className="receipt-sheet-header">
          <div>
            <span className="receipt-kicker">02 / Recorded facts</span>
            <h2 id="receipt-sheet-title">Receipt record</h2>
            <p>
              Evidence as recorded at the time of this decision. Not an execution
              confirmation.
            </p>
          </div>
          <span className="receipt-sheet-mark" aria-hidden="true">
            <Fingerprint size={25} />
          </span>
        </div>
        <div className="receipt-assurance">
          <div className="receipt-assurance-heading">
            <span>Evidence level</span>
            <InfoHint topic="assurance" label="About assurance levels" />
          </div>
          <AssuranceBadge assurance={assurance} compact />
          <p>{assurance.explanation}</p>
        </div>
        <dl className="receipt-record">
          <RecordField label="What">
            <strong>{proposal.action} proposal</strong>
            {proposal.action !== "HOLD" ? (
              <span className="receipt-subvalue">
                {proposal.inputAmount.uiAmount}{" "}
                {assets.find((asset) => asset.mint === proposal.inputMint)?.symbol ??
                  proposal.inputMint}{" "}
                →{" "}
                {assets.find((asset) => asset.mint === proposal.outputMint)?.symbol ??
                  proposal.outputMint}{" "}
                · Proposed amount, not a completed transfer
              </span>
            ) : null}
          </RecordField>
          <RecordField label="Who">
            <span>
              Agent <code>{document.decision.context.agentId}</code>
            </span>
            <span className="receipt-subvalue">
              Portfolio owner and identifiers in technical details
            </span>
          </RecordField>
          <RecordField label="Why">
            <span>{proposal.thesis}</span>
            <span className="receipt-subvalue">
              {document.strategy.document.objective}
            </span>
          </RecordField>
          <RecordField label="Policy" hint="policy">
            <StatusBadge tone={approved ? "pass" : "block"}>
              {approved ? "Approved" : "Rejected"}
            </StatusBadge>
            <span className="receipt-subvalue">
              {approved
                ? `${document.policyEvaluation.checks.length - warned.length} checks passed, ${warned.length} warned; no failed checks; execution state ${execution.state}.`
                : `Failed: ${failed.map((check) => check.rule.replaceAll("_", " ")).join(", ")}. Nothing was executed.`}
            </span>
          </RecordField>
          <RecordField label="When">
            <time dateTime={document.generatedAt}>{document.generatedAt}</time>
            <span className="receipt-subvalue">
              Decision requested {document.decision.context.requestedAt}
            </span>
          </RecordField>
          <RecordField label="Network">
            <span>{document.cluster}</span>
            <span className="receipt-subvalue">
              {document.mode} mode · Network designation does not mean this record was
              submitted.
            </span>
          </RecordField>
          <RecordField label="Transaction">
            <span>
              {confirmed
                ? "Confirmed execution recorded"
                : "No confirmed onchain transaction"}
            </span>
            <span className="receipt-subvalue">
              Transaction signature:{" "}
              {execution.transactionSignature
                ? "Available in technical details"
                : "None"}
            </span>
          </RecordField>
          <RecordField label="Result">
            <StatusBadge
              tone={
                execution.state === "confirmed"
                  ? "pass"
                  : execution.state === "rejected" || execution.state === "failed"
                    ? "block"
                    : "simulation"
              }
            >
              {execution.state}
            </StatusBadge>
            <span className="receipt-subvalue">
              {document.hashAnchoring.decisionHashAnchored
                ? document.hashAnchoring.status.replaceAll("_", " ")
                : "Offchain only"}{" "}
              · {document.hashAnchoring.explanation}
            </span>
          </RecordField>
        </dl>
        <div className="receipt-sheet-footer">
          <SourceStamp
            source={document.portfolio.document.source}
            timestamp={document.portfolio.document.capturedAt}
          />
          {links?.decisionHref || links?.agentHref ? (
            <div className="receipt-links">
              {links.decisionHref ? (
                <Link href={links.decisionHref}>
                  Open decision detail <ArrowSquareOut size={14} />
                </Link>
              ) : null}
              {links.agentHref ? (
                <Link href={links.agentHref}>
                  Open {links.agentName ?? "agent"} <ArrowSquareOut size={14} />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <details className="tech-disclosure receipt-technical">
        <summary>
          Technical evidence · hashes, identifiers and verification checks
        </summary>
        <div className="tech-disclosure-body">
          <dl className="receipt-tech-list">
            <RecordField label="Proof ID">
              <code>{document.proofId}</code>
            </RecordField>
            <RecordField label="Receipt hash">
              <code>{receiptHash}</code>
            </RecordField>
            <RecordField label="Decision hash">
              <code>{document.decision.hash}</code>
            </RecordField>
            <RecordField label="Strategy hash">
              <code>{document.strategy.hash}</code>
            </RecordField>
            <RecordField label="Policy hash">
              <code>{document.riskPolicy.hash}</code>
            </RecordField>
            <RecordField label="Portfolio hash">
              <code>{document.portfolio.hash}</code>
            </RecordField>
            <RecordField label="Policy input hash">
              <code>{document.policyEvaluation.inputHash}</code>
            </RecordField>
            <RecordField label="Portfolio owner">
              <code>{document.portfolio.document.owner}</code>
            </RecordField>
            {proposal.action !== "HOLD" ? (
              <>
                <RecordField label="Input mint">
                  <code>{proposal.inputMint}</code>
                </RecordField>
                <RecordField label="Output mint">
                  <code>{proposal.outputMint}</code>
                </RecordField>
              </>
            ) : null}
            <RecordField label="Transaction signature">
              {execution.transactionSignature ? (
                <code>{execution.transactionSignature}</code>
              ) : (
                <span
                  className="unavailable"
                  aria-label="Unavailable: no transaction was signed"
                >
                  — None
                </span>
              )}
            </RecordField>
            {execution.slot ? (
              <RecordField label="Slot">
                <code>{execution.slot}</code>
              </RecordField>
            ) : null}
            {execution.feeLamports ? (
              <RecordField label="Fee (lamports)">
                <code>{execution.feeLamports}</code>
              </RecordField>
            ) : null}
            {execution.explorerUrl && confirmed ? (
              <RecordField label="Explorer">
                <a href={execution.explorerUrl} target="_blank" rel="noreferrer">
                  View transaction <ArrowSquareOut size={14} />
                </a>
              </RecordField>
            ) : null}
          </dl>
          <div className="receipt-checks" aria-label="Verification checks">
            {Object.entries(verification.checks).map(([check, passed]) => (
              <span key={check} data-passed={passed}>
                {passed ? (
                  <CheckCircle size={15} aria-hidden="true" />
                ) : (
                  <WarningCircle size={15} aria-hidden="true" />
                )}
                {check.replace(/([A-Z])/g, " $1")}
              </span>
            ))}
          </div>
        </div>
      </details>

      <PolicyExplanationPanel
        approved={approved}
        checks={document.policyEvaluation.checks}
        note={
          approved
            ? `Execution state recorded as ${execution.state}. ${assurance.originLabel}: ${assurance.levelLabel.toLowerCase()} only.`
            : "A rejected proposal never reaches execution, so no signature or explorer link can exist for it."
        }
      />
      <section
        className="route-panel receipt-timeline"
        aria-labelledby="proof-timeline-title"
      >
        <div className="receipt-section-heading">
          <span className="receipt-kicker">03 / Audit trail</span>
          <h2 id="proof-timeline-title">Decision proof spine</h2>
        </div>
        <ol className="timeline">
          {timeline.map((event, index) => (
            <li key={event.id}>
              {event.id === "execution" ? (
                <Flask aria-hidden="true" size={19} />
              ) : (
                <CheckCircle aria-hidden="true" size={19} />
              )}
              <div>
                <span>
                  {String(index + 1).padStart(2, "0")} · {event.source}
                </span>
                <h2>{event.title}</h2>
                <p>{event.description}</p>
                <SourceStamp source={event.source} timestamp={event.timestamp} />
              </div>
              <strong>{event.mode}</strong>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
