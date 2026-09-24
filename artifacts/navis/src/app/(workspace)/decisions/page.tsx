import { ArrowRight, Gauge } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { RouteHeader } from "@/components/route-primitives";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { demoProof } from "@/fixtures/demo-proof";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { listDecisions } from "@/lib/services/decision-records";

export const metadata: Metadata = { title: "Decisions" };
export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  // Public Atlas runs are listed for everyone; owner records only for the
  // session that owns them.
  const stored = env.databaseUrl
    ? await listDecisions({ ownerWallet: session?.wallet }, getDatabase())
    : [];
  const publicCount = stored.filter((item) => item.visibility === "public").length;
  const ownedCount = stored.length - publicCount;
  const note = !env.databaseUrl
    ? "This instance has no database, so only the prepared Atlas example is listed. Fresh Atlas runs are shown inline on the Atlas page and are not stored."
    : !session
      ? `${publicCount} stored public Atlas run${publicCount === 1 ? "" : "s"}, newest first, plus the prepared Atlas example. Authenticate a connected wallet to also list the decisions stored for it.`
      : `${publicCount} public Atlas run${publicCount === 1 ? "" : "s"} and ${ownedCount} decision${ownedCount === 1 ? "" : "s"} for the connected wallet, newest first, plus the prepared Atlas example.`;

  return (
    <>
      <RouteHeader
        eyebrow="Decision ledger"
        title="Decisions"
        description="Every proposal retains its exact inputs, policy checks, approval state, and execution result."
        meta={
          stored.length > 0
            ? `${stored.length} stored · 1 demo record`
            : "1 demo record"
        }
      />
      <section className="route-panel decision-ledger">
        {stored.map((decision) => (
          <article
            key={decision.decisionId}
            className="decision-ledger-row"
            data-testid="stored-decision-row"
          >
            <Gauge size={20} aria-hidden="true" />
            <div>
              <span>
                {decision.action} · {decision.agent.mode.toUpperCase()} ·{" "}
                {decision.agent.name}
                {decision.visibility === "public" ? " · public record" : ""}
              </span>
              <h2>
                {decision.approved
                  ? "Policy approved, simulated only"
                  : decision.approved === false
                    ? "Policy rejected, nothing executed"
                    : "Awaiting policy evaluation"}
              </h2>
              <small>{decision.createdAt}</small>
            </div>
            <code>{decision.decisionHash.slice(0, 14)}…</code>
            <StatusBadge
              tone={
                decision.executionState === "simulated"
                  ? "simulation"
                  : decision.executionState === "rejected"
                    ? "block"
                    : "neutral"
              }
            >
              {decision.executionState ?? decision.status}
            </StatusBadge>
            <Link
              className="secondary-button"
              href={`/decisions/${decision.decisionId}`}
            >
              Inspect <ArrowRight size={16} />
            </Link>
          </article>
        ))}
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
      <p className="route-copy" data-testid="decision-ledger-note">
        {note}
      </p>
    </>
  );
}
