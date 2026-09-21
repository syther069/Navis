import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { DecisionRunResultView } from "@/components/decisions/run-decision-panel";
import { RouteHeader } from "@/components/route-primitives";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { loadDecisionRun } from "@/lib/services/run-decision";

export const metadata: Metadata = { title: "Decision detail" };

async function resolveDecisionRun(decisionId: string) {
  // Without a database only this process's in-memory Atlas runs exist. With
  // one, public Atlas records open for anyone and owner records only for the
  // owner's session; everything else is an indistinguishable 404.
  if (!env.databaseUrl) return loadDecisionRun({ decisionId });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  return loadDecisionRun({
    decisionId,
    database: getDatabase(),
    ownerWallet: session?.wallet,
  });
}

export default async function DecisionDetailPage({
  params,
}: PageProps<"/decisions/[decisionId]">) {
  const { decisionId } = await params;
  const run = await resolveDecisionRun(decisionId);
  // This segment has no loading boundary above it, so this is a real HTTP 404.
  if (!run) notFound();

  return (
    <>
      <RouteHeader
        eyebrow="Decision detail"
        title={`Decision ${decisionId.slice(0, 8)}`}
        description="Stored proposal, policy evaluation, execution eligibility, and locally verifiable receipt."
        meta={
          run.persisted.store === "database"
            ? `stored · ${run.persisted.visibility === "public" ? "public Atlas record" : "owner record"}`
            : "memory only"
        }
      />
      <section className="route-panel">
        <DecisionRunResultView run={run} showDetailLink={false} />
      </section>
    </>
  );
}
