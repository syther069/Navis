import {
  CheckCircle,
  Circle,
  CircleDashed,
  WarningCircle,
} from "@phosphor-icons/react";

export type MeteoraTimelineStepState = "done" | "current" | "pending" | "failed";

export type MeteoraTimelineStep = Readonly<{
  key: string;
  label: string;
  state: MeteoraTimelineStepState;
}>;

/**
 * Presentational transaction timeline for the Meteora DBC flow. Pure: the
 * caller derives every step state from the live flow state, so the markup can
 * be asserted directly in tests.
 */
export function MeteoraTimeline({ steps }: { steps: readonly MeteoraTimelineStep[] }) {
  return (
    <ol className="meteora-timeline" aria-label="Transaction timeline">
      {steps.map((step) => (
        <li key={step.key} data-state={step.state}>
          {step.state === "done" ? (
            <CheckCircle aria-hidden="true" size={15} weight="fill" />
          ) : step.state === "failed" ? (
            <WarningCircle aria-hidden="true" size={15} weight="fill" />
          ) : step.state === "current" ? (
            <CircleDashed aria-hidden="true" size={15} />
          ) : (
            <Circle aria-hidden="true" size={15} />
          )}
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
