import { StatusBadge } from "@/components/shared/domain-primitives";
import {
  CLAWPUMP_STATE_LABELS,
  type ClawPumpConnectionStatus,
  type ClawPumpSectionState,
  type ClawPumpStateStep,
} from "@/lib/integrations/clawpump/state";

/**
 * Renders the ClawPump state model. Launch states stay hidden until a real
 * stored launch record with a signature exists.
 */
export function ClawPumpStateTrack({
  current,
  connection,
  steps,
}: {
  current: ClawPumpSectionState;
  connection: ClawPumpConnectionStatus;
  steps: readonly ClawPumpStateStep[];
}) {
  return (
    <div
      className="clawpump-state-track"
      data-testid="clawpump-state-track"
      data-current={current}
    >
      <div className="clawpump-state-current">
        <span className="route-eyebrow">Current state</span>
        <StatusBadge
          tone={
            connection === "not_configured"
              ? "warn"
              : current === "preflight_rejected"
                ? "block"
                : current === "connected" || current === "not_configured"
                  ? "neutral"
                  : "pass"
          }
        >
          {connection === "configured_unverified" && current === "not_configured"
            ? "Key present, not verified"
            : CLAWPUMP_STATE_LABELS[current]}
        </StatusBadge>
      </div>
      <ol className="clawpump-state-list">
        {steps
          .filter((step) => step.visible)
          .map((step) => (
            <li key={step.state} data-state={step.state} data-reached={step.reached}>
              <span aria-hidden="true">{step.reached ? "●" : "○"}</span>
              {CLAWPUMP_STATE_LABELS[step.state]}
            </li>
          ))}
      </ol>
      <small>
        Launch submitted and Launch verified onchain appear only when Navis has stored a
        launch record with a real transaction signature. None exists.
      </small>
    </div>
  );
}
