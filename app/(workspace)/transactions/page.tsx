import { ChartLineUp, Database, ListChecks } from "@phosphor-icons/react/dist/ssr";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { RouteHeader } from "@/components/route-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import {
  TRANSACTION_STATE_ORDER,
  TRANSACTION_STATE_META,
  TransactionStateBadge,
} from "@/components/shared/transaction-state";
import {
  ExecutionLedgerRow,
  LaunchLedgerRow,
} from "@/components/transactions/ledger-row";
import { getDatabase } from "@/lib/db/client";
import { agents, decisions, executionAttempts, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

type ExecutionRow = Awaited<ReturnType<typeof loadExecutionRows>>[number];
type TransactionFilter =
  "all" | "confirmed" | "failed" | "rejected" | "cancelled" | "simulated" | "pending";

const transactionFilters = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "failed", label: "Failed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "simulated", label: "Simulated" },
  { value: "pending", label: "Pending" },
] satisfies { value: TransactionFilter; label: string }[];

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
      agentMode: agents.mode,
    })
    .from(executionAttempts)
    .innerJoin(decisions, eq(decisions.id, executionAttempts.decisionId))
    .innerJoin(agents, eq(agents.id, decisions.agentId))
    .orderBy(desc(executionAttempts.createdAt))
    .limit(25);
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
      quoteMint: marketLaunches.quoteMint,
      poolAddress: marketLaunches.poolAddress,
      payoutWallet: marketLaunches.payoutWallet,
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
    .limit(25);
}

function resolveFilter(value: string | string[] | undefined): TransactionFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return transactionFilters.some((filter) => filter.value === candidate)
    ? (candidate as TransactionFilter)
    : "all";
}

function isPendingState(value: string) {
  return (
    value === "submitted" || value === "unknown_pending" || value.includes("pending")
  );
}

function matchesFilter(
  filter: TransactionFilter,
  value: ExecutionRow["state"] | string,
) {
  if (filter === "all") return true;
  if (filter === "pending") return isPendingState(value);
  return value === filter || value.includes(filter);
}

export default async function TransactionsPage({
  searchParams,
}: PageProps<"/transactions">) {
  const filter = resolveFilter((await searchParams).state);
  const [executions, launches] = await Promise.all([
    loadExecutionRows(),
    loadLaunchRows(),
  ]);
  const filteredExecutions = executions.filter((row) =>
    matchesFilter(filter, row.state),
  );
  const filteredLaunches = launches.filter((row) => matchesFilter(filter, row.status));
  const persistenceReady = Boolean(env.databaseUrl);

  return (
    <>
      <RouteHeader
        eyebrow="Execution ledger"
        title="Transactions"
        description="Recorded execution attempts and market launches, from preparation through network evidence."
        meta={persistenceReady ? "Persistent records" : "Persistence unavailable"}
      />

      {!persistenceReady ? (
        <section
          className="transaction-empty"
          aria-labelledby="transaction-empty-title"
        >
          <div className="transaction-empty-mark">
            <Database aria-hidden="true" size={26} weight="light" />
          </div>
          <div className="transaction-empty-copy">
            <span className="transaction-kicker">Ledger / unavailable</span>
            <h2 id="transaction-empty-title">
              No transaction ledger is available in this instance.
            </h2>
            <p>
              Persistent storage is not configured. Once available, this read-only
              ledger lists actual execution attempts and market launches, including
              network evidence and failures. The lifecycle below is a reference, not
              recorded activity.
            </p>
            <p className="transaction-empty-note">
              DATABASE_URL is required to read persisted records.
            </p>
            <Link href="/settings" className="transaction-empty-link">
              Open capabilities <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <aside className="transaction-empty-index" aria-label="Ledger record types">
            <span className="transaction-empty-index-title">In the ledger</span>
            <div>
              <span>01</span>
              <strong>Execution attempts</strong>
            </div>
            <div>
              <span>02</span>
              <strong>Market launches</strong>
            </div>
            <div>
              <span>03</span>
              <strong>Network evidence</strong>
            </div>
          </aside>
        </section>
      ) : (
        <div className="route-grid transaction-grid">
          <nav className="transaction-filters" aria-label="Transaction state filters">
            {transactionFilters.map((item) => (
              <Link
                key={item.value}
                href={
                  item.value === "all"
                    ? "/transactions"
                    : `/transactions?state=${item.value}`
                }
                data-current={filter === item.value || undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <section className="route-panel transaction-ledger">
            <div className="panel-heading">
              <ListChecks aria-hidden="true" size={20} />
              <div>
                <span>Value movement</span>
                <h2>Execution attempts</h2>
              </div>
            </div>
            {filteredExecutions.length > 0 ? (
              <div className="transaction-list">
                {filteredExecutions.map((row) => (
                  <ExecutionLedgerRow row={row} key={row.id} />
                ))}
              </div>
            ) : (
              <p className="route-copy">
                No execution attempts match this filter. Simulations and rejected wallet
                approvals appear here only after they are persisted.
              </p>
            )}
          </section>

          <section className="route-panel transaction-ledger">
            <div className="panel-heading">
              <ChartLineUp aria-hidden="true" size={20} />
              <div>
                <span>Sponsor launches</span>
                <h2>Market launches</h2>
              </div>
            </div>
            {filteredLaunches.length > 0 ? (
              <div className="transaction-list">
                {filteredLaunches.map((row) => (
                  <LaunchLedgerRow row={row} key={row.id} />
                ))}
              </div>
            ) : (
              <p className="route-copy">
                No market-launch records match this filter. Prepared and simulated
                records, when present, are labelled as such and do not represent
                submitted transactions.
              </p>
            )}
          </section>
        </div>
      )}
      <section
        className="transaction-lifecycle"
        aria-labelledby="transaction-lifecycle-title"
      >
        <div className="transaction-lifecycle-intro">
          <div>
            <span className="transaction-kicker">Reference / 01</span>
            <h2 id="transaction-lifecycle-title">
              Transaction lifecycle <InfoHint topic="transactionLifecycle" />
            </h2>
            <p>
              These are possible stages, not a claim that a transaction has reached
              them. Records on this page show only their recorded state.
            </p>
          </div>
          <span className="transaction-lifecycle-count">09 states</span>
        </div>
        <div className="transaction-lifecycle-list">
          {TRANSACTION_STATE_ORDER.map((state, index) => (
            <div className="transaction-lifecycle-item" key={state}>
              <span className="transaction-lifecycle-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <TransactionStateBadge state={state} />
              <span className="transaction-lifecycle-description">
                {TRANSACTION_STATE_META[state].description}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
