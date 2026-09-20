import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FieldRow, RouteHeader } from "@/components/route-primitives";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import type { RiskConstraint } from "@/lib/domain";
import { getPersistentAgentForOwner } from "@/lib/services/agents";

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
          <Link className="secondary-button" href="/agents/new">
            Return to agent setup
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

  const bundle = await getPersistentAgentForOwner(slug, session.wallet, getDatabase());
  if (!bundle) notFound();

  return (
    <>
      <RouteHeader
        eyebrow="Persistent draft"
        title={bundle.agent.name}
        description="Read-only record of the mandate, policy, and asset universe committed at creation."
        meta={`${bundle.agent.mode} · ${bundle.agent.status}`}
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
        <section className="route-panel route-panel-muted">
          <span className="route-eyebrow">Treasury</span>
          <h2>Unavailable</h2>
          <p>
            No treasury account, balance snapshot, funding event, or onchain transaction
            was created with this draft.
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
          <Link className="secondary-button" href="/agents/new">
            Back to agent setup
          </Link>
        </section>
      </div>
    </>
  );
}
