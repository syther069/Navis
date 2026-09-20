import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CheckCircle,
  Fingerprint,
  Flask,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { FieldRow, RouteHeader } from "@/components/route-primitives";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { demoProof } from "@/fixtures/demo-proof";
import { verifyProofReceipt } from "@/lib/proofs/receipt";

export const metadata: Metadata = { title: "Demo proof anatomy" };

export default async function ProofDetailPage({
  params,
}: PageProps<"/proofs/[proofId]">) {
  const { proofId } = await params;
  if (proofId !== demoProof.id) notFound();
  const verification = verifyProofReceipt(demoProof.document, demoProof.receiptHash);

  return (
    <>
      <RouteHeader
        eyebrow="Public verifier"
        title={demoProof.title}
        description="Canonical hashes and receipt cross-references are checked locally. This verifies document integrity, not independent authorship or chain confirmation."
        meta={
          verification.valid ? "Integrity checks valid · demo" : "Verification failed"
        }
      />
      <section className="route-panel proof-card">
        <div className="proof-warning">
          <WarningCircle aria-hidden="true" size={19} />
          <span>
            This is a deterministic demo receipt, not an onchain transaction. It has no
            signature, paid fees, independent authorship attestation, or claim of
            financial performance.
          </span>
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
            label="Strategy hash"
            value={demoProof.document.strategy.hash}
            detail={
              verification.checks.strategy ? "Matches canonical document" : "Mismatch"
            }
          />
          <FieldRow
            label="Policy hash"
            value={demoProof.document.riskPolicy.hash}
            detail={
              verification.checks.riskPolicy ? "Matches canonical document" : "Mismatch"
            }
          />
          <FieldRow label="Decision hash" value={demoProof.document.decision.hash} />
          <FieldRow
            label="Hash anchoring"
            value={
              demoProof.document.hashAnchoring.decisionHashAnchored
                ? demoProof.document.hashAnchoring.status
                : "Offchain only"
            }
            detail={demoProof.document.hashAnchoring.explanation}
          />
          <FieldRow label="Receipt hash" value={demoProof.receiptHash} />
          <FieldRow
            label="Transaction signature"
            value="None"
            detail="Simulation receipts never receive explorer links"
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
      </section>
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
          {demoProof.timeline.map((event, index) => (
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
