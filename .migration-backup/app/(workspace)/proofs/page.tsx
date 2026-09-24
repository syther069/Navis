import { ArrowRight, Fingerprint } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { RouteHeader } from "@/components/route-primitives";
import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { assuranceForReceipt } from "@/lib/assurance";
import { demoProof } from "@/fixtures/demo-proof";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { listProofs } from "@/lib/services/decision-records";

export const metadata: Metadata = { title: "Proofs" };
export const dynamic = "force-dynamic";

export default async function ProofsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  // Public Atlas receipts are listed for everyone; owner receipts only for
  // the session that owns them.
  const stored = env.databaseUrl
    ? await listProofs({ ownerWallet: session?.wallet }, getDatabase())
    : [];
  const publicCount = stored.filter((item) => item.visibility === "public").length;
  const ownedCount = stored.length - publicCount;
  const note = !env.databaseUrl
    ? "This instance has no database, so only the prepared Atlas receipt is listed."
    : !session
      ? `${publicCount} stored public Atlas receipt${publicCount === 1 ? "" : "s"}, newest first, plus the prepared Atlas receipt. Authenticate a connected wallet to also list the receipts stored for it. Every stored receipt is offchain integrity evidence from a demo simulation, with no signature or onchain transaction.`
      : `${publicCount} public Atlas receipt${publicCount === 1 ? "" : "s"} and ${ownedCount} receipt${ownedCount === 1 ? "" : "s"} for the connected wallet, newest first, plus the prepared Atlas receipt. Every stored receipt is offchain integrity evidence from a demo simulation, with no signature or onchain transaction.`;

  return (
    <>
      <RouteHeader
        eyebrow="Evidence registry"
        title="Proofs"
        description="Read-only records bind agent intent to policy checks, authorization, and execution evidence without upgrading simulations into chain claims."
        meta={
          stored.length > 0
            ? `${stored.length} stored · 1 demo receipt`
            : "1 demo receipt"
        }
      />
      <section className="route-panel proof-registry" aria-label="Proof receipts">
        {stored.map((proof) => (
          <article
            key={proof.proofId}
            className="proof-registry-row"
            data-testid="stored-proof-row"
          >
            <span className="proof-registry-icon" aria-hidden="true">
              <Fingerprint size={20} />
            </span>
            <div>
              <span>
                {proof.mode.toUpperCase()} RECEIPT · {proof.agent.name}
                {proof.visibility === "public" ? " · public record" : ""}
              </span>
              <h2>
                {proof.approved
                  ? "Approved proposal, simulated execution"
                  : "Rejected proposal, no execution"}
              </h2>
              <SourceStamp source="database" timestamp={proof.finalizedAt} />
              <AssuranceBadge assurance={assuranceForReceipt(proof.receipt)} compact />
            </div>
            <code>{proof.receiptHash.slice(0, 16)}…</code>
            <StatusBadge tone={proof.approved ? "simulation" : "block"}>
              {proof.executionState}
            </StatusBadge>
            <Link className="secondary-button" href={`/proofs/${proof.proofId}`}>
              Verify <ArrowRight size={16} />
            </Link>
          </article>
        ))}
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
            <AssuranceBadge
              assurance={assuranceForReceipt(demoProof.document)}
              compact
            />
          </div>
          <code>{demoProof.receiptHash.slice(0, 16)}…</code>
          <StatusBadge tone="simulation">Simulation</StatusBadge>
          <Link className="secondary-button" href={`/proofs/${demoProof.id}`}>
            Verify <ArrowRight size={16} />
          </Link>
        </article>
      </section>
      <p className="route-copy" data-testid="proof-registry-note">
        {note}
      </p>
    </>
  );
}
