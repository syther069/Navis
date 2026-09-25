import {
  ArrowSquareOut,
  Database,
  ListChecks,
} from "@phosphor-icons/react/dist/ssr";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, RouteHeader } from "@/components/route-primitives";
import {
  TransactionsView,
  type FormattedTransaction,
  type TransactionLifecycleStage,
} from "@/components/transactions/transactions-view";
import { getDatabase } from "@/lib/db/client";
import {
  agents,
  decisions,
  executionAttempts,
  marketLaunches,
  users,
} from "@/lib/db/schema";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Read-only audit trail and 9-stage execution ledger for all financial operations.",
};

export const dynamic = "force-dynamic";

async function loadExecutionRows() {
  if (!env.databaseUrl) return [];

  return getDatabase()
    .select({
      id: executionAttempts.id,
      state: executionAttempts.state,
      active: executionAttempts.active,
      cluster: executionAttempts.cluster,
      transactionSignature: executionAttempts.transactionSignature,
      submittedAt: executionAttempts.submittedAt,
      confirmedAt: executionAttempts.confirmedAt,
      slot: executionAttempts.slot,
      feeLamports: executionAttempts.feeLamports,
      errorCode: executionAttempts.errorCode,
      safeError: executionAttempts.safeError,
      createdAt: executionAttempts.createdAt,
      decisionHash: decisions.decisionHash,
      proposal: decisions.proposal,
      agentName: agents.name,
      agentMode: agents.mode,
      ownerWallet: users.wallet,
    })
    .from(executionAttempts)
    .innerJoin(decisions, eq(decisions.id, executionAttempts.decisionId))
    .innerJoin(agents, eq(agents.id, decisions.agentId))
    .leftJoin(users, eq(users.id, agents.ownerId))
    .orderBy(desc(executionAttempts.createdAt))
    .limit(50);
}

async function loadLaunchRows() {
  if (!env.databaseUrl) return [];

  return getDatabase()
    .select({
      id: marketLaunches.id,
      provider: marketLaunches.provider,
      status: marketLaunches.status,
      cluster: marketLaunches.cluster,
      providerRequestId: marketLaunches.providerRequestId,
      baseMint: marketLaunches.baseMint,
      poolAddress: marketLaunches.poolAddress,
      transactionSignature: marketLaunches.transactionSignature,
      metadata: marketLaunches.metadata,
      createdAt: marketLaunches.createdAt,
      updatedAt: marketLaunches.updatedAt,
      agentName: agents.name,
      agentSlug: agents.slug,
    })
    .from(marketLaunches)
    .innerJoin(agents, eq(agents.id, marketLaunches.agentId))
    .orderBy(desc(marketLaunches.createdAt))
    .limit(50);
}

function formatDate(value: Date | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

function explorerUrl(signature: string, cluster: "devnet" | "mainnet-beta" | string) {
  const clusterQuery = cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/tx/${signature}${clusterQuery}`;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ state?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const activeFilter = params.state || "all";
  const persistenceReady = Boolean(env.databaseUrl);

  const [executions, launches] = await Promise.all([
    loadExecutionRows(),
    loadLaunchRows(),
  ]);

  // Format executions into the 9 distinct lifecycle stages
  const formattedExecutions: FormattedTransaction[] = executions.map((row) => {
    let stage: TransactionLifecycleStage = "Preparing";
    if (row.state === "created") stage = "Preparing";
    else if (row.state === "simulated") stage = "Simulation";
    else if (row.state === "awaiting_signature") stage = "Awaiting Wallet";
    else if (row.state === "submitted") stage = "Submitted";
    else if (row.state === "unknown_pending") stage = "Confirming";
    else if (row.state === "confirmed") stage = "Confirmed";
    else if (row.state === "failed" || row.state === "cancelled") stage = "Failed";
    else if (row.state === "rejected") stage = "Blocked";

    const actionName = String(row.proposal?.action || "TRADE").replaceAll("_", " ");
    const inputMint = row.proposal && "inputMint" in row.proposal ? (row.proposal.inputMint as string) : null;
    const outputMint = row.proposal && "outputMint" in row.proposal ? (row.proposal.outputMint as string) : null;
    const inputAsset = inputMint ? inputMint.slice(0, 4) + "…" + inputMint.slice(-4) : null;
    const outputAsset = outputMint ? outputMint.slice(0, 4) + "…" + outputMint.slice(-4) : null;
    const assetStr =
      inputAsset && outputAsset
        ? `${inputAsset} → ${outputAsset}`
        : inputAsset || outputAsset;

    let feeStr: string | null = null;
    if (row.feeLamports && Number(row.feeLamports) > 0) {
      const sol = Number(row.feeLamports) / 1_000_000_000;
      feeStr = `${sol.toFixed(6)} SOL`;
    }

    const hasSig = Boolean(row.transactionSignature) && row.state !== "simulated";

    return {
      id: row.id,
      kind: "execution",
      stage,
      rawState: row.state,
      title: actionName,
      action: actionName,
      asset: assetStr,
      amount: row.proposal && "inputAmount" in row.proposal && (row.proposal.inputAmount as any)?.uiAmount
        ? `${(row.proposal.inputAmount as any).uiAmount} units`
        : null,
      network: row.cluster,
      wallet: row.ownerWallet ?? null,
      fees: feeStr,
      signature: hasSig ? row.transactionSignature : null,
      explorerUrl:
        hasSig && row.transactionSignature
          ? explorerUrl(row.transactionSignature, row.cluster)
          : null,
      slot: row.slot ? row.slot.toString() : null,
      timestamp: formatDate(row.createdAt),
      decisionHash: row.decisionHash,
      errorCode: row.errorCode,
      safeError: row.safeError,
      agentName: row.agentName,
    };
  });

  // Format launches into the 9 distinct lifecycle stages
  const formattedLaunches: FormattedTransaction[] = launches.map((row) => {
    let stage: TransactionLifecycleStage = "Preparing";
    const st = row.status.toLowerCase();
    if (st.includes("confirm")) stage = "Confirmed";
    else if (st.includes("submitting") || st.includes("submitted")) stage = "Submitted";
    else if (st.includes("pending") || st.includes("verifying")) stage = "Confirming";
    else if (st.includes("failed") || st.includes("error")) stage = "Failed";
    else if (st.includes("reject") || st.includes("block")) stage = "Blocked";
    else if (st.includes("simulat")) stage = "Simulation";
    else if (st.includes("wallet") || st.includes("await")) stage = "Awaiting Wallet";

    const hasSig = Boolean(row.transactionSignature);

    return {
      id: row.id,
      kind: "launch",
      stage,
      rawState: row.status,
      title: `${row.provider} Liquidity Launch`,
      action: `${row.provider} Launch`,
      asset: row.baseMint
        ? row.baseMint.slice(0, 4) + "…" + row.baseMint.slice(-4)
        : "Liquidity Pair",
      amount: null,
      network: row.cluster,
      wallet: null,
      fees: null,
      signature: hasSig ? row.transactionSignature : null,
      explorerUrl:
        hasSig && row.transactionSignature
          ? explorerUrl(row.transactionSignature, row.cluster)
          : null,
      slot: null,
      timestamp: formatDate(row.createdAt),
      decisionHash: null,
      errorCode: null,
      safeError: null,
      provider: row.provider,
      agentName: row.agentName,
    };
  });

  const allTransactions = [...formattedExecutions, ...formattedLaunches].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );

  return (
    <>
      <RouteHeader
        eyebrow="Execution ledger"
        title="Transactions"
        description="A read-only audit trail and 9-stage lifecycle ledger for all agent execution attempts and sponsor market launches."
        meta={persistenceReady ? `${allTransactions.length} persistent records` : "Persistence unavailable"}
      />

      {!persistenceReady ? (
        <EmptyState
          icon={Database}
          label="Database required"
          title="No transaction ledger is available in this instance."
          description="Set DATABASE_URL to enable persistent execution attempts, launch records, statuses, signatures, and failure evidence."
          action={{ label: "Open capabilities", href: "/settings" }}
        />
      ) : (
        <TransactionsView transactions={allTransactions} activeFilter={activeFilter} />
      )}
    </>
  );
}
