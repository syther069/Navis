/**
 * Assurance model shared by proof receipts and the transaction ledger.
 *
 * Every evidence record is summarised on two independent axes:
 *
 * - `level`: how far the evidence actually reaches. Offchain integrity means the
 *   hashes verify but nothing was signed. Wallet authorization means a wallet
 *   signed and a transaction was sent, but settlement is not proven. Onchain
 *   settlement means a confirmed transaction with a signature exists.
 * - `origin`: whether the record is a labelled demo simulation or a live onchain
 *   attempt. Demo simulations never reach wallet authorization or settlement.
 *
 * The helper is pure and derives everything from recorded facts. It never
 * upgrades a record beyond what the evidence supports.
 */

export const assuranceLevels = [
  "offchain_integrity",
  "wallet_authorization",
  "onchain_settlement",
] as const;

export type AssuranceLevel = (typeof assuranceLevels)[number];

export const evidenceOrigins = ["demo_simulation", "live_onchain"] as const;

export type EvidenceOrigin = (typeof evidenceOrigins)[number];

export type Assurance = Readonly<{
  level: AssuranceLevel;
  origin: EvidenceOrigin;
  /** Short badge text for the level. */
  levelLabel: string;
  /** Short badge text for the origin. */
  originLabel: string;
  /** One-sentence plain-language explanation of what the level proves. */
  explanation: string;
}>;

const levelLabels: Readonly<Record<AssuranceLevel, string>> = {
  offchain_integrity: "Offchain integrity",
  wallet_authorization: "Wallet authorization",
  onchain_settlement: "Onchain settlement",
};

const originLabels: Readonly<Record<EvidenceOrigin, string>> = {
  demo_simulation: "Demo simulation",
  live_onchain: "Live onchain",
};

const levelExplanations: Readonly<Record<AssuranceLevel, string>> = {
  offchain_integrity:
    "Hashes and cross-references verify locally. No wallet signed anything and no transaction exists.",
  wallet_authorization:
    "A wallet signed and a transaction was sent, but confirmed settlement is not proven yet or did not happen.",
  onchain_settlement:
    "A signed transaction was confirmed onchain with a recorded signature and slot.",
};

export function describeAssurance(
  level: AssuranceLevel,
  origin: EvidenceOrigin,
): Assurance {
  return {
    level,
    origin,
    levelLabel: levelLabels[level],
    originLabel: originLabels[origin],
    explanation: levelExplanations[level],
  };
}

export type ReceiptAssuranceInput = Readonly<{
  mode: "demo" | "devnet" | "mainnet";
  execution: Readonly<{
    state: "simulated" | "confirmed" | "failed" | "rejected";
    transactionSignature: string | null;
  }>;
}>;

/** Derives the assurance summary from a proof receipt document. */
export function assuranceForReceipt(receipt: ReceiptAssuranceInput): Assurance {
  const signature = receipt.execution.transactionSignature;
  const state = receipt.execution.state;

  if (receipt.mode === "demo" || (state === "simulated" && !signature)) {
    return describeAssurance("offchain_integrity", "demo_simulation");
  }

  if (state === "confirmed" && signature) {
    return describeAssurance("onchain_settlement", "live_onchain");
  }

  if (signature) {
    return describeAssurance("wallet_authorization", "live_onchain");
  }

  return describeAssurance("offchain_integrity", "live_onchain");
}

export type ExecutionAssuranceInput = Readonly<{
  state:
    | "created"
    | "simulated"
    | "awaiting_signature"
    | "submitted"
    | "confirmed"
    | "rejected"
    | "cancelled"
    | "failed"
    | "unknown_pending";
  transactionSignature: string | null;
  /** Agent execution mode when known. Demo attempts are always simulations. */
  mode?: "demo" | "devnet" | "mainnet";
}>;

/** Derives the assurance summary from a persisted execution attempt. */
export function assuranceForExecution(attempt: ExecutionAssuranceInput): Assurance {
  const signature = attempt.transactionSignature;
  const { state } = attempt;

  if (attempt.mode === "demo" || (state === "simulated" && !signature)) {
    return describeAssurance("offchain_integrity", "demo_simulation");
  }

  if (state === "confirmed" && signature) {
    return describeAssurance("onchain_settlement", "live_onchain");
  }

  if (signature || state === "submitted" || state === "unknown_pending") {
    return describeAssurance("wallet_authorization", "live_onchain");
  }

  return describeAssurance("offchain_integrity", "live_onchain");
}
