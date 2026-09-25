import {
  CheckCircle,
  Circle,
  CircleDashed,
  LockKey,
  WarningCircle,
} from "@phosphor-icons/react";

export type MeteoraTimelineStepState = "done" | "current" | "pending" | "failed" | "disabled";

export type MeteoraTimelineStep = Readonly<{
  key: string;
  label: string;
  state: MeteoraTimelineStepState;
  detail?: string;
}>;

/**
 * Presentational transaction timeline for the Meteora DBC flow.
 * Clearly distinguishes each step and displays disabled/gated stages (e.g. Broadcast & Confirmation)
 * without implying execution has occurred.
 */
export function MeteoraTimeline({ steps }: { steps: readonly MeteoraTimelineStep[] }) {
  return (
    <ol className="meteora-timeline" aria-label="Transaction timeline">
      {steps.map((step) => (
        <li key={step.key} data-state={step.state} className={`timeline-step-item state-${step.state}`}>
          <span className="step-icon-wrap" aria-hidden="true">
            {step.state === "done" ? (
              <CheckCircle size={15} weight="fill" />
            ) : step.state === "failed" ? (
              <WarningCircle size={15} weight="fill" />
            ) : step.state === "disabled" ? (
              <LockKey size={14} />
            ) : step.state === "current" ? (
              <CircleDashed size={15} />
            ) : (
              <Circle size={15} />
            )}
          </span>
          <div className="step-text-wrap">
            <span>{step.label}</span>
            {step.detail ? <small className="step-subdetail">{step.detail}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
