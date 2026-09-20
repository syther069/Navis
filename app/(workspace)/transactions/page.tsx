import {
  ArrowSquareOut,
  ChartLineUp,
  Database,
  ListChecks,
} from "@phosphor-icons/react/dist/ssr";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, RouteHeader } from "@/components/route-primitives";
import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { StatusBadge, type StatusTone } from "@/components/shared/domain-primitives";
import { assuranceForExecution } from "@/lib/assurance";
import { getDatabase } from "@/lib/db/client";
import { agents, decisions, executionAttempts, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { summarizeMeteoraLaunchEvidence } from "@/lib/services/meteora-reconciliation";

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
    .limit(25);
}

function toneForExecution(state: ExecutionRow["state"]): StatusTone {
  if (state === "confirmed") return "pass";
  if (state === "submitted" || state === "unknown_pending") return "pending";
  if (state === "failed" || state === "rejected" || state === "cancelled")
    return "block";
  if (state === "simulated") return "simulation";
  return "neutral";
}

function toneForLaunch(status: string): StatusTone {
  if (status === "confirmed" || status === "pool_confirmed") return "pass";
  if (
    status.includes("submitting") ||
    status.includes("submitted") ||
    status.includes("pending") ||
    status.includes("signature_confirmed")
  )
    return "pending";
  if (status.includes("failed") || status.includes("rejected")) return "block";
  if (status.includes("simulated")) return "simulation";
  return "neutral";
}

function toneForEvidence(label: string): StatusTone {
  if (label === "protocol_verified") return "pass";
  if (label === "signature_confirmed") return "pending";
  if (label === "evidence_incomplete") return "block";
  return "neutral";
}

function formatDate(value: Date | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

function shortHash(value: string | null) {
  if (!value) return "Not recorded";
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function explorerUrl(signature: string, cluster: "devnet" | "mainnet-beta") {
  const clusterQuery = cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/tx/${signature}${clusterQuery}`;
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
        description="A read-only audit trail for execution attempts and sponsor market launches."
        meta={persistenceReady ? "Persistent records" : "Persistence unavailable"}
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
                  <article className="transaction-row" key={row.id}>
                    <div>
                      <span>{formatDate(row.createdAt)}</span>
                      <h3>{String(row.proposal.action).replaceAll("_", " ")}</h3>
                      <code>{shortHash(row.decisionHash)}</code>
                    </div>
                    <StatusBadge tone={toneForExecution(row.state)}>
                      {row.state}
                    </StatusBadge>
                    <div>
                      <span>Cluster</span>
                      <strong>{row.cluster}</strong>
                    </div>
                    <div>
                      <span>Slot</span>
                      <strong>
                        {row.slot ? row.slot.toString() : "Not confirmed"}
                      </strong>
                    </div>
                    {row.transactionSignature && row.state !== "simulated" ? (
                      <Link
                        className="secondary-button"
                        href={explorerUrl(row.transactionSignature, row.cluster)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explorer <ArrowSquareOut aria-hidden="true" size={14} />
                      </Link>
                    ) : (
                      <span className="transaction-muted">No explorer link</span>
                    )}
                    <div className="transaction-evidence">
                      <AssuranceBadge
                        assurance={assuranceForExecution({
                          state: row.state,
                          transactionSignature: row.transactionSignature,
                          mode: row.agentMode,
                        })}
                      />
                    </div>
                    {row.safeError ? (
                      <p className="transaction-error">{row.safeError}</p>
                    ) : null}
                  </article>
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
                  <article className="transaction-row" key={row.id}>
                    <div>
                      <span>{formatDate(row.createdAt)}</span>
                      <h3>
                        {row.provider} · {row.agentSlug}
                      </h3>
                      <code>{row.providerRequestId ?? row.id}</code>
                    </div>
                    <StatusBadge tone={toneForLaunch(row.status)}>
                      {row.status}
                    </StatusBadge>
                    <div>
                      <span>Base mint</span>
                      <strong>{shortHash(row.baseMint)}</strong>
                    </div>
                    <div>
                      <span>Pool</span>
                      <strong>{shortHash(row.poolAddress)}</strong>
                    </div>
                    {(() => {
                      const evidence = summarizeMeteoraLaunchEvidence(
                        row.status,
                        row.metadata,
                      );
                      if (!evidence) return null;
                      return (
                        <div className="transaction-evidence">
                          <StatusBadge tone={toneForEvidence(evidence.label)}>
                            {evidence.label.replaceAll("_", " ")}
                          </StatusBadge>
                          <span>
                            slot {evidence.slot ?? "n/a"} · fee{" "}
                            {evidence.feeLamports ?? "n/a"} lamports · account{" "}
                            {shortHash(evidence.account)}
                          </span>
                        </div>
                      );
                    })()}
                    {row.transactionSignature ? (
                      <Link
                        className="secondary-button"
                        href={explorerUrl(row.transactionSignature, row.cluster)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explorer <ArrowSquareOut aria-hidden="true" size={14} />
                      </Link>
                    ) : (
                      <span className="transaction-muted">Awaiting real signature</span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="route-copy">
                No market-launch records match this filter. Prepared or simulated
                Meteora transactions stay off this ledger until a signed transaction is
                submitted.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
