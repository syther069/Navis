import { RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import type { Availability } from "./integrations";
import type { Lifecycle, StepState } from "./lifecycle";
import { WorkspaceHint, type WorkspaceHintKey } from "./workspace-hint";
import type { InfoHintKey } from "@/components/shared/info-hint-content";

/* Stage seal ------------------------------------------------------------- */

export function LifecycleChip({
  lifecycle,
  compact = false,
  testId,
}: {
  lifecycle: Pick<Lifecycle, "stage" | "tone" | "qualifier" | "simulated">;
  compact?: boolean;
  testId?: string;
}) {
  return (
    <span
      className="ws-stage"
      data-stage={lifecycle.stage}
      data-tone={lifecycle.tone}
      data-testid={testId}
    >
      <span className="ws-stage-mark" aria-hidden="true" />
      <span className="ws-stage-label">{lifecycle.stage}</span>
      {!compact && lifecycle.qualifier ? (
        <span className="ws-stage-qualifier">{lifecycle.qualifier}</span>
      ) : null}
      {compact && lifecycle.simulated ? (
        <span className="ws-stage-qualifier">Simulated</span>
      ) : null}
    </span>
  );
}

const stepStateLabel: Record<StepState, string> = {
  complete: "Done",
  current: "Now",
  waiting: "Not reached",
  "not-requested": "Not requested",
  blocked: "Stopped",
  failed: "Failed",
  unrecorded: "Not recorded",
};

/* Authority chain -------------------------------------------------------- */

export function LifecycleRail({
  lifecycle,
  label = "Decision lifecycle",
}: {
  lifecycle: Lifecycle;
  label?: string;
}) {
  return (
    <ol className="ws-rail" aria-label={label} data-stage={lifecycle.stage}>
      {lifecycle.steps.map((step, index) => (
        <li key={step.key} className="ws-rail-step" data-state={step.state}>
          <span className="ws-rail-node" aria-hidden="true">
            <span />
          </span>
          <div className="ws-rail-copy">
            <span className="ws-rail-index">
              {String(index + 1).padStart(2, "0")} · {step.actor}
            </span>
            <strong>{step.label}</strong>
            <span className="ws-rail-state">{stepStateLabel[step.state]}</span>
            <small>{step.note}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* Section frame ---------------------------------------------------------- */

export function SectionHead({
  id,
  eyebrow,
  title,
  hint,
  hintLabel,
  aside,
  level = 2,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  hint?: InfoHintKey | WorkspaceHintKey;
  hintLabel?: string;
  aside?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="ws-section-head">
      <div className="ws-section-title">
        {eyebrow ? <span className="ws-eyebrow">{eyebrow}</span> : null}
        <div className="ws-heading-row">
          <Heading id={id}>{title}</Heading>
          {hint ? <WorkspaceHint topic={hint} label={hintLabel} /> : null}
        </div>
      </div>
      {aside ? <div className="ws-section-aside">{aside}</div> : null}
    </div>
  );
}

/* Data states ------------------------------------------------------------ */

export function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="ws-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="ws-skeleton-row" style={{ width: `${92 - index * 14}%` }} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({
  title,
  error,
  retry,
  testId,
}: {
  title: string;
  error: string;
  retry?: () => void;
  testId?: string;
}) {
  return (
    <div className="ws-state" data-kind="error" role="alert" data-testid={testId}>
      <div>
        <strong>{title}</strong>
        <p>{error}</p>
      </div>
      {retry ? (
        <button
          className="secondary-button"
          type="button"
          onClick={retry}
          data-testid={testId ? `${testId}-retry` : undefined}
        >
          <RotateCw aria-hidden="true" size={15} /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyNote({
  title,
  children,
  action,
  kind = "empty",
  testId,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  kind?: "empty" | "unavailable";
  testId?: string;
}) {
  return (
    <div className="ws-state" data-kind={kind} data-testid={testId}>
      <span className="ws-state-glyph" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      {action ? <div className="ws-state-action">{action}</div> : null}
    </div>
  );
}

/* Availability tag ------------------------------------------------------- */

export type { Availability };

const availabilityLabel: Record<Availability, string> = {
  enabled: "Enabled",
  configured: "Configured",
  devnet: "Devnet",
  simulation: "Simulation",
  preparation: "Prepare only",
  blocked: "Blocked",
  unavailable: "Unavailable",
  planned: "Planned",
};

export function AvailabilityTag({ value, label }: { value: Availability; label?: string }) {
  return (
    <span className="ws-avail" data-availability={value}>
      <span aria-hidden="true" />
      {label ?? availabilityLabel[value]}
    </span>
  );
}
