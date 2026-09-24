/**
 * ClawPump section state model. Pure and shared by the server page, the
 * client panels and the tests. Every state is derived from stored records or
 * a live provider response; nothing here is assumed.
 */

export const CLAWPUMP_SECTION_STATES = [
  "not_configured",
  "connected",
  "agent_linked",
  "stock_pair_discovered",
  "preflight_successful",
  "preflight_rejected",
  "launch_not_submitted",
  "launch_submitted",
  "launch_verified_onchain",
] as const;

export type ClawPumpSectionState = (typeof CLAWPUMP_SECTION_STATES)[number];

export type ClawPumpStateInput = Readonly<{
  /** CLAWPUMP_API_KEY present on the server. */
  configured: boolean;
  /** Latest stored verification record succeeded (a real authenticated 200). */
  verified: boolean;
  /** At least one owner agent is linked to a ClawPump identity. */
  linkedAgentCount: number;
  /** Count of live catalogue pairs classified as tokenized stock. */
  stockPairCount: number;
  /** Latest stored preflight for this owner, if any. */
  latestPreflight: { outcome: "quoted" | "rejected" } | null;
  /**
   * A stored launch record. Only a row with a real transaction signature can
   * produce the two launch states; today Navis never writes one, so they never
   * render.
   */
  launch: { transactionSignature: string | null; verifiedOnchain: boolean } | null;
}>;

export type ClawPumpStateStep = Readonly<{
  state: ClawPumpSectionState;
  reached: boolean;
  /** Renderable at all. Launch states are hidden unless real evidence exists. */
  visible: boolean;
}>;

export type ClawPumpConnectionStatus =
  "not_configured" | "configured_unverified" | "connected";

export function deriveClawPumpStates(input: ClawPumpStateInput): {
  current: ClawPumpSectionState;
  connection: ClawPumpConnectionStatus;
  steps: readonly ClawPumpStateStep[];
} {
  const configured = input.configured;
  const connected = configured && input.verified;
  const agentLinked = connected && input.linkedAgentCount > 0;
  const stockPair = connected && input.stockPairCount > 0;
  const preflightOk = agentLinked && input.latestPreflight?.outcome === "quoted";
  const preflightRejected = connected && input.latestPreflight?.outcome === "rejected";
  const launchSubmitted = Boolean(input.launch?.transactionSignature);
  const launchVerified = launchSubmitted && Boolean(input.launch?.verifiedOnchain);
  // "Launch not submitted" is a positive statement: a preflight exists and no
  // stored launch record with a signature exists.
  const launchNotSubmitted = Boolean(input.latestPreflight) && !launchSubmitted;

  const steps: ClawPumpStateStep[] = [
    { state: "not_configured", reached: !configured, visible: true },
    { state: "connected", reached: connected, visible: true },
    { state: "agent_linked", reached: agentLinked, visible: true },
    { state: "stock_pair_discovered", reached: stockPair, visible: true },
    { state: "preflight_successful", reached: preflightOk, visible: true },
    { state: "preflight_rejected", reached: preflightRejected, visible: true },
    { state: "launch_not_submitted", reached: launchNotSubmitted, visible: true },
    { state: "launch_submitted", reached: launchSubmitted, visible: launchSubmitted },
    {
      state: "launch_verified_onchain",
      reached: launchVerified,
      visible: launchVerified,
    },
  ];

  let current: ClawPumpSectionState = "not_configured";
  if (launchVerified) current = "launch_verified_onchain";
  else if (launchSubmitted) current = "launch_submitted";
  else if (preflightOk) current = "launch_not_submitted";
  else if (preflightRejected) current = "preflight_rejected";
  else if (agentLinked && stockPair) current = "stock_pair_discovered";
  else if (agentLinked) current = "agent_linked";
  else if (stockPair) current = "stock_pair_discovered";
  else if (connected) current = "connected";
  else if (configured) current = "not_configured";

  return {
    current,
    connection: !configured
      ? "not_configured"
      : connected
        ? "connected"
        : "configured_unverified",
    steps,
  };
}

export const CLAWPUMP_STATE_LABELS: Record<ClawPumpSectionState, string> = {
  not_configured: "Provider not configured",
  connected: "Provider connected",
  agent_linked: "Agent linked",
  stock_pair_discovered: "Stock pair discovered",
  preflight_successful: "Preflight successful",
  preflight_rejected: "Preflight rejected",
  launch_not_submitted: "Launch not submitted",
  launch_submitted: "Launch submitted",
  launch_verified_onchain: "Launch verified onchain",
};
