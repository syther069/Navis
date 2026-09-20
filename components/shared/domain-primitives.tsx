import {
  Check,
  Clock,
  Info,
  Minus,
  ShieldWarning,
  X,
} from "@phosphor-icons/react/dist/ssr";

import type { ExecutionMode, SolanaCluster } from "../../lib/env-core";
import { formatAmount, policyStatusLabel } from "../../lib/presentation";

export type StatusTone =
  "neutral" | "active" | "pass" | "warn" | "block" | "pending" | "simulation";

const statusIcons = {
  neutral: Minus,
  active: Check,
  pass: Check,
  warn: ShieldWarning,
  block: X,
  pending: Clock,
  simulation: Info,
} satisfies Record<StatusTone, typeof Check>;

export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: React.ReactNode;
}) {
  const Icon = statusIcons[tone];
  return (
    <span className="status-badge" data-tone={tone}>
      <Icon aria-hidden="true" size={13} weight="bold" />
      <span>{children}</span>
    </span>
  );
}

export function ModeStamp({ mode }: { mode: ExecutionMode }) {
  return (
    <span className="mode-stamp" data-mode={mode}>
      {mode}
    </span>
  );
}

export function SourceStamp({
  source,
  timestamp,
  state = "available",
}: {
  source: string;
  timestamp?: string;
  state?: "available" | "stale" | "unavailable";
}) {
  return (
    <span className="source-stamp" data-state={state}>
      <span className="source-stamp-mark" aria-hidden="true" />
      <span>
        <strong>{source}</strong>
        {timestamp ? <small>{timestamp}</small> : null}
      </span>
      <span className="sr-only">Source state: {state}</span>
    </span>
  );
}

export function ClusterStamp({ cluster }: { cluster: SolanaCluster }) {
  return (
    <span className="cluster-stamp">
      <span aria-hidden="true" />
      <span>{cluster}</span>
    </span>
  );
}

export function AmountValue({
  value,
  symbol,
  maximumFractionDigits = 2,
  approximate = false,
}: {
  value: number | null;
  symbol?: string;
  maximumFractionDigits?: number;
  approximate?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="amount-value" data-state="unknown">
        Unknown
      </span>
    );
  }

  const formatted = formatAmount(value, maximumFractionDigits);

  return (
    <span className="amount-value">
      {approximate ? <span aria-label="approximately">≈</span> : null}
      <span>{formatted}</span>
      {symbol ? <small>{symbol}</small> : null}
    </span>
  );
}

export function PolicyResult({
  label,
  observed,
  threshold,
  detail,
  status,
}: {
  label: string;
  observed: string;
  threshold: string;
  detail?: string;
  status: "pass" | "warn" | "block";
}) {
  const Icon = statusIcons[status];
  const statusLabel = policyStatusLabel(status);

  return (
    <div className="policy-result" data-status={status}>
      <span className="policy-result-icon" aria-hidden="true">
        <Icon size={14} weight="bold" />
      </span>
      <div>
        <span>{label}</span>
        <small>{detail ?? `${statusLabel} policy check`}</small>
      </div>
      <div className="policy-result-values">
        <strong>{observed}</strong>
        <small>Limit {threshold}</small>
      </div>
      <span className="sr-only">{statusLabel}</span>
    </div>
  );
}
