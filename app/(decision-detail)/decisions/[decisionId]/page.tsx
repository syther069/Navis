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
  const remembered = await loadDecisionRun({ decisionId });
  if (remembered || !env.databaseUrl) return remembered;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) return null;
  return loadDecisionRun({
    decisionId,
    database: getDatabase(),
    ownerWallet: session.wallet,
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
        description="Fresh proposal, policy evaluation, execution eligibility, and locally verifiable receipt."
        meta={run.persisted.store}
      />
      <section className="route-panel">
        <DecisionRunResultView run={run} showDetailLink={false} />
      </section>
    </>
  );
}
