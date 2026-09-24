import type { Transaction } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Durable submit lifecycle for Meteora execution intents.
 *
 * Order of operations is fixed: derive the signature from the signed
 * transaction, persist "submitting" with that signature on the intent and the
 * launch, and only then broadcast. A failure after the send call can never
 * lose the signature, and a repeated submit for the same intent replays the
 * stored record instead of sending twice.
 */

/** Intent statuses for which a repeated submit returns the existing record. */
export const METEORA_REPLAYABLE_INTENT_STATUSES = [
  "submitting",
  "submitted",
  "unknown_pending",
  "confirmed",
  "consumed",
] as const;

export function isMeteoraIntentReplayable(status: string) {
  return (METEORA_REPLAYABLE_INTENT_STATUSES as readonly string[]).includes(status);
}

/** Launch statuses the confirm route may reconcile, per phase. */
export const METEORA_RECONCILABLE_CONFIG_STATUSES = [
  "submitting",
  "submitted",
  "unknown_pending",
  "signature_confirmed",
] as const;

export const METEORA_RECONCILABLE_POOL_STATUSES = [
  "pool_submitting",
  "pool_submitted",
  "pool_unknown_pending",
  "pool_signature_confirmed",
] as const;

/**
 * The first signature of a fully signed legacy transaction is its onchain
 * transaction signature. It is known before broadcast, which is what lets the
 * record be written first.
 */
export function deriveTransactionSignature(transaction: Transaction): string {
  const primary = transaction.signature;
  if (!primary || primary.length !== 64 || primary.every((byte) => byte === 0)) {
    throw new Error("Signed transaction has no fee-payer signature to record.");
  }
  return bs58.encode(primary);
}

export type MeteoraSendOutcome = Readonly<{
  /**
   * rejected_before_broadcast: the RPC refused the transaction in preflight or
   * on decode, so nothing reached the network and the record may be failed.
   * unknown_after_send: the send may have reached the network; the record must
   * stay pending until the signature is reconciled.
   */
  kind: "rejected_before_broadcast" | "unknown_after_send";
  reason: string;
}>;

const PREFLIGHT_REJECTION_PATTERNS = [
  /simulation failed/i,
  /preflight/i,
  /signature verification failed/i,
  /invalid transaction/i,
  /transaction too large/i,
  /failed to deserialize/i,
  /blockhash not found/i,
  /block height exceeded/i,
];

const ALREADY_BROADCAST_PATTERNS = [
  /already been processed/i,
  /already processed/i,
  /timed? ?out/i,
];

/**
 * Classify a sendRawTransaction failure. Anything that is not clearly a
 * pre-broadcast rejection is treated as unknown, because a socket error or
 * timeout can arrive after the leader already received the transaction.
 */
export function classifyMeteoraSendError(error: unknown): MeteoraSendOutcome {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "unknown send error";
  const compact = message.slice(0, 300);
  if (ALREADY_BROADCAST_PATTERNS.some((pattern) => pattern.test(message))) {
    return { kind: "unknown_after_send", reason: compact };
  }
  if (PREFLIGHT_REJECTION_PATTERNS.some((pattern) => pattern.test(message))) {
    return { kind: "rejected_before_broadcast", reason: compact };
  }
  return { kind: "unknown_after_send", reason: compact };
}

export type MeteoraConfirmationLabel =
  "signature_confirmed" | "protocol_verified" | "evidence_incomplete";

export type MeteoraProtocolCheck = Readonly<{
  field: string;
  expected: string | null;
  actual: string | null;
  ok: boolean;
}>;

export type MeteoraProtocolEvidence = Readonly<{
  label: MeteoraConfirmationLabel;
  reason:
    | "account_verified"
    | "account_missing"
    | "account_mismatch"
    | "expected_accounts_missing";
  address: string | null;
  checks: readonly MeteoraProtocolCheck[];
}>;

type AccountFields = Readonly<Record<string, string | null | undefined>>;

/**
 * Compare a decoded Meteora account with the accounts the intent promised.
 * A confirmed signature alone is only "signature_confirmed"; the launch is
 * "protocol_verified" when the expected account exists with matching fields.
 */
export function classifyMeteoraProtocolEvidence(input: {
  address: string | null | undefined;
  expected: AccountFields;
  actual: AccountFields | null;
}): MeteoraProtocolEvidence {
  const entries = Object.entries(input.expected);
  const fields = entries.filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1] !== "",
  );
  // Every expected field must be present. Dropping a missing one would let a
  // partial record verify against fewer checks than the phase requires.
  if (!input.address || fields.length === 0 || fields.length !== entries.length) {
    return {
      label: "evidence_incomplete",
      reason: "expected_accounts_missing",
      address: input.address ?? null,
      checks: [],
    };
  }
  if (!input.actual) {
    return {
      label: "signature_confirmed",
      reason: "account_missing",
      address: input.address,
      checks: fields.map(([field, expected]) => ({
        field,
        expected,
        actual: null,
        ok: false,
      })),
    };
  }
  const checks = fields.map(([field, expected]) => {
    const actual = input.actual?.[field] ?? null;
    return { field, expected, actual, ok: actual === expected };
  });
  const allOk = checks.every((check) => check.ok);
  return {
    label: allOk ? "protocol_verified" : "evidence_incomplete",
    reason: allOk ? "account_verified" : "account_mismatch",
    address: input.address,
    checks,
  };
}
