import type { Icon } from "@phosphor-icons/react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

import { StatusBadge } from "@/components/shared/domain-primitives";

export type SponsorPanelStatus = "loading" | "empty" | "error" | "not_configured";

const statusCopy: Readonly<
  Record<
    SponsorPanelStatus,
    { badge: string; tone: "pending" | "neutral" | "block" | "warn" }
  >
> = {
  loading: { badge: "Loading", tone: "pending" },
  empty: { badge: "Empty", tone: "neutral" },
  error: { badge: "Unavailable", tone: "block" },
  not_configured: { badge: "Unavailable", tone: "neutral" },
};

/**
 * Explicit state card for a sponsor surface (ClawPump, Meteora, PreStocks).
 * Sponsor panels must never render a blank area: when a key, RPC or upstream
 * API is missing the judge sees which state applies and why.
 */
export function SponsorPanelState({
  provider,
  icon: ProviderIcon,
  status,
  title,
  description,
  headingId,
}: {
  provider: string;
  icon: Icon;
  status: SponsorPanelStatus;
  title: string;
  description: string;
  headingId?: string;
}) {
  const copy = statusCopy[status];
  const busy = status === "loading";
  return (
    <section
      className="route-panel route-panel-muted sponsor-panel-state"
      data-status={status}
      data-testid={`sponsor-panel-${status}`}
      aria-labelledby={headingId}
      aria-busy={busy || undefined}
      role={busy ? "status" : undefined}
    >
      <div className="panel-heading">
        <ProviderIcon aria-hidden="true" size={20} />
        <div>
          <span>{provider}</span>
          <h2 id={headingId}>{title}</h2>
        </div>
        <StatusBadge tone={copy.tone}>{copy.badge}</StatusBadge>
      </div>
      {busy ? (
        <div className="sponsor-panel-skeleton" aria-hidden="true">
          <div className="skeleton skeleton-copy" />
          <div className="skeleton skeleton-panel" />
        </div>
      ) : (
        <p className="route-copy">
          {status === "error" ? <WarningCircle aria-hidden="true" size={16} /> : null}{" "}
          {description}
        </p>
      )}
      {busy ? <span className="sr-only">{description}</span> : null}
    </section>
  );
}
