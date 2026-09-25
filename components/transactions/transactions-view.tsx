"use client";

import {
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  CheckCircle,
  CircleDashed,
  Clock,
  ClockCountdown,
  Copy,
  Eye,
  FileText,
  Fingerprint,
  Flask,
  HandPointing,
  ListChecks,
  LockKey,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Prohibit,
  ShieldCheck,
  Wallet,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge, type StatusTone } from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";

export type TransactionLifecycleStage =
  | "Preparing"
  | "Simulation"
  | "Awaiting Wallet"
  | "Signing"
  | "Submitted"
  | "Confirming"
  | "Confirmed"
  | "Failed"
  | "Blocked";

export type FormattedTransaction = Readonly<{
  id: string;
  kind: "execution" | "launch";
  stage: TransactionLifecycleStage;
  rawState: string;
  title: string;
  action: string;
  asset: string | null;
  amount: string | null;
  network: "devnet" | "mainnet-beta" | string;
  wallet: string | null;
  fees: string | null;
  signature: string | null;
  explorerUrl: string | null;
  slot: string | null;
  timestamp: string;
  decisionHash: string | null;
  errorCode: string | null;
  safeError: string | null;
  provider?: string | null;
  agentName?: string | null;
  proofId?: string | null;
}>;

export const LIFECYCLE_STAGES: readonly {
  stage: TransactionLifecycleStage;
  tone: StatusTone;
  icon: typeof CheckCircle;
  description: string;
}[] = [
  {
    stage: "Preparing",
    tone: "neutral",
    icon: CircleDashed,
    description: "Server assembling unsigned instructions, account keys, and message hash.",
  },
  {
    stage: "Simulation",
    tone: "simulation",
    icon: Flask,
    description: "Dry-run executed against RPC node to verify balance deltas without gas.",
  },
  {
    stage: "Awaiting Wallet",
    tone: "warn",
    icon: Wallet,
    description: "Payload delivered to user extension; awaiting manual signature approval.",
  },
  {
    stage: "Signing",
    tone: "warn",
    icon: PencilSimple,
    description: "Ed25519 signature computation with user's non-custodial private key.",
  },
  {
    stage: "Submitted",
    tone: "pending",
    icon: PaperPlaneTilt,
    description: "Signed transaction sent to Solana RPC leader schedule for block inclusion.",
  },
  {
    stage: "Confirming",
    tone: "pending",
    icon: ClockCountdown,
    description: "Awaiting bank commitment and slot finality across cluster validators.",
  },
  {
    stage: "Confirmed",
    tone: "pass",
    icon: CheckCircle,
    description: "Transaction committed in finalized slot with immutable onchain receipt.",
  },
  {
    stage: "Failed",
    tone: "block",
    icon: XCircle,
    description: "Execution reverted by onchain program, network timeout, or user cancellation.",
  },
  {
    stage: "Blocked",
    tone: "block",
    icon: Prohibit,
    description: "Prevented by deterministic risk policy rules or sponsor capability gate.",
  },
];

function stageTone(stage: TransactionLifecycleStage): StatusTone {
  const found = LIFECYCLE_STAGES.find((s) => s.stage === stage);
  return found ? found.tone : "neutral";
}

function StageIcon({ stage, size = 14 }: { stage: TransactionLifecycleStage; size?: number }) {
  const found = LIFECYCLE_STAGES.find((s) => s.stage === stage);
  const IconComponent = found ? found.icon : CircleDashed;
  return <IconComponent size={size} aria-hidden="true" />;
}

export function TransactionsView({
  transactions,
  activeFilter = "all",
}: {
  transactions: readonly FormattedTransaction[];
  activeFilter?: string;
}) {
  const [filter, setFilter] = useState<string>(activeFilter);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchInputId = useId();

  const countsByStage = useMemo(() => {
    const counts: Record<string, number> = { all: transactions.length };
    for (const s of LIFECYCLE_STAGES) {
      counts[s.stage.toLowerCase()] = 0;
    }
    for (const tx of transactions) {
      const key = tx.stage.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Stage filter
      if (filter !== "all") {
        if (filter === "pending") {
          if (tx.stage !== "Submitted" && tx.stage !== "Confirming" && tx.stage !== "Awaiting Wallet") {
            return false;
          }
        } else if (tx.stage.toLowerCase() !== filter.toLowerCase()) {
          return false;
        }
      }

      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesId = tx.id.toLowerCase().includes(q);
        const matchesAction = tx.action.toLowerCase().includes(q);
        const matchesAsset = tx.asset ? tx.asset.toLowerCase().includes(q) : false;
        const matchesSig = tx.signature ? tx.signature.toLowerCase().includes(q) : false;
        const matchesHash = tx.decisionHash ? tx.decisionHash.toLowerCase().includes(q) : false;
        const matchesAgent = tx.agentName ? tx.agentName.toLowerCase().includes(q) : false;
        if (!matchesId && !matchesAction && !matchesAsset && !matchesSig && !matchesHash && !matchesAgent) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filter, search]);

  return (
    <div className="transactions-view-wrap" data-testid="transactions-view">
      {/* 9-Stage Visual Lifecycle Reference Strip */}
      <section className="transaction-lifecycle-guide" aria-labelledby="lifecycle-guide-heading">
        <div className="lifecycle-guide-header">
          <div className="title-with-hint">
            <span className="route-eyebrow">Solana Transaction State Machine</span>
            <h3 id="lifecycle-guide-heading">9 Distinct Execution Stages</h3>
          </div>
          <InfoHint topic="transactionLifecycle" label="About 9-stage lifecycle" />
        </div>

        <div className="lifecycle-stepper">
          {LIFECYCLE_STAGES.map(({ stage, tone, icon: Icon, description }) => {
            const isActiveFilter = filter.toLowerCase() === stage.toLowerCase();
            const count = countsByStage[stage.toLowerCase()] || 0;
            return (
              <button
                key={stage}
                type="button"
                className={`lifecycle-step-card tone-${tone} ${isActiveFilter ? "active-filter" : ""}`}
                onClick={() => setFilter(isActiveFilter ? "all" : stage.toLowerCase())}
                title={`${stage}: ${description}`}
              >
                <div className="step-icon-badge">
                  <Icon size={16} />
                </div>
                <div className="step-label-group">
                  <span className="step-name">{stage}</span>
                  <span className="step-count font-mono">{count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="transaction-toolbar">
        <div className="filter-pills-row" role="tablist" aria-label="Filter transactions by state">
          <button
            type="button"
            className={`filter-pill ${filter === "all" ? "pill-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All <span className="font-mono">({transactions.length})</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === "confirmed" ? "pill-active" : ""}`}
            onClick={() => setFilter("confirmed")}
          >
            Confirmed <span className="font-mono">({countsByStage["confirmed"] || 0})</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === "simulation" ? "pill-active" : ""}`}
            onClick={() => setFilter("simulation")}
          >
            Simulated <span className="font-mono">({countsByStage["simulation"] || 0})</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === "pending" ? "pill-active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            Pending <span className="font-mono">({(countsByStage["submitted"] || 0) + (countsByStage["confirming"] || 0) + (countsByStage["awaiting wallet"] || 0)})</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === "failed" ? "pill-active" : ""}`}
            onClick={() => setFilter("failed")}
          >
            Failed <span className="font-mono">({countsByStage["failed"] || 0})</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === "blocked" ? "pill-active" : ""}`}
            onClick={() => setFilter("blocked")}
          >
            Blocked <span className="font-mono">({countsByStage["blocked"] || 0})</span>
          </button>
        </div>

        <div className="transaction-search-wrap">
          <MagnifyingGlass size={15} aria-hidden="true" />
          <label htmlFor={searchInputId} className="sr-only">
            Filter transactions by ID, hash, or asset
          </label>
          <input
            id={searchInputId}
            type="search"
            placeholder="Search by ID, hash, signature, or asset…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="transaction-search-input"
          />
        </div>
      </div>

      {/* Dense Ledger Table */}
      <div className="transaction-table-wrap">
        <table className="transaction-dense-table" aria-label="Transaction execution ledger">
          <thead>
            <tr>
              <th scope="col" className="col-expand" aria-label="Expand row"></th>
              <th scope="col" className="col-time">Time (UTC)</th>
              <th scope="col" className="col-stage">Lifecycle Stage</th>
              <th scope="col" className="col-action">Action / Intent</th>
              <th scope="col" className="col-asset">Asset</th>
              <th scope="col" className="col-amount text-right">Amount</th>
              <th scope="col" className="col-network">Network</th>
              <th scope="col" className="col-wallet">Wallet Authority</th>
              <th scope="col" className="col-fees text-right">Fees</th>
              <th scope="col" className="col-sig">Signature / Evidence</th>
              <th scope="col" className="col-explorer text-right">Explorer</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={11} className="tx-empty-cell">
                  <div className="tx-empty-content">
                    <WarningCircle size={22} aria-hidden="true" />
                    <p>No transactions found matching the selected filter.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isExpanded = expandedId === tx.id;
                const tone = stageTone(tx.stage);

                return (
                  <tr
                    key={tx.id}
                    className={`tx-ledger-row ${isExpanded ? "tx-row-expanded" : ""}`}
                    data-stage={tx.stage.toLowerCase()}
                  >
                    {/* Expand Toggle */}
                    <td className="col-expand">
                      <button
                        type="button"
                        className="row-expand-btn"
                        onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        aria-label={isExpanded ? "Collapse transaction detail" : "Expand transaction detail"}
                      >
                        {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
                      </button>
                    </td>

                    {/* Time */}
                    <td className="col-time">
                      <span className="tx-time-cell">
                        <Clock size={12} aria-hidden="true" />
                        <span className="font-mono">{tx.timestamp}</span>
                      </span>
                    </td>

                    {/* Stage (1 of 9 visually distinct stages) */}
                    <td className="col-stage">
                      <span className={`lifecycle-stage-badge tone-${tone}`}>
                        <StageIcon stage={tx.stage} size={13} />
                        <span>{tx.stage}</span>
                      </span>
                    </td>

                    {/* Action / Intent */}
                    <td className="col-action">
                      <div className="tx-action-wrap">
                        <strong className="tx-action-title">{tx.action}</strong>
                        {tx.agentName ? (
                          <span className="tx-agent-tag">{tx.agentName}</span>
                        ) : null}
                      </div>
                    </td>

                    {/* Asset */}
                    <td className="col-asset">
                      {tx.asset ? (
                        <span className="tx-asset-pill">{tx.asset}</span>
                      ) : (
                        <span className="tx-muted-cell">—</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="col-amount text-right">
                      {tx.amount ? (
                        <span className="font-mono font-medium">{tx.amount}</span>
                      ) : (
                        <span className="tx-muted-cell">—</span>
                      )}
                    </td>

                    {/* Network */}
                    <td className="col-network">
                      <span className="mode-stamp font-mono" data-mode={tx.network === "mainnet-beta" ? "mainnet" : "devnet"}>
                        {tx.network}
                      </span>
                    </td>

                    {/* Wallet (ONLY when available, NEVER fabricated) */}
                    <td className="col-wallet">
                      {tx.wallet ? (
                        <AddressValue value={tx.wallet} label="Signer wallet" />
                      ) : (
                        <span className="tx-status-unrecorded">Pending connection</span>
                      )}
                    </td>

                    {/* Fees (ONLY when available, NEVER fabricated) */}
                    <td className="col-fees text-right">
                      {tx.fees ? (
                        <span className="font-mono text-secondary">{tx.fees}</span>
                      ) : tx.stage === "Simulation" ? (
                        <span className="tx-status-unrecorded">0 SOL (dry run)</span>
                      ) : (
                        <span className="tx-status-unrecorded">Pending</span>
                      )}
                    </td>

                    {/* Signature / Evidence */}
                    <td className="col-sig">
                      {tx.signature ? (
                        <span className="tx-signature-cell font-mono">
                          {tx.signature.slice(0, 6)}…{tx.signature.slice(-4)}
                        </span>
                      ) : tx.decisionHash ? (
                        <span className="tx-hash-cell font-mono" title={`Decision Hash: ${tx.decisionHash}`}>
                          {tx.decisionHash.slice(0, 8)}… (offchain)
                        </span>
                      ) : (
                        <span className="tx-status-unrecorded">None (offchain only)</span>
                      )}
                    </td>

                    {/* Explorer Link (ONLY when real onchain signature exists) */}
                    <td className="col-explorer text-right">
                      {tx.explorerUrl ? (
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="tx-explorer-link"
                          title="Open in Solana Explorer"
                        >
                          <span>Explorer</span>
                          <ArrowSquareOut size={13} />
                        </a>
                      ) : (
                        <span className="tx-no-explorer" title="No onchain transaction exists">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Expanded Row Detail Drawer (if an item is expanded) */}
      {expandedId ? (() => {
        const item = transactions.find((t) => t.id === expandedId);
        if (!item) return null;

        return (
          <div className="tx-expanded-panel route-panel" data-testid="tx-expanded-panel">
            <div className="panel-header-row">
              <div>
                <span className="route-eyebrow">Audit Record & Trace</span>
                <h4>Transaction ID: <code className="font-mono">{item.id}</code></h4>
              </div>
              <button
                type="button"
                className="secondary-button compact-btn"
                onClick={() => setExpandedId(null)}
              >
                Close Trace
              </button>
            </div>

            <div className="tx-expanded-grid">
              <div className="detail-item">
                <span className="detail-label">Lifecycle Stage</span>
                <span className={`lifecycle-stage-badge tone-${stageTone(item.stage)}`}>
                  <StageIcon stage={item.stage} size={14} />
                  <strong>{item.stage}</strong>
                </span>
                <small className="detail-hint">Raw status: {item.rawState}</small>
              </div>

              <div className="detail-item">
                <span className="detail-label">Network Slot</span>
                <strong className="detail-value font-mono">
                  {item.slot ? item.slot : "Not confirmed in slot"}
                </strong>
                <small className="detail-hint">Finalized ledger slot number</small>
              </div>

              <div className="detail-item">
                <span className="detail-label">Transaction Fees</span>
                <strong className="detail-value font-mono">
                  {item.fees ? item.fees : "None / Unbilled"}
                </strong>
                <small className="detail-hint">Compute budget execution fee</small>
              </div>

              <div className="detail-item">
                <span className="detail-label">Decision Hash</span>
                {item.decisionHash ? (
                  <code className="detail-code font-mono">{item.decisionHash}</code>
                ) : (
                  <span className="tx-status-unrecorded">None recorded</span>
                )}
                <small className="detail-hint">Cryptographic proposal root</small>
              </div>
            </div>

            {/* Error & Redaction Section */}
            {item.safeError || item.errorCode ? (
              <div className="tx-error-box">
                <WarningCircle size={18} className="icon-danger" />
                <div>
                  <strong>Execution Failure: {item.errorCode || "Unknown Error"}</strong>
                  <p>{item.safeError || "No sanitized provider message was captured."}</p>
                </div>
              </div>
            ) : null}

            {/* Verified Links */}
            <div className="tx-expanded-actions">
              {item.proofId ? (
                <Link href={`/proofs/${item.proofId}`} className="secondary-button">
                  <Fingerprint size={16} />
                  <span>Verify Cryptographic Receipt</span>
                </Link>
              ) : null}
              {item.explorerUrl ? (
                <a
                  href={item.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="secondary-button"
                >
                  <ArrowSquareOut size={16} />
                  <span>View On Solana Explorer</span>
                </a>
              ) : null}
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
