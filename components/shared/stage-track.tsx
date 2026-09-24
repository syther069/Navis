import {
  Check,
  Circle,
  CircleDashed,
  Prohibit,
  X,
  Flask,
  LockSimple,
} from "@phosphor-icons/react/dist/ssr";

import { InfoHint } from "@/components/shared/info-hint";
import type { InfoHintKey } from "@/components/shared/info-hint-content";

/**
 * Presentation-only state of one workflow stage. Callers must derive it from
 * real records or real client state; this component never infers progress.
 *
 * - complete: the stage actually happened and was recorded.
 * - current: the stage the user or system is on right now.
 * - pending: not reached yet.
 * - simulated: ran as a simulation only (no value moved).
 * - disabled: unavailable in this deployment (e.g. Meteora broadcast while its gate is closed).
 * - failed: attempted and failed.
 * - blocked: refused by policy, configuration or provider.
 */
export type StageState =
  "complete" | "current" | "pending" | "simulated" | "disabled" | "failed" | "blocked";

export type Stage = {
  key: string;
  label: string;
  state: StageState;
  /** One short factual line: what was recorded, or why the stage is unavailable. */
  detail?: string;
  hint?: InfoHintKey;
};

const STATE_LABEL: Record<StageState, string> = {
  complete: "Done",
  current: "Current",
  pending: "Not reached",
  simulated: "Simulated only",
  disabled: "Disabled",
  failed: "Failed",
  blocked: "Blocked",
};

const STATE_ICON = {
  complete: Check,
  current: Circle,
  pending: CircleDashed,
  simulated: Flask,
  disabled: LockSimple,
  failed: X,
  blocked: Prohibit,
} satisfies Record<StageState, typeof Check>;

export function StageTrack({
  stages,
  label,
  orientation = "horizontal",
}: {
  stages: readonly Stage[];
  /** Accessible name for the list, e.g. "Meteora launch stages". */
  label: string;
  /** Horizontal collapses to vertical on narrow screens automatically. */
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <ol className="stage-track" data-orientation={orientation} aria-label={label}>
      {stages.map((stage, index) => {
        const Icon = STATE_ICON[stage.state];
        return (
          <li
            key={stage.key}
            className="stage-track-item"
            data-state={stage.state}
            aria-current={stage.state === "current" ? "step" : undefined}
          >
            <span className="stage-track-marker" aria-hidden="true">
              <Icon size={12} weight="bold" />
            </span>
            <div className="stage-track-body">
              <div className="stage-track-head">
                <span className="stage-track-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="stage-track-label">{stage.label}</span>
                {stage.hint ? (
                  <InfoHint
                    topic={stage.hint}
                    label={`About ${stage.label.toLowerCase()}`}
                  />
                ) : null}
              </div>
              <span className="stage-track-state">{STATE_LABEL[stage.state]}</span>
              {stage.detail ? (
                <p className="stage-track-detail">{stage.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
