"use client";

import { LinkSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ClawPumpIdentityChain } from "@/components/markets/clawpump-identity-chain";
import type { ClawPumpIdentityView } from "@/lib/services/clawpump-agents";

type AttachableAgent = Readonly<{
  id: string;
  name: string;
  status: string;
  walletAddress: string;
  tokenAddress: string | null;
}>;

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

/**
 * Owner action: link this saved agent to a ClawPump identity, by creating one
 * through the Partner API or attaching one the key already owns. Refreshes the
 * server-rendered chain on success; never runs on Atlas.
 */
export function ClawPumpLinkPanel({
  slug,
  identity,
  configured,
}: {
  slug: string;
  identity: ClawPumpIdentityView;
  configured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"create" | "attach" | "list" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachable, setAttachable] = useState<AttachableAgent[] | null>(null);
  const [selected, setSelected] = useState("");

  const linkable =
    configured &&
    (identity.integrationStatus === "not_configured" ||
      identity.integrationStatus === "failed");

  async function loadAttachable() {
    setBusy("list");
    setError(null);
    try {
      const response = await fetch("/api/integrations/clawpump/agents", {
        cache: "no-store",
      });
      const body = await readJson(response);
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Could not list ClawPump agents.",
        );
      }
      const agents = (body.agents as AttachableAgent[]) ?? [];
      setAttachable(agents);
      setSelected(agents[0]?.id ?? "");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not list ClawPump agents.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function link(
    request: { mode: "create" } | { mode: "attach"; externalAgentId: string },
  ) {
    setBusy(request.mode);
    setError(null);
    try {
      const response = await fetch(
        `/api/agents/${encodeURIComponent(slug)}/clawpump-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        },
      );
      const body = await readJson(response);
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Link failed.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Link failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="route-panel" data-testid="clawpump-link-panel">
      <div className="panel-heading">
        <LinkSimple aria-hidden="true" size={20} />
        <div>
          <span>ClawPump identity</span>
          <h2>Provider link</h2>
        </div>
      </div>
      <ClawPumpIdentityChain identity={identity} />
      {!configured ? (
        <p className="form-note">
          ClawPump is not configured on this server (CLAWPUMP_API_KEY, a cpk_ Partner
          key). Linking is unavailable until the key exists.
        </p>
      ) : identity.integrationStatus === "linked" ? (
        <p className="form-note">
          One link per agent. This identity cannot be replaced from Navis.
        </p>
      ) : (
        <div className="clawpump-link-actions">
          <button
            className="primary-button"
            type="button"
            disabled={!linkable || busy !== null}
            onClick={() => void link({ mode: "create" })}
          >
            {busy === "create" ? "Creating ClawPump agent…" : "Create ClawPump agent"}
          </button>
          {attachable === null ? (
            <button
              className="secondary-button"
              type="button"
              disabled={!linkable || busy !== null}
              onClick={() => void loadAttachable()}
            >
              {busy === "list" ? "Listing key agents…" : "Attach an existing agent"}
            </button>
          ) : attachable.length === 0 ? (
            <p className="form-note">
              The Partner key owns no unclaimed ClawPump agents to attach.
            </p>
          ) : (
            <div className="clawpump-attach-row">
              <label className="form-field">
                <span>Key-owned ClawPump agent</span>
                <select
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {attachable.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} · {agent.id} · {agent.status}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={!selected || busy !== null}
                onClick={() => void link({ mode: "attach", externalAgentId: selected })}
              >
                {busy === "attach" ? "Attaching…" : "Attach selected"}
              </button>
            </div>
          )}
          <p className="form-note">
            Creating calls POST /agents with a bounded mandate; attaching only accepts
            an id the key lists under GET /agents. Neither step launches a token or
            moves funds.
          </p>
        </div>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
