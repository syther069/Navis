import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CheckCircle,
  Clock,
  FileText,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { RouteHeader } from "@/components/route-primitives";
import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { SourceStamp } from "@/components/shared/domain-primitives";
import { PolicyExplanationPanel } from "@/components/shared/policy-explanation-panel";
import { assuranceForReceipt } from "@/lib/assurance";
import { demoProof } from "@/fixtures/demo-proof";

const demoDecisionId = "demo-decision";

export const metadata: Metadata = { title: "Rebalance proposal 001" };

export default async function DecisionDetailPage({
  params,
}: PageProps<"/agents/atlas/decisions/[decisionId]">) {
  const { decisionId } = await params;
  if (decisionId !== demoDecisionId) notFound();

  return (
    <>
      <RouteHeader
        eyebrow="Demo decision"
        title="Rebalance proposal 001"
        description="A deterministic demo proposal connected to its immutable inputs, policy evaluation, and hash-verifiable simulation receipt."
        meta="Simulation · hash verified"
      />
      <div className="proof-assurance">
        <AssuranceBadge assurance={assuranceForReceipt(demoProof.document)} />
      </div>
      <PolicyExplanationPanel
        approved={demoProof.document.policyEvaluation.approved}
        checks={demoProof.document.policyEvaluation.checks}
        note="Values are basis points recorded by the deterministic demo policy evaluation."
      />
      <ol className="timeline" aria-label="Decision proof spine">
        {demoProof.timeline.map((event, index) => {
          const Icon =
            event.id === "inputs"
              ? FileText
              : event.id === "policy"
                ? ShieldCheck
                : event.id === "execution"
                  ? CheckCircle
                  : Clock;
          return (
            <li key={event.id}>
              <Icon aria-hidden="true" size={19} />
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
          );
        })}
      </ol>
      <div className="proof-decision-link">
        <Link className="primary-button" href={`/proofs/${demoProof.id}`}>
          Open public verifier
        </Link>
      </div>
    </>
  );
}
