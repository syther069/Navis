import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";
import type { SolanaRpcClient } from "../integrations/solana/rpc";
import { SolanaRpcError } from "../integrations/solana/rpc";
import { transitionExecutionAttempt } from "./execution";

type NavisDatabase = NodePgDatabase<typeof schema>;
type ReconciliationClient = Pick<
  SolanaRpcClient,
  "getSignatureStatus" | "getTransactionEvidence"
>;

type TokenBalance = Readonly<{
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}>;

export function calculateNativeBalanceDeltas(
  preBalances: readonly number[],
  postBalances: readonly number[],
) {
  const length = Math.max(preBalances.length, postBalances.length);
  return Array.from({ length }, (_, accountIndex) => ({
    accountIndex,
    deltaLamports: (
      BigInt(postBalances[accountIndex] ?? 0) - BigInt(preBalances[accountIndex] ?? 0)
    ).toString(),
  }));
}

export function calculateTokenBalanceDeltas(
  preBalances: readonly TokenBalance[],
  postBalances: readonly TokenBalance[],
) {
  const entries = new Map<
    string,
    {
      accountIndex: number;
      mint: string;
      owner?: string;
      decimals: number;
      pre: bigint;
      post: bigint;
    }
  >();

  for (const [side, balances] of [
    ["pre", preBalances],
    ["post", postBalances],
  ] as const) {
    for (const balance of balances) {
      const key = `${balance.accountIndex}:${balance.mint}:${balance.owner ?? ""}`;
      const entry = entries.get(key) ?? {
        accountIndex: balance.accountIndex,
        mint: balance.mint,
        owner: balance.owner,
        decimals: balance.uiTokenAmount.decimals,
        pre: BigInt(0),
        post: BigInt(0),
      };
      if (entry.decimals !== balance.uiTokenAmount.decimals) {
        throw new Error("RPC token balance decimals changed within one transaction.");
      }
      entry[side] = BigInt(balance.uiTokenAmount.amount);
      entries.set(key, entry);
    }
  }

  return [...entries.values()].map(({ pre, post, ...identity }) => ({
    ...identity,
    deltaRaw: (post - pre).toString(),
  }));
}

export async function reconcileExecutionAttempt(
  attemptId: string,
  client: ReconciliationClient,
  database: NavisDatabase,
) {
  const [attempt] = await database
    .select()
    .from(schema.executionAttempts)
    .where(eq(schema.executionAttempts.id, attemptId))
    .limit(1);

  if (!attempt) throw new Error("Execution attempt not found.");
  if (!["submitted", "unknown_pending"].includes(attempt.state)) {
    throw new Error("Only submitted or unknown-pending attempts can be reconciled.");
  }
  if (!attempt.transactionSignature) {
    throw new Error("Reconciliation requires a transaction signature.");
  }

  try {
    const signature = await client.getSignatureStatus(attempt.transactionSignature);
    if (!signature.status) {
      return transitionExecutionAttempt(
        attempt.id,
        "unknown_pending",
        {
          metadata: {
            reason: "signature_not_found",
            contextSlot: signature.contextSlot.toString(),
          },
        },
        database,
      );
    }

    if (signature.status.err !== null) {
      return transitionExecutionAttempt(
        attempt.id,
        "failed",
        {
          errorCode: "ONCHAIN_TRANSACTION_ERROR",
          safeError: "The Solana transaction was confirmed with an onchain error.",
          metadata: { slot: signature.status.slot },
        },
        database,
      );
    }

    if (
      signature.status.confirmationStatus !== "confirmed" &&
      signature.status.confirmationStatus !== "finalized"
    ) {
      return transitionExecutionAttempt(
        attempt.id,
        "unknown_pending",
        {
          metadata: {
            reason: "not_yet_confirmed",
            confirmationStatus: signature.status.confirmationStatus ?? "unknown",
            slot: signature.status.slot,
          },
        },
        database,
      );
    }

    const transaction = await client.getTransactionEvidence(
      attempt.transactionSignature,
    );
    if (!transaction?.meta) {
      return transitionExecutionAttempt(
        attempt.id,
        "unknown_pending",
        {
          metadata: { reason: "confirmed_transaction_evidence_unavailable" },
        },
        database,
      );
    }
    if (transaction.meta.err !== null) {
      return transitionExecutionAttempt(
        attempt.id,
        "failed",
        {
          errorCode: "ONCHAIN_TRANSACTION_ERROR",
          safeError: "The confirmed Solana transaction contains an execution error.",
          metadata: { slot: transaction.slot },
        },
        database,
      );
    }

    const confirmedAt = transaction.blockTime
      ? new Date(transaction.blockTime * 1_000).toISOString()
      : new Date().toISOString();
    return transitionExecutionAttempt(
      attempt.id,
      "confirmed",
      {
        confirmedAt,
        slot: transaction.slot,
        feeLamports: transaction.meta.fee,
        metadata: {
          confirmationStatus: signature.status.confirmationStatus,
          nativeBalanceDeltas: calculateNativeBalanceDeltas(
            transaction.meta.preBalances,
            transaction.meta.postBalances,
          ),
          tokenBalanceDeltas: calculateTokenBalanceDeltas(
            transaction.meta.preTokenBalances ?? [],
            transaction.meta.postTokenBalances ?? [],
          ),
        },
      },
      database,
    );
  } catch (error) {
    if (error instanceof SolanaRpcError) {
      return transitionExecutionAttempt(
        attempt.id,
        "unknown_pending",
        { metadata: { reason: error.code, safeError: error.message } },
        database,
      );
    }
    throw error;
  }
}
