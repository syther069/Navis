import { ArrowRight, Fingerprint } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { RouteHeader } from "@/components/route-primitives";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { demoProof } from "@/fixtures/demo-proof";

export const metadata: Metadata = { title: "Proofs" };

export default function ProofsPage() {
  return (
    <>
      <RouteHeader
        eyebrow="Evidence registry"
        title="Proofs"
        description="Read-only records bind agent intent to policy checks, authorization, and execution evidence without upgrading simulations into chain claims."
        meta="1 demo receipt"
      />
      <section className="route-panel proof-registry" aria-label="Proof receipts">
        <article className="proof-registry-row">
          <span className="proof-registry-icon" aria-hidden="true">
            <Fingerprint size={20} />
          </span>
          <div>
            <span>DEMO RECEIPT</span>
            <h2>{demoProof.title}</h2>
            <SourceStamp
              source="demo_fixture"
              timestamp={demoProof.document.generatedAt}
            />
          </div>
          <code>{demoProof.receiptHash.slice(0, 16)}…</code>
          <StatusBadge tone="simulation">Simulation</StatusBadge>
          <Link className="secondary-button" href={`/proofs/${demoProof.id}`}>
            Verify <ArrowRight size={16} />
          </Link>
        </article>
      </section>
    </>
  );
}
