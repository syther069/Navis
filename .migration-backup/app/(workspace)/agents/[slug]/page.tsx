import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClawPumpLinkPanel } from "@/components/agent/clawpump-link-panel";
import { PersistentRunsNotice } from "@/components/decisions/persistent-runs-notice";
import { RunDecisionPanel } from "@/components/decisions/run-decision-panel";
import { FieldRow, RouteHeader } from "@/components/route-primitives";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import type { RiskConstraint } from "@/lib/domain";
import { createClawPumpClient } from "@/lib/integrations/clawpump/server";
import { getPersistentAgentForOwner } from "@/lib/services/agents";
import { getClawPumpIdentity } from "@/lib/services/clawpump-agents";
import { listDecisionsForOwner } from "@/lib/services/decision-records";

export const metadata: Metadata = { title: "Persistent agent" };
export const dynamic = "force-dynamic";

function constraintValue(constraint: RiskConstraint) {
  if ("mints" in constraint) return constraint.mints.join(", ");
  if ("modes" in constraint) return constraint.modes.join(", ");
  if (typeof constraint.value === "number" && constraint.type.endsWith("_bps")) {
    return `${constraint.value / 100}%`;
  }
  return String(constraint.value);
}

export default async function PersistentAgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "atlas") notFound();

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;

  if (!session) {
    return (
      <>
        <RouteHeader
          eyebrow="Persistent agent"
          title="Wallet authentication required"
          description="Connect and authenticate the wallet that created this agent to inspect its immutable mandate."
          meta="Read blocked"
        />
        <section className="route-panel">
          <p className="route-copy">
            Persistent agents are ownership-scoped and are never exposed by slug alone.
          </p>
          <Link className="secondary-button" href="/agents">
            Return to agent list
          </Link>
        </section>
      </>
    );
  }
  if (!env.databaseUrl) {
    return (
      <>
        <RouteHeader
          eyebrow="Persistent agent"
          title="Persistence unavailable"
          description="This instance does not have a persistent evidence store configured."
          meta="Unavailable"
        />
      </>
    );
  }

  const database = getDatabase();
  const bundle = await getPersistentAgentForOwner(slug, session.wallet, database);
  if (!bundle) notFound();
  const storedDecisions = await listDecisionsForOwner(
    session.wallet,
    database,
    25,
    bundle.agent.id,
  );
  const clawpumpIdentity = await getClawPumpIdentity(
    {
      id: bundle.agent.id,
      name: bundle.agent.name,
      slug: bundle.agent.slug,
      integrationStatus: bundle.agent.integrationStatus,
      externalAgentId: bundle.agent.externalAgentId ?? null,
      externalWallet: bundle.agent.externalWallet ?? null,
      externalRequestId: null,
    },
    env.clawpumpApiKey ? createClawPumpClient() : null,
  );

  return (
    <>
      <RouteHeader
        eyebrow="Persistent draft"
        title={bundle.agent.name}
        description="Immutable mandate, policy and asset universe committed at creation, plus the decisions this wallet has generated against them."
        meta={`${bundle.agent.mode} · ${bundle.agent.status}`}
      />
      {bundle.agent.mode === "demo" ? (
        <RunDecisionPanel
          agentSlug={bundle.agent.slug}
          agentName={bundle.agent.name}
          persisted
        />
      ) : null}
      <ClawPumpLinkPanel
        slug={bundle.agent.slug}
        identity={clawpumpIdentity}
        configured={Boolean(env.clawpumpApiKey)}
      />
      <div className="route-grid agent-profile-grid">
        <section className="route-panel">
          <span className="route-eyebrow">
            Immutable mandate · v{bundle.strategy.version}
          </span>
          <div className="field-list">
            <FieldRow label="Objective" value={bundle.strategy.document.objective} />
            <FieldRow label="Horizon" value={bundle.strategy.document.horizon} />
            <FieldRow
              label="Cadence"
              value={
                bundle.strategy.document.cadence.kind === "manual"
                  ? "Manual"
                  : `Every ${bundle.strategy.document.cadence.seconds} seconds`
              }
            />
            <FieldRow
              label="Allowed actions"
              value={bundle.strategy.document.allowedActions.join(", ")}
            />
            <FieldRow label="Strategy hash" value={bundle.strategy.hash} />
          </div>
        </section>
        {bundle.agent.mode === "demo" ? (
          <section className="route-panel" data-testid="stored-decisions">
            <span className="route-eyebrow">Stored decisions</span>
            {storedDecisions.length > 0 ? (
              <div className="owned-agent-links">
                {storedDecisions.map((decision) => (
                  <Link
                    key={decision.decisionId}
                    href={`/decisions/${decision.decisionId}`}
                  >
                    {decision.action} ·{" "}
                    {decision.createdAt.slice(0, 19).replace("T", " ")}{" "}
                    <StatusBadge tone={decision.approved ? "pass" : "block"}>
                      {decision.approved ? "Approved" : "Rejected"}
                    </StatusBadge>
                  </Link>
                ))}
              </div>
            ) : (
              <p>
                No decisions stored yet. Generate one above to create the first
                decision, policy evaluation and receipt for this agent.
              </p>
            )}
          </section>
        ) : (
          <PersistentRunsNotice />
        )}
        <section className="route-panel route-panel-muted">
          <span className="route-eyebrow">Treasury</span>
          <h2>No real treasury</h2>
          <p>
            No funded treasury, funding event, or onchain transaction exists for this
            draft. Each generated decision records a labelled demo fixture snapshot so
            the policy has every fact it needs; those balances are fictional.
          </p>
        </section>
        <section className="route-panel">
          <span className="route-eyebrow">
            Immutable policy · v{bundle.riskPolicy.version}
          </span>
          <div className="field-list">
            {bundle.riskPolicy.document.constraints.map((constraint) => (
              <FieldRow
                key={constraint.type}
                label={constraint.type.replaceAll("_", " ")}
                value={constraintValue(constraint)}
              />
            ))}
            <FieldRow label="Policy hash" value={bundle.riskPolicy.hash} />
          </div>
        </section>
        <section className="route-panel">
          <span className="route-eyebrow">Committed assets</span>
          <div className="field-list">
            {bundle.assets.map((asset) => (
              <FieldRow
                key={asset.id}
                label={`${asset.symbol} · ${asset.name}`}
                value={asset.mint}
                detail={`${asset.verificationState.replaceAll("_", " ")} · ${asset.source}`}
              />
            ))}
          </div>
          <Link className="secondary-button" href="/agents">
            Back to agent list
          </Link>
        </section>
      </div>
    </>
  );
}
