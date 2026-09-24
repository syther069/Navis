import { StageTrack, type Stage } from "@/components/shared/stage-track";
import { StatusBadge } from "@/components/shared/domain-primitives";
import {
  CLAWPUMP_STATE_LABELS,
  type ClawPumpConnectionStatus,
  type ClawPumpSectionState,
  type ClawPumpStateStep,
} from "@/lib/integrations/clawpump/state";

/** Presentation of the derived integration states; no step is inferred from a quote. */
export function ClawPumpStateTrack({
  current,
  connection,
  steps,
  apiResult,
  providerResult,
}: {
  current: ClawPumpSectionState;
  connection: ClawPumpConnectionStatus;
  steps: readonly ClawPumpStateStep[];
  apiResult: "not_configured" | "unavailable" | "empty" | "available";
  providerResult: "connected" | "unauthorised" | "unreachable" | null;
}) {
  const reached = (state: ClawPumpSectionState) =>
    steps.some((step) => step.state === state && step.reached);
  const unconfigured = connection === "not_configured";
  const verified = connection === "connected";
  const rejected = reached("preflight_rejected");
  const quoted = reached("preflight_successful");
  const submitted = reached("launch_submitted");
  const completed = reached("launch_verified_onchain");
  const blocked = rejected || providerResult === "unauthorised";
  const unavailable = unconfigured || apiResult === "unavailable";
  const stages: Stage[] = [
    {
      key: "connectivity",
      label: "Connectivity",
      state: unconfigured ? "disabled" : verified ? "complete" : "current",
      detail: unconfigured
        ? "CLAWPUMP_API_KEY is absent on the server. No request was made."
        : verified
          ? "An authenticated provider response was recorded."
          : "Key present; a successful authenticated response is not established.",
      hint: "integrationConnectivity",
    },
    {
      key: "api",
      label: "API result",
      state: unconfigured
        ? "disabled"
        : apiResult === "unavailable"
          ? "failed"
          : apiResult === "available" || apiResult === "empty"
            ? "complete"
            : "pending",
      detail:
        apiResult === "available"
          ? "Pair catalogue returned by the provider."
          : apiResult === "empty"
            ? "Request succeeded; the catalogue contains no pairs."
            : apiResult === "unavailable"
              ? "Pair discovery failed; no catalogue is available."
              : "No pair request can be made without a server key.",
    },
    {
      key: "provider",
      label: "Provider state",
      state: unconfigured
        ? "disabled"
        : providerResult === "connected"
          ? "complete"
          : providerResult === "unauthorised"
            ? "blocked"
            : providerResult === "unreachable"
              ? "failed"
              : "pending",
      detail:
        providerResult === "connected"
          ? "The stored verification recorded provider access."
          : providerResult === "unauthorised"
            ? "The provider refused the key."
            : providerResult === "unreachable"
              ? "The provider could not be reached."
              : "No successful verification record is available.",
      hint: "providerState",
    },
    {
      key: "preflight",
      label: "Preflight",
      state: rejected
        ? "blocked"
        : quoted
          ? "complete"
          : unconfigured
            ? "disabled"
            : "pending",
      detail: rejected
        ? "The latest stored preflight was rejected."
        : quoted
          ? "The latest stored preflight returned a quote; nothing launched."
          : unconfigured
            ? "Requires a configured provider and eligible inputs."
            : "No successful preflight recorded for this owner.",
      hint: "preflight",
    },
    {
      key: "preparation",
      label: "Preparation",
      state: "disabled",
      detail:
        "No separate preparation record is exposed. A quote is not a prepared launch.",
      hint: "preparation",
    },
    {
      key: "transaction",
      label: "Transaction",
      state: submitted ? "complete" : unconfigured ? "disabled" : "pending",
      detail: submitted
        ? "A stored launch has a real transaction signature."
        : "No stored launch transaction signature.",
      hint: "signature",
    },
    {
      key: "completed",
      label: "Completed",
      state: completed ? "complete" : unconfigured ? "disabled" : "pending",
      detail: completed
        ? "The stored launch is verified onchain."
        : "No onchain-verified launch recorded.",
      hint: "confirmation",
    },
    {
      key: "unavailable",
      label: "Unavailable",
      state: unavailable ? "current" : "pending",
      detail: unconfigured
        ? "Set a cpk_ Partner CLAWPUMP_API_KEY server-side to enable live requests."
        : apiResult === "unavailable"
          ? "Pair discovery is unavailable; retry after the provider recovers."
          : "No integration availability issue reported.",
    },
    {
      key: "blocked",
      label: "Blocked",
      state: blocked ? "blocked" : "pending",
      detail: rejected
        ? "The latest preflight was rejected; review its prerequisites."
        : providerResult === "unauthorised"
          ? "Provider access is refused for this key."
          : "No provider or preflight rejection recorded.",
    },
  ];

  return (
    <div
      className="clawpump-state-track"
      data-testid="clawpump-state-track"
      data-current={current}
    >
      <div className="clawpump-state-current">
        <div>
          <span className="route-eyebrow">Integration status / live evidence</span>
          <strong>
            {unconfigured
              ? "Unavailable — provider not configured"
              : connection === "configured_unverified" && current === "not_configured"
                ? "Key present, not verified"
                : CLAWPUMP_STATE_LABELS[current]}
          </strong>
        </div>
        <StatusBadge
          tone={
            unconfigured ? "neutral" : blocked ? "block" : verified ? "pass" : "pending"
          }
        >
          {unconfigured
            ? "Unavailable"
            : blocked
              ? "Blocked"
              : verified
                ? "Connected"
                : "Unverified"}
        </StatusBadge>
      </div>
      <StageTrack
        stages={stages}
        label="ClawPump integration state matrix"
        orientation="vertical"
      />
      <p className="clawpump-state-footnote">
        Submission and onchain verification are shown as complete only with a stored
        signed launch record. A quote does not execute a transaction.
      </p>
    </div>
  );
}
