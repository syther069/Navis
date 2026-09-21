import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { AgentForm } from "@/components/agent/agent-form";
import { RouteHeader } from "@/components/route-primitives";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env, getPublicCapabilities } from "@/lib/env";
import { listPersistentAgentsForOwner } from "@/lib/services/agents";

export const metadata: Metadata = { title: "New agent" };
export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  const capabilities = getPublicCapabilities();
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  const canPersist =
    Boolean(session) &&
    capabilities.persistenceConfigured &&
    capabilities.walletAuthenticationConfigured;
  const ownedAgents =
    canPersist && env.databaseUrl && session
      ? await listPersistentAgentsForOwner(session.wallet, getDatabase())
      : [];
  return (
    <>
      <RouteHeader
        eyebrow="Agent setup"
        title="Define a mandate"
        description="Stage and review the objective and guardrails for a persistent draft. Saving requires an authenticated wallet and never funds an agent."
        meta={
          session ? "Wallet-authenticated draft" : "Review available · save blocked"
        }
      />
      <div className="route-grid">
        <AgentForm
          persistenceAvailable={canPersist}
          clawPumpAvailable={false}
          authenticated={Boolean(session)}
          wallet={session?.wallet ?? null}
        />
        <aside className="route-panel route-panel-muted">
          <span className="route-eyebrow">Creation boundary</span>
          <h2>Review precedes every write.</h2>
          <p>
            Navis creates the local agent, strategy v1, and policy v1 atomically for the
            authenticated wallet. Safe demo creation does not call ClawPump, fund a
            treasury, or submit an onchain transaction.
          </p>
          <div className="owned-agent-links">
            <span className="route-eyebrow">Your persistent agents</span>
            {ownedAgents.length > 0 ? (
              <>
                {ownedAgents.map((agent) => (
                  <Link key={agent.id} href={`/agents/${agent.slug}`}>
                    {agent.name} <small>{agent.status}</small>
                  </Link>
                ))}
                <Link href="/agents">
                  All agents <small>list</small>
                </Link>
              </>
            ) : (
              <p>
                {session
                  ? "No persistent agents belong to this wallet yet."
                  : "Authenticate a connected wallet to view its persistent agents."}
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
