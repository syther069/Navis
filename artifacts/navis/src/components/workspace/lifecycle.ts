/**
 * Truthful lifecycle mapping for a decision.
 *
 * Seven distinct stages: PROPOSED, APPROVED, SIGNING, SUBMITTED, CONFIRMED,
 * FAILED, BLOCKED. They are derived only from recorded facts:
 *
 * - `approved` is the deterministic POLICY verdict. It is never wallet approval.
 * - `executionState` is the recorded execution attempt state.
 * - `signature` is a transaction signature, when one exists.
 *
 * A simulated attempt never advances past APPROVED: simulation is not
 * signing, not submission and not confirmation.
 */

export type LifecycleStage =
  | "PROPOSED"
  | "APPROVED"
  | "SIGNING"
  | "SUBMITTED"
  | "CONFIRMED"
  | "FAILED"
  | "BLOCKED";

export type LifecycleTone = "neutral" | "info" | "pending" | "success" | "danger";

export type StepState =
  | "complete"
  | "current"
  | "waiting"
  | "not-requested"
  | "blocked"
  | "failed"
  | "unrecorded";

export type LifecycleStep = Readonly<{
  key: "proposed" | "policy" | "signing" | "submitted" | "confirmed";
  label: string;
  actor: string;
  state: StepState;
  note: string;
}>;

export type Lifecycle = Readonly<{
  stage: LifecycleStage;
  tone: LifecycleTone;
  /** Short qualifier shown beside the stage, e.g. "Policy only". */
  qualifier: string | null;
  simulated: boolean;
  /** One plain sentence describing where the decision actually is. */
  summary: string;
  steps: readonly LifecycleStep[];
}>;

export type LifecycleInput = Readonly<{
  approved: boolean | null;
  executionState: string | null;
  signature?: string | null;
  mode?: string | null;
  /**
   * "record": the caller has the full receipt, so a missing signature means
   * none was recorded. "summary": the caller only has a list row, which never
   * carries the signature, so the recorded state is shown without asserting
   * or denying signature evidence.
   */
  evidence?: "record" | "summary";
}>;

const stageTone: Record<LifecycleStage, LifecycleTone> = {
  PROPOSED: "neutral",
  APPROVED: "info",
  SIGNING: "pending",
  SUBMITTED: "pending",
  CONFIRMED: "success",
  FAILED: "danger",
  BLOCKED: "danger",
};

export function deriveLifecycle({
  approved,
  executionState,
  signature = null,
  mode = null,
  evidence = "record",
}: LifecycleInput): Lifecycle {
  const state = executionState ?? null;
  const summaryOnly = evidence === "summary";
  const hasSignature = Boolean(signature);
  const simulated =
    state === "simulated" || (mode === "demo" && state !== "rejected" && approved !== false);

  let stage: LifecycleStage;
  if (approved === false) stage = "BLOCKED";
  else if (state === "rejected") stage = "BLOCKED";
  else if (state === "failed" || state === "cancelled") stage = "FAILED";
  // Confirmation needs a recorded signature. A list row cannot carry one, so
  // it reports the recorded state and qualifies it instead.
  else if (state === "confirmed" && (hasSignature || summaryOnly)) stage = "CONFIRMED";
  else if (state === "confirmed") stage = "SUBMITTED";
  else if (state === "submitted" || state === "unknown_pending") stage = "SUBMITTED";
  else if (state === "awaiting_signature") stage = "SIGNING";
  else if (approved === true) stage = "APPROVED";
  else stage = "PROPOSED";

  const policyBlocked = approved === false;
  const closedBeforeSigning = !policyBlocked && state === "rejected";
  const confirmedWithoutSignature = state === "confirmed" && !hasSignature && !summaryOnly;
  const pastSigning = stage === "SUBMITTED" || stage === "CONFIRMED";

  const signingState: StepState = policyBlocked
    ? "waiting"
    : closedBeforeSigning
      ? "blocked"
      : hasSignature
        ? "complete"
        : pastSigning
          ? "unrecorded"
          : stage === "SIGNING"
            ? "current"
            : simulated
              ? "not-requested"
              : stage === "FAILED"
                ? "unrecorded"
                : "waiting";

  const signingNote = policyBlocked
    ? "Not reached."
    : closedBeforeSigning
      ? "Closed before any wallet signed."
      : hasSignature
        ? "A transaction signature is recorded."
        : pastSigning || stage === "FAILED"
          ? summaryOnly
            ? "Signature evidence is in the full record."
            : "No transaction signature is recorded."
          : stage === "SIGNING"
            ? "Waiting for your wallet."
            : simulated
              ? "Simulation only. No wallet was asked to sign."
              : "No signature requested yet.";

  const steps: LifecycleStep[] = [
    {
      key: "proposed",
      label: "Proposed",
      actor: "Atlas",
      state: "complete",
      note: "Proposal recorded with its inputs.",
    },
    {
      key: "policy",
      label: "Policy",
      actor: "Navis policy",
      state: policyBlocked ? "blocked" : approved === true ? "complete" : "current",
      note: policyBlocked
        ? "Rejected by a failed check. Nothing executes."
        : approved === true
          ? "Approved by deterministic checks. Not a wallet approval."
          : "Awaiting policy evaluation.",
    },
    { key: "signing", label: "Wallet signature", actor: "You", state: signingState, note: signingNote },
    {
      key: "submitted",
      label: "Submitted",
      actor: "Solana",
      state:
        stage === "SUBMITTED"
          ? "current"
          : stage === "CONFIRMED" || (stage === "FAILED" && hasSignature)
            ? "complete"
            : simulated
              ? "not-requested"
              : "waiting",
      note:
        stage === "SUBMITTED"
          ? confirmedWithoutSignature
            ? "Recorded as confirmed, but without a signature it is not proven."
            : "Recorded as sent. Settlement not proven."
          : stage === "CONFIRMED" || (stage === "FAILED" && hasSignature)
            ? "Recorded as sent."
            : simulated
              ? "No transaction was built or sent."
              : "Not reached.",
    },
    {
      key: "confirmed",
      label: "Confirmed",
      actor: "Solana",
      state:
        stage === "CONFIRMED"
          ? "complete"
          : stage === "FAILED"
            ? "failed"
            : simulated
              ? "not-requested"
              : "waiting",
      note:
        stage === "CONFIRMED"
          ? summaryOnly && !hasSignature
            ? "Recorded as confirmed. Open the record for its evidence."
            : "Recorded as confirmed with a transaction signature."
          : stage === "FAILED"
            ? "The attempt failed. No settlement."
            : simulated
              ? "No onchain settlement for a simulation."
              : "Not reached.",
    },
  ];

  const qualifier =
    stage === "APPROVED"
      ? simulated
        ? "Policy only · simulated"
        : "Policy only"
      : stage === "BLOCKED"
        ? policyBlocked
          ? "By policy"
          : "Before signing"
        : stage === "SUBMITTED"
          ? confirmedWithoutSignature
            ? "Confirmation unproven"
            : "Unconfirmed"
          : stage === "CONFIRMED" && summaryOnly && !hasSignature
            ? "Recorded state"
            : null;

  const summary =
    stage === "BLOCKED"
      ? policyBlocked
        ? "Policy rejected this proposal. Nothing was signed or sent."
        : "The attempt was closed before any wallet signed. Nothing was sent."
      : stage === "FAILED"
        ? "The execution attempt failed. There is no onchain settlement."
        : stage === "CONFIRMED"
          ? hasSignature
            ? "The attempt is recorded as confirmed with a transaction signature."
            : "The attempt is recorded as confirmed. The signature and settlement evidence are in the full record."
          : stage === "SUBMITTED"
            ? confirmedWithoutSignature
              ? "The attempt is recorded as confirmed, but no transaction signature is recorded, so settlement is not proven."
              : hasSignature
                ? "A signed transaction is recorded as sent. Confirmation is not proven."
                : summaryOnly
                  ? "The attempt is recorded as sent. Confirmation is not proven."
                  : "The attempt is recorded as sent, but no transaction signature is recorded. Confirmation is not proven."
            : stage === "SIGNING"
              ? "Policy approved. Waiting for the wallet to sign."
              : stage === "APPROVED"
                ? simulated
                  ? "Policy approved. A simulation was recorded; no wallet was asked to sign and nothing was sent."
                  : "Policy approved. No wallet signature has been requested."
                : "Proposal recorded. Policy has not evaluated it yet.";

  return { stage, tone: stageTone[stage], qualifier, simulated, summary, steps };
}

export type WalletApproval = Readonly<{
  state: "pass" | "pending" | "idle" | "block";
  label: string;
  detail: string;
}>;

/** Wallet approval as the record proves it. Never inferred from policy. */
export function walletApprovalFor(lifecycle: Lifecycle, signature: string | null | undefined): WalletApproval {
  if (signature) {
    return {
      state: "pass",
      label: "Signature recorded",
      detail: "A transaction signature is recorded for this attempt.",
    };
  }
  switch (lifecycle.stage) {
    case "BLOCKED":
      return { state: "block", label: "Not reached", detail: "Nothing reached a wallet." };
    case "SIGNING":
      return { state: "pending", label: "Awaiting wallet", detail: "Waiting for the wallet to sign." };
    case "SUBMITTED":
    case "CONFIRMED":
    case "FAILED":
      return {
        state: "idle",
        label: "No signature recorded",
        detail: "The record does not include a transaction signature.",
      };
    default:
      return lifecycle.simulated
        ? {
            state: "idle",
            label: "Not requested",
            detail: "Simulation only. No wallet was asked to sign.",
          }
        : { state: "idle", label: "Not requested", detail: "No wallet signature has been requested." };
  }
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

export function relativeTime(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatTimestamp(value);
}

export function shortHash(value: string | null | undefined, head = 8, tail = 6) {
  if (!value) return "Not recorded";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function bpsToPercent(value: string | number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `${(numeric / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

export function usdFromMicros(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const numeric = Number(value) / 1_000_000;
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric < 10 ? 4 : 2,
  });
}
