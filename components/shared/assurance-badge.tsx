import type { Assurance, AssuranceLevel } from "../../lib/assurance";
import { StatusBadge, type StatusTone } from "./domain-primitives";

const levelTones: Readonly<Record<AssuranceLevel, StatusTone>> = {
  offchain_integrity: "neutral",
  wallet_authorization: "pending",
  onchain_settlement: "pass",
};

/**
 * Compact two-part label: the assurance level (how far the evidence reaches)
 * and the evidence origin (demo simulation or live onchain).
 */
export function AssuranceBadge({
  assurance,
  compact = false,
}: {
  assurance: Assurance;
  compact?: boolean;
}) {
  return (
    <span
      className="assurance-badge"
      data-level={assurance.level}
      data-origin={assurance.origin}
      data-testid="assurance-badge"
      title={assurance.explanation}
    >
      {compact ? null : <span className="assurance-badge-label">Assurance</span>}
      <StatusBadge tone={levelTones[assurance.level]}>
        {assurance.levelLabel}
      </StatusBadge>
      <StatusBadge
        tone={assurance.origin === "demo_simulation" ? "simulation" : "active"}
      >
        {assurance.originLabel}
      </StatusBadge>
    </span>
  );
}
