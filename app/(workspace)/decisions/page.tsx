import { ArrowRight, Gauge } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { RouteHeader } from "@/components/route-primitives";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { demoProof } from "@/fixtures/demo-proof";

export const metadata: Metadata = { title: "Decisions" };

export default function DecisionsPage() {
  return (
    <>
      <RouteHeader
        eyebrow="Decision ledger"
        title="Decisions"
        description="Every proposal retains its exact inputs, policy checks, approval state, and execution result."
        meta="1 demo record"
      />
      <section className="route-panel decision-ledger">
        <article className="decision-ledger-row">
          <Gauge size={20} aria-hidden="true" />
          <div>
            <span>REBALANCE · DEMO</span>
            <h2>Atlas bounded one-unit rebalance</h2>
            <small>{demoProof.document.generatedAt}</small>
          </div>
          <code>{demoProof.document.decision.hash.slice(0, 14)}…</code>
          <StatusBadge tone="simulation">Simulated</StatusBadge>
          <Link
            className="secondary-button"
            href="/agents/atlas/decisions/demo-decision"
          >
            Inspect <ArrowRight size={16} />
          </Link>
        </article>
      </section>
    </>
  );
}
