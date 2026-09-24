import type { TransactionState } from "@/components/shared/transaction-state";
import type { executionAttempts, marketLaunches } from "@/lib/db/schema";

type ExecutionStatus = typeof executionAttempts.$inferSelect.state;
type LaunchStatus = typeof marketLaunches.$inferSelect.status;

/** An unmapped status stays visible as recorded; it is not promoted to progress. */
export function transactionStateForRecord(
  kind: "execution" | "launch",
  status: ExecutionStatus | LaunchStatus,
): TransactionState | null {
  if (kind === "execution") {
    switch (status) {
      case "created":
        return "preparing";
      case "simulated":
        return "simulation";
      case "awaiting_signature":
        return "awaiting_wallet";
      case "submitted":
        return "submitted";
      // Broadcast outcome unknown: no evidence the network saw it.
      case "unknown_pending":
        return null;
      case "confirmed":
        return "confirmed";
      case "failed":
        return "failed";
      case "rejected":
      case "cancelled":
        return "blocked";
      default:
        return null;
    }
  }
  switch (status) {
    case "preparing":
    case "prepared":
    case "pool_preparing":
    case "pool_prepared":
      return "preparing";
    case "simulating":
    case "simulated":
    case "pool_simulating":
    case "pool_simulated":
      return "simulation";
    case "awaiting_signature":
    case "pool_awaiting_signature":
      return "awaiting_wallet";
    case "signing":
    case "pool_signing":
      return "signing";
    // Submitting is pre-broadcast: a signature may be persisted before send.
    case "submitting":
    case "pool_submitting":
      return "signing";
    case "submitted":
    case "pool_submitted":
      return "submitted";
    // Broadcast outcome unknown: no evidence the network saw it.
    case "unknown_pending":
    case "pool_unknown_pending":
      return null;
    case "signature_confirmed":
    case "pool_signature_confirmed":
      return "confirming";
    case "confirmed":
    case "pool_confirmed":
      return "confirmed";
    case "failed":
    case "pool_failed":
      return "failed";
    case "rejected":
    case "blocked":
    case "pool_rejected":
    case "pool_blocked":
      return "blocked";
    default:
      return null;
  }
}
