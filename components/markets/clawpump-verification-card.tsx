"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import type { ClawPumpVerificationRecord } from "@/lib/services/clawpump-verification";

/**
 * Latest sanitised provider verification record plus an owner-triggered
 * re-check. "Provider connected" is only shown for a stored real 200.
 */
export function ClawPumpVerificationCard({
  record,
  authenticated,
}: {
  record: ClawPumpVerificationRecord | null;
  authenticated: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/clawpump/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Verification request failed.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      className="route-panel route-panel-muted"
      data-testid="clawpump-verification"
    >
      <div className="clawpump-card-label">
        <span className="route-eyebrow">Provider verification</span>
        <InfoHint topic="providerState" label="About provider state" />
      </div>
      {record ? (
        <>
          <h2>
            {record.result === "connected"
              ? "Provider connected"
              : record.result === "unauthorised"
                ? "Key rejected by provider"
                : "Provider unreachable"}
          </h2>
          <StatusBadge
            tone={
              record.result === "connected"
                ? "pass"
                : record.result === "unauthorised"
                  ? "block"
                  : "warn"
            }
          >
            {record.result}
          </StatusBadge>
          <SourceStamp
            source={`ClawPump GET ${record.endpoint}`}
            timestamp={record.providerTimestamp ?? record.checkedAt}
          />
          <details className="tech-disclosure">
            <summary>Verification evidence and provider metadata</summary>
            <div className="tech-disclosure-body">
              <dl className="preflight-breakdown">
                <div>
                  <dt>HTTP status</dt>
                  <dd>
                    {record.httpStatus ?? (
                      <span
                        className="unavailable"
                        aria-label="HTTP status unavailable"
                      >
                        —
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Request id</dt>
                  <dd>
                    {record.requestId ?? (
                      <span className="unavailable" aria-label="Request id unavailable">
                        —
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Validated response</dt>
                  <dd>
                    {record.responseType ?? (
                      <span
                        className="unavailable"
                        aria-label="Validated response unavailable"
                      >
                        —
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Agent access (GET /agents)</dt>
                  <dd>
                    {record.agentAccess === "granted"
                      ? `granted, ${record.agentCount} agent(s) under the key`
                      : record.agentAccess === "forbidden"
                        ? "refused: key not linked to an account"
                        : record.agentAccessError
                          ? "not determined: GET /agents failed for another reason"
                          : "not checked"}
                  </dd>
                </div>
                <div>
                  <dt>Network</dt>
                  <dd>{record.network} (provider documentation)</dd>
                </div>
                <div>
                  <dt>Stored</dt>
                  <dd>{record.stored ? "yes" : "no database"}</dd>
                </div>
              </dl>
              {record.agentIds.length > 0 ? (
                <p>Agent ids: {record.agentIds.join(", ")}</p>
              ) : null}
            </div>
          </details>
          {record.agentAccessError ? (
            <p className="form-error">
              {record.agentAccessError} Agent create, attach and launch preflight stay
              refused until ClawPump links this Partner key to an account.
            </p>
          ) : null}
          {record.safeError ? <p className="form-error">{record.safeError}</p> : null}
          <small>
            Checked {record.checkedAt}. No key material or raw body is stored.
          </small>
        </>
      ) : (
        <>
          <h2>Key present, not yet verified</h2>
          <p>
            No stored verification record. A real authenticated request is required
            before this page can say the provider is connected.
          </p>
        </>
      )}
      <button
        className="secondary-button"
        type="button"
        disabled={!authenticated || busy}
        onClick={() => void verify()}
      >
        {busy
          ? "Requesting GET /agents…"
          : authenticated
            ? "Verify now"
            : "Authenticate wallet to verify"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
