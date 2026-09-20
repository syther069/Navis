import type { Metadata } from "next";

import { AgentForm } from "@/components/agent/agent-form";
import { RouteHeader } from "@/components/route-primitives";
import { getPublicCapabilities } from "@/lib/env";

export const metadata: Metadata = { title: "New agent" };
export const dynamic = "force-dynamic";

export default function NewAgentPage() {
  const capabilities = getPublicCapabilities();
  return (
    <>
      <RouteHeader
        eyebrow="Agent setup"
        title="Define a mandate"
        description="Stage the objective and guardrails for a new autonomous treasury agent. Nothing is created or funded from this screen yet."
        meta="Draft only"
      />
      <div className="route-grid">
        <AgentForm
          persistenceAvailable={
            capabilities.persistenceConfigured &&
            capabilities.walletAuthenticationConfigured
          }
          clawPumpAvailable={capabilities.clawpumpConfigured}
        />
        <aside className="route-panel route-panel-muted">
          <span className="route-eyebrow">Creation boundary</span>
          <h2>Review precedes every write.</h2>
          <p>
            Navis creates the local agent, strategy v1, and policy v1 atomically. An
            optional ClawPump link happens only afterward, so provider failure leaves an
            honest local draft with no invented external wallet.
          </p>
        </aside>
      </div>
    </>
  );
}
