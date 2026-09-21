import { AddressValue } from "@/components/shared/address-value";
import { StatusBadge } from "@/components/shared/domain-primitives";
import type { ClawPumpIdentityView } from "@/lib/services/clawpump-agents";

/**
 * Navis agent -> ClawPump agent id -> linked wallet -> token -> verification
 * status. Server-renderable; every value comes from the stored link row or
 * the live GET /agents/{id} refresh.
 */
export function ClawPumpIdentityChain({
  identity,
}: {
  identity: ClawPumpIdentityView;
}) {
  const live = identity.live;
  const verification =
    live.status === "refreshed"
      ? {
          tone: "pass" as const,
          label: "Verified live",
          detail: `Request ${live.requestId} at ${live.timestamp}`,
        }
      : live.status === "failed"
        ? { tone: "block" as const, label: "Refresh failed", detail: live.safeError }
        : live.status === "not_configured"
          ? {
              tone: "warn" as const,
              label: "Stored only",
              detail: "CLAWPUMP_API_KEY absent; identity not re-read.",
            }
          : identity.integrationStatus === "failed"
            ? {
                tone: "block" as const,
                label: "Link failed",
                detail: "The last link attempt failed; retry from this page.",
              }
            : identity.integrationStatus === "pending"
              ? {
                  tone: "pending" as const,
                  label: "Link pending",
                  detail: "A link request is in flight.",
                }
              : {
                  tone: "neutral" as const,
                  label: "Not linked",
                  detail: "No ClawPump identity yet.",
                };
  const tokenAddress = live.status === "refreshed" ? live.tokenAddress : null;

  return (
    <ol className="identity-chain" data-testid="clawpump-identity-chain">
      <li>
        <span>Navis agent</span>
        <strong>{identity.localAgentName}</strong>
        <small>{identity.localAgentSlug}</small>
      </li>
      <li>
        <span>ClawPump agent id</span>
        {identity.externalAgentId ? (
          <code>{identity.externalAgentId}</code>
        ) : (
          <strong>None</strong>
        )}
        {live.status === "refreshed" ? (
          <small>
            {live.name} · {live.agentStatus}
          </small>
        ) : null}
      </li>
      <li>
        <span>Linked public wallet</span>
        {identity.externalWallet ? (
          <AddressValue
            value={
              live.status === "refreshed" ? live.walletAddress : identity.externalWallet
            }
            label="ClawPump agent wallet"
          />
        ) : (
          <strong>None</strong>
        )}
      </li>
      <li>
        <span>Token address</span>
        {tokenAddress ? (
          <AddressValue value={tokenAddress} label="Token address" />
        ) : (
          <strong>
            {identity.integrationStatus === "linked" ? "No token yet" : "None"}
          </strong>
        )}
      </li>
      <li>
        <span>Verification</span>
        <StatusBadge tone={verification.tone}>{verification.label}</StatusBadge>
        <small>{verification.detail}</small>
      </li>
    </ol>
  );
}
