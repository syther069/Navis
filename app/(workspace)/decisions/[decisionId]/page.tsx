import Link from "next/link";
import { cookies } from "next/headers";

import { DecisionRunResultView } from "@/components/decisions/run-decision-panel";
import { RouteHeader } from "@/components/route-primitives";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { loadDecisionRun } from "@/lib/services/run-decision";

export default async function DecisionDetailPage({
  params,
}: PageProps<"/decisions/[decisionId]">) {
  const { decisionId } = await params;
  let run = await loadDecisionRun({ decisionId });
  if (!run && env.databaseUrl) {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await readSessionToken(token) : null;
    if (session) {
      run = await loadDecisionRun({
        decisionId,
        database: getDatabase(),
        ownerWallet: session.wallet,
      });
    }
  }
  if (!run) {
    return (
      <>
        <RouteHeader
          eyebrow="Decision detail"
          title="Decision unavailable"
          description="The requested decision could not be loaded."
        />
        <section className="route-panel">
          <p>
            This decision is not available on this server instance. Demo runs without a
            database are kept in memory for one instance only. Run a new decision from
            the Atlas agent page.
          </p>
          <Link className="secondary-button" href="/agents/atlas">
            Return to Atlas
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <RouteHeader
        eyebrow="Decision detail"
        title={`Decision ${decisionId.slice(0, 8)}`}
        description="Fresh proposal, policy evaluation, execution eligibility, and locally verifiable receipt."
        meta={run.persisted.store}
      />
      <section className="route-panel">
        <DecisionRunResultView run={run} />
      </section>
    </>
  );
}
