import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";
import {
  classifyMeteoraProtocolEvidence,
  METEORA_RECONCILABLE_CONFIG_STATUSES,
  METEORA_RECONCILABLE_POOL_STATUSES,
  type MeteoraConfirmationLabel,
  type MeteoraProtocolEvidence,
} from "../integrations/meteora/submit-lifecycle";
import type { SolanaRpcClient } from "../integrations/solana/rpc";
import { SolanaRpcError } from "../integrations/solana/rpc";

type NavisDatabase = NodePgDatabase<typeof schema>;

export type MeteoraReconciliationDeps = Readonly<{
  rpc: Pick<SolanaRpcClient, "getSignatureStatus" | "getTransactionEvidence">;
  /** Decoded DBC config account, or null when it does not exist. */
  readConfig: (address: string) => Promise<{ quoteMint: string } | null>;
  /** Decoded DBC virtual pool account, or null when it does not exist. */
  readPool: (address: string) => Promise<{ baseMint: string; config: string } | null>;
}>;

export type MeteoraLaunchPhase = "config" | "pool";

const METEORA_TERMINAL_LAUNCH_STATUSES: readonly string[] = [
  "confirmed",
  "failed",
  "broadcast_failed",
  "pool_confirmed",
  "pool_failed",
  "pool_broadcast_failed",
];

function isConfirmationLabel(value: string): value is MeteoraConfirmationLabel {
  return (
    value === "signature_confirmed" ||
    value === "protocol_verified" ||
    value === "evidence_incomplete"
  );
}

export type MeteoraSignatureEvidence = Readonly<{
  transactionSignature: string;
  confirmationStatus: string;
  slot: number;
  feeLamports: number;
  confirmedAt: string;
}>;

export type MeteoraConfirmationRecord = Readonly<{
  phase: MeteoraLaunchPhase;
  state: string;
  label: MeteoraConfirmationLabel | null;
  checkedAt: string;
  signature: MeteoraSignatureEvidence | null;
  protocol: MeteoraProtocolEvidence | null;
  detail?: Record<string, unknown>;
}>;

export type MeteoraReconciliationResult = Readonly<{
  launch: typeof schema.marketLaunches.$inferSelect;
  confirmation: MeteoraConfirmationRecord;
  /** HTTP status a route should return: 200 settled, 202 still pending. */
  httpStatus: 200 | 202;
}>;

export class MeteoraReconciliationError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "MeteoraReconciliationError";
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function detectMeteoraLaunchPhase(
  launch: Pick<typeof schema.marketLaunches.$inferSelect, "status" | "metadata">,
): MeteoraLaunchPhase | null {
  if (
    (METEORA_RECONCILABLE_POOL_STATUSES as readonly string[]).includes(launch.status)
  ) {
    return "pool";
  }
  if (
    (METEORA_RECONCILABLE_CONFIG_STATUSES as readonly string[]).includes(
      launch.status,
    ) &&
    record(launch.metadata).pool === undefined
  ) {
    return "config";
  }
  return null;
}

function statusFor(
  phase: MeteoraLaunchPhase,
  kind: "pending" | "failed" | "signature_confirmed" | "verified",
) {
  const base =
    kind === "pending"
      ? "unknown_pending"
      : kind === "failed"
        ? "failed"
        : kind === "signature_confirmed"
          ? "signature_confirmed"
          : "confirmed";
  return phase === "pool" ? `pool_${base}` : base;
}

/**
 * Check a Meteora launch signature on the active cluster and move the launch
 * (and its intent) to a settled or pending state with evidence. Safe to call
 * after a timeout or restart: it only touches launches in a reconcilable
 * status and uses an optimistic status guard on the write.
 */
export async function reconcileMeteoraLaunch(
  launchId: string,
  deps: MeteoraReconciliationDeps,
  database: NavisDatabase,
  options: { cluster: "devnet" | "mainnet-beta" },
): Promise<MeteoraReconciliationResult> {
  const [launch] = await database
    .select()
    .from(schema.marketLaunches)
    .where(eq(schema.marketLaunches.id, launchId))
    .limit(1);
  if (!launch || launch.provider !== "meteora") {
    throw new MeteoraReconciliationError("Meteora launch was not found.", 404);
  }
  if (launch.cluster !== options.cluster) {
    throw new MeteoraReconciliationError(
      "Meteora launch cluster does not match the active cluster.",
      409,
    );
  }
  const phase = detectMeteoraLaunchPhase(launch);
  if (!phase && METEORA_TERMINAL_LAUNCH_STATUSES.includes(launch.status)) {
    // Settled launches are idempotent: return the stored evidence, no RPC call.
    const stored = summarizeMeteoraLaunchEvidence(launch.status, launch.metadata);
    return {
      launch,
      confirmation: {
        phase: launch.status.startsWith("pool_") ? "pool" : "config",
        state: stored?.state ?? launch.status,
        label: stored && isConfirmationLabel(stored.label) ? stored.label : null,
        checkedAt: stored?.checkedAt ?? new Date().toISOString(),
        signature: null,
        protocol: null,
        detail: { settled: true },
      },
      httpStatus: 200,
    };
  }
  if (!phase) {
    throw new MeteoraReconciliationError(
      "This launch is not in a state that can be reconciled (submitting, submitted, unknown_pending or signature_confirmed).",
      409,
    );
  }
  const metadata = record(launch.metadata);
  const poolMeta = record(metadata.pool);
  const signatureValue =
    phase === "pool"
      ? (asString(poolMeta.transactionSignature) ?? launch.transactionSignature)
      : launch.transactionSignature;
  if (!signatureValue) {
    throw new MeteoraReconciliationError(
      "Launch has no recorded transaction signature to reconcile.",
      409,
    );
  }
  const intentId =
    phase === "pool" ? asString(poolMeta.intentId) : asString(metadata.intentId);
  const recordedSignature: string = signatureValue;
  const checkedAt = new Date().toISOString();

  async function persist(
    kind: "pending" | "failed" | "signature_confirmed" | "verified",
    confirmation: MeteoraConfirmationRecord,
  ): Promise<MeteoraReconciliationResult> {
    const status = statusFor(phase!, kind);
    const nextMetadata =
      phase === "pool"
        ? { ...metadata, pool: { ...poolMeta, status, confirmation } }
        : { ...metadata, confirmation };
    return database.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(schema.marketLaunches)
        .set({ status, metadata: nextMetadata, updatedAt: new Date() })
        .where(
          and(
            eq(schema.marketLaunches.id, launch.id),
            eq(schema.marketLaunches.status, launch.status),
          ),
        )
        .returning();
      if (!updated) {
        throw new MeteoraReconciliationError(
          "Meteora launch state changed during reconciliation; retry safely.",
          409,
        );
      }
      if (intentId) {
        // Only the intent that produced this exact signature, and only from a
        // post-submit state, may follow the launch. A stale or foreign id is
        // ignored rather than mutated.
        await transaction
          .update(schema.executionIntents)
          .set({
            status:
              kind === "pending"
                ? "unknown_pending"
                : kind === "failed"
                  ? "failed"
                  : "confirmed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.executionIntents.id, intentId),
              eq(
                schema.executionIntents.kind,
                phase === "pool" ? "meteora.pool" : "meteora.config",
              ),
              eq(schema.executionIntents.transactionSignature, recordedSignature),
              inArray(schema.executionIntents.status, [
                "submitting",
                "submitted",
                "unknown_pending",
                "confirmed",
              ]),
            ),
          );
      }
      return {
        launch: updated,
        confirmation,
        httpStatus: kind === "pending" ? 202 : 200,
      };
    });
  }

  const base = { phase, checkedAt, signature: null, protocol: null } as const;

  try {
    const signature = await deps.rpc.getSignatureStatus(signatureValue);
    if (!signature.status) {
      return persist("pending", {
        ...base,
        state: "signature_not_found",
        label: null,
        detail: { contextSlot: signature.contextSlot.toString() },
      });
    }
    if (signature.status.err !== null) {
      return persist("failed", {
        ...base,
        state: "onchain_error",
        label: null,
        detail: { slot: signature.status.slot },
      });
    }
    if (
      signature.status.confirmationStatus !== "confirmed" &&
      signature.status.confirmationStatus !== "finalized"
    ) {
      return persist("pending", {
        ...base,
        state: "not_yet_confirmed",
        label: null,
        detail: {
          confirmationStatus: signature.status.confirmationStatus ?? "unknown",
          slot: signature.status.slot,
        },
      });
    }
    const transaction = await deps.rpc.getTransactionEvidence(signatureValue);
    if (!transaction?.meta || transaction.blockTime === null) {
      return persist("pending", {
        ...base,
        state: "confirmed_transaction_evidence_unavailable",
        label: null,
      });
    }
    if (transaction.meta.err !== null) {
      return persist("failed", {
        ...base,
        state: "confirmed_transaction_error",
        label: null,
        detail: { slot: transaction.slot },
      });
    }
    if (
      transaction.slot !== signature.status.slot ||
      BigInt(signature.status.slot) > signature.contextSlot
    ) {
      return persist("pending", {
        ...base,
        state: "inconsistent_chain_evidence",
        label: null,
        detail: {
          signatureSlot: signature.status.slot,
          transactionSlot: transaction.slot,
          contextSlot: signature.contextSlot.toString(),
        },
      });
    }
    const confirmedAtDate = new Date(transaction.blockTime * 1_000);
    if (!Number.isFinite(confirmedAtDate.getTime())) {
      return persist("pending", {
        ...base,
        state: "invalid_block_time_evidence",
        label: null,
      });
    }
    const signatureEvidence: MeteoraSignatureEvidence = {
      transactionSignature: signatureValue,
      confirmationStatus: signature.status.confirmationStatus,
      slot: transaction.slot,
      feeLamports: transaction.meta.fee,
      confirmedAt: confirmedAtDate.toISOString(),
    };

    // Signature is confirmed. Now prove the protocol result, not just the
    // transaction: fetch the account the intent promised and compare fields.
    let protocol: MeteoraProtocolEvidence;
    if (phase === "config") {
      const configAddress = asString(metadata.config);
      const actual = configAddress ? await deps.readConfig(configAddress) : null;
      protocol = classifyMeteoraProtocolEvidence({
        address: configAddress,
        expected: { quoteMint: launch.quoteMint },
        actual,
      });
    } else {
      const poolAddress = launch.poolAddress;
      const actual = poolAddress ? await deps.readPool(poolAddress) : null;
      protocol = classifyMeteoraProtocolEvidence({
        address: poolAddress,
        expected: {
          baseMint: launch.baseMint,
          config: asString(metadata.config),
        },
        actual,
      });
    }
    const kind =
      protocol.label === "protocol_verified" ? "verified" : "signature_confirmed";
    return persist(kind, {
      ...base,
      state: protocol.label,
      label: protocol.label,
      signature: signatureEvidence,
      protocol,
    });
  } catch (error) {
    if (error instanceof SolanaRpcError) {
      return persist("pending", {
        ...base,
        state: "rpc_unavailable",
        label: null,
        detail: { code: error.code, safeError: error.message },
      });
    }
    throw error;
  }
}

export type MeteoraLaunchEvidenceSummary = Readonly<{
  label: MeteoraConfirmationLabel | string;
  state: string;
  checkedAt: string | null;
  slot: number | null;
  feeLamports: number | null;
  confirmedAt: string | null;
  account: string | null;
  checks: readonly {
    field: string;
    expected: string | null;
    actual: string | null;
    ok: boolean;
  }[];
}>;

/**
 * Read the confirmation record the reconciler stored on a launch. Pool-phase
 * launches keep it under metadata.pool so the config evidence is never
 * overwritten by the pool step.
 */
export function summarizeMeteoraLaunchEvidence(
  status: string,
  metadata: unknown,
): MeteoraLaunchEvidenceSummary | null {
  const root = record(metadata);
  const source = status.startsWith("pool_") ? record(root.pool) : root;
  const confirmation = record(source.confirmation);
  if (Object.keys(confirmation).length === 0) return null;
  const signature = record(confirmation.signature);
  const protocol = record(confirmation.protocol);
  const checks = Array.isArray(protocol.checks)
    ? protocol.checks
        .map((check) => record(check))
        .map((check) => ({
          field: String(check.field ?? ""),
          expected: asString(check.expected),
          actual: asString(check.actual),
          ok: check.ok === true,
        }))
    : [];
  const state = asString(confirmation.state) ?? "unknown";
  return {
    label: asString(confirmation.label) ?? state,
    state,
    checkedAt: asString(confirmation.checkedAt),
    slot: typeof signature.slot === "number" ? signature.slot : null,
    feeLamports:
      typeof signature.feeLamports === "number" ? signature.feeLamports : null,
    confirmedAt: asString(signature.confirmedAt),
    account: asString(protocol.address),
    checks,
  };
}
