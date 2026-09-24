import {
  CheckCircle,
  Fingerprint,
  Flask,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { FieldRow, RouteHeader } from "@/components/route-primitives";
import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { InfoHint } from "@/components/shared/info-hint";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { PolicyExplanationPanel } from "@/components/shared/policy-explanation-panel";
import { assuranceForReceipt } from "@/lib/assurance";
import type { ProofReceiptDocument, verifyProofReceipt } from "@/lib/proofs/receipt";
import type { ProofTimelineEvent } from "@/lib/proofs/timeline";

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
  return (
    <>
      <RouteHeader
        eyebrow="Public verifier"
        title={title}
        description="Canonical hashes and receipt cross-references are checked locally. This verifies document integrity, not independent authorship or chain confirmation."
        meta={
          verification.valid
            ? `Integrity checks valid · ${origin.label}`
            : "Verification failed"
        }
      />
      <section className="route-panel proof-card">
        <div className="proof-warning info-hint-anchor">
          <WarningCircle aria-hidden="true" size={19} />
          <span>{origin.note}</span>
          <InfoHint topic="proofReceipt" label="About what this page checks" />
        </div>
        <div className="proof-assurance">
          <AssuranceBadge assurance={assurance} />
          <small>{assurance.explanation}</small>
        </div>
        <div className="proof-verification-heading">
          <div>
            <span className="route-eyebrow">Receipt integrity</span>
            <h2>
              {verification.valid ? "Hashes and references match" : "Mismatch detected"}
            </h2>
          </div>
          <StatusBadge tone={verification.valid ? "pass" : "block"}>
            {verification.valid ? "Verified" : "Invalid"}
          </StatusBadge>
        </div>
        <div className="field-list">
          <FieldRow
            label="Policy outcome"
            value={approved ? "Approved" : "Rejected"}
            detail={
              approved
                ? `${document.policyEvaluation.checks.length - warned.length} checks passed, ${warned.length} warned; no failed checks; execution state ${document.execution.state}.`
                : `Failed: ${failed.map((check) => check.rule.replaceAll("_", " ")).join(", ")}. Nothing was executed.`
            }
          />
          <FieldRow
            label="Strategy hash"
            value={document.strategy.hash}
            detail={
              verification.checks.strategy ? "Matches canonical document" : "Mismatch"
            }
          />
          <FieldRow
            label="Policy hash"
            value={document.riskPolicy.hash}
            detail={
              verification.checks.riskPolicy ? "Matches canonical document" : "Mismatch"
            }
          />
          <FieldRow label="Decision hash" value={document.decision.hash} />
          <FieldRow
            label="Hash anchoring"
            value={
              document.hashAnchoring.decisionHashAnchored
                ? document.hashAnchoring.status
                : "Offchain only"
            }
            detail={document.hashAnchoring.explanation}
          />
          <FieldRow label="Receipt hash" value={receiptHash} />
          <FieldRow
            label="Transaction signature"
            value={document.execution.transactionSignature ?? "None"}
            detail={
              document.execution.transactionSignature
                ? "Confirmed onchain execution"
                : "Simulation and rejection receipts never receive explorer links"
            }
          />
        </div>
        <div className="proof-check-grid">
          {Object.entries(verification.checks).map(([check, passed]) => (
            <div key={check} data-passed={passed || undefined}>
              {passed ? <CheckCircle size={17} /> : <WarningCircle size={17} />}
              <span>{check.replace(/([A-Z])/g, " $1")}</span>
            </div>
          ))}
        </div>
        {links?.decisionHref || links?.agentHref ? (
          <div className="decision-run-actions">
            {links.decisionHref ? (
              <Link className="secondary-button" href={links.decisionHref}>
                Open decision detail
              </Link>
            ) : null}
            {links.agentHref ? (
              <Link className="secondary-button" href={links.agentHref}>
                Open {links.agentName ?? "agent"}
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
      <PolicyExplanationPanel
        approved={approved}
        checks={document.policyEvaluation.checks}
        note={
          approved
            ? `Execution state recorded as ${document.execution.state}. ${assurance.originLabel}: ${assurance.levelLabel.toLowerCase()} only.`
            : "A rejected proposal never reaches execution, so no signature or explorer link can exist for it."
        }
      />
      <section
        className="route-panel proof-timeline"
        aria-labelledby="proof-timeline-title"
      >
        <div className="panel-heading">
          <Fingerprint size={20} aria-hidden="true" />
          <div>
            <span>Evidence chronology</span>
            <h2 id="proof-timeline-title">Decision proof spine</h2>
          </div>
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
    </>
  );
}
