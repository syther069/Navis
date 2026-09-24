import {
  Check,
  Clock,
  FileText,
  Info,
  Minus,
  PaperPlaneTilt,
  Prohibit,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Signature,
  X,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";

import type { ExecutionMode, SolanaCluster } from "../../lib/env-core";
import { formatAmount, policyStatusLabel } from "../../lib/presentation";

export type StatusTone =
  | "neutral"
  | "active"
  | "pass"
  | "warn"
  | "block"
  | "pending"
  | "simulation"
  | "proposed"
  | "approved"
  | "signing"
  | "submitted"
  | "confirmed"
  | "failed"
  | "blocked";

export type DecisionState =
  | "proposed"
  | "approved"
  | "signing"
  | "submitted"
  | "confirmed"
  | "failed"
  | "blocked";

export const DECISION_STATE_META: Record<
  DecisionState,
  { label: string; tone: StatusTone; description: string }
> = {
  proposed: {
    label: "Proposed",
    tone: "proposed",
    description: "Proposed by agent · Awaiting deterministic review",
  },
  approved: {
    label: "Approved",
    tone: "approved",
    description: "Policy approved · Awaiting wallet authorization",
  },
  signing: {
    label: "Signing",
    tone: "signing",
    description: "Signing · Awaiting user wallet signature",
  },
  submitted: {
    label: "Submitted",
    tone: "submitted",
    description: "Submitted · Broadcasted to Solana network",
  },
  confirmed: {
    label: "Confirmed",
    tone: "confirmed",
    description: "Confirmed · Finalized onchain settlement",
  },
  failed: {
    label: "Failed",
    tone: "failed",
    description: "Failed · Simulation failed or transaction reverted",
  },
  blocked: {
    label: "Blocked",
    tone: "blocked",
    description: "Blocked · Rejected by deterministic risk policy",
  },
};

const statusIcons = {
  neutral: Minus,
  active: Check,
  pass: Check,
  warn: ShieldWarning,
  block: X,
  pending: Clock,
  simulation: Info,
  proposed: FileText,
  approved: ShieldCheck,
  signing: Signature,
  submitted: PaperPlaneTilt,
  confirmed: SealCheck,
  failed: XCircle,
  blocked: Prohibit,
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

export function DecisionStateBadge({
  state,
  label,
  subtitle,
}: {
  state: DecisionState;
  label?: string;
  subtitle?: string;
}) {
  const meta = DECISION_STATE_META[state];
  return (
    <div className="decision-state-badge" data-state={state}>
      <StatusBadge tone={meta.tone}>{label ?? meta.label}</StatusBadge>
      {subtitle ? <span className="decision-state-badge-sub">{subtitle}</span> : null}
    </div>
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
