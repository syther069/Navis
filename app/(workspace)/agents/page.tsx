import { ArrowRight, Compass, Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { RouteHeader } from "@/components/route-primitives";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { listPersistentAgentsForOwner } from "@/lib/services/agents";

export const metadata: Metadata = { title: "Agents" };
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  const ownedAgents =
    session && env.databaseUrl
      ? await listPersistentAgentsForOwner(session.wallet, getDatabase())
      : [];
  const ownerNote = !session
    ? "Authenticate a connected wallet to see the agents it created."
    : !env.databaseUrl
      ? "This instance has no persistent evidence store, so only the Atlas demo is available."
      : ownedAgents.length === 0
        ? "This wallet has not created an agent yet."
        : `${ownedAgents.length} agent${ownedAgents.length === 1 ? "" : "s"} owned by the connected wallet.`;

  return (
    <>
      <RouteHeader
        eyebrow="Agent registry"
        title="Agents"
        description="The public Atlas demo plus every persistent agent created by the connected wallet. Open one to generate a decision and follow it to its stored receipt."
        meta={session ? "Wallet-scoped" : "Public demo only"}
      />
      <section className="route-panel decision-ledger" aria-label="Agents">
        <article className="decision-ledger-row" data-testid="agent-card-atlas">
          <Compass size={20} aria-hidden="true" />
          <div>
            <span>DEMO · {demoAgentBundle.agent.cluster}</span>
            <h2>{demoAgentBundle.agent.name}</h2>
            <small>
              Public deterministic demo. Runs in memory, no wallet required, never
              executes.
            </small>
          </div>
          <code>{demoAgentBundle.strategy.hash.slice(0, 14)}…</code>
          <StatusBadge tone="simulation">Demo</StatusBadge>
          <Link className="secondary-button" href="/agents/atlas">
            Open <ArrowRight size={16} />
          </Link>
        </article>
        {ownedAgents.map((agent) => (
          <article
            key={agent.id}
            className="decision-ledger-row"
            data-testid="agent-card-owned"
          >
            <Compass size={20} aria-hidden="true" />
            <div>
              <span>
                {agent.mode.toUpperCase()} · {agent.cluster}
              </span>
              <h2>{agent.name}</h2>
              <small>
                Created {agent.createdAt.slice(0, 10)} · strategy v
                {agent.activeStrategyVersion ?? 1} · policy v
                {agent.activeRiskPolicyVersion ?? 1}
              </small>
            </div>
            <code>{agent.slug}</code>
            <StatusBadge tone={agent.status === "active" ? "active" : "neutral"}>
              {agent.status}
            </StatusBadge>
            <Link className="secondary-button" href={`/agents/${agent.slug}`}>
              Open <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </section>
      <section className="route-panel route-panel-muted">
        <span className="route-eyebrow">Your persistent agents</span>
        <p className="route-copy">{ownerNote}</p>
        <Link className="primary-button" href="/agents/new">
          <Plus size={16} aria-hidden="true" /> Create an agent
        </Link>
      </section>
    </>
  );
}
