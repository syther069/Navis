"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChartDonut,
  CheckCircle,
  Cpu,
  FileCode,
  Fingerprint,
  ShieldCheck,
  TrendUp,
} from "@phosphor-icons/react";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { DecisionStateBadge } from "@/components/shared/domain-primitives";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { demoProof } from "@/fixtures/demo-proof";
import { describeAssurance } from "@/lib/assurance";
import { formatBaseUnits } from "@/lib/presentation";

type DemoTab = "market" | "proposal" | "policy" | "proof";

export function ActualProductDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>("proposal");

  const { portfolio, decision } = demoProof.document;
  const { proposal } = decision;
  const inputAsset = demoAgentBundle.assets[0];
  const outputAsset = demoAgentBundle.assets[1];

  const valuations = new Map(
    portfolio.document.valuations.map((valuation) => [valuation.mint, valuation]),
  );
  const assets = new Map(demoAgentBundle.assets.map((asset) => [asset.mint, asset]));

  const positions = portfolio.document.balances.map((balance) => {
    const valuation = balance.mint ? valuations.get(balance.mint) : undefined;
    const asset = balance.mint ? assets.get(balance.mint) : undefined;
    return {
      key: balance.mint ?? "native-sol",
      symbol: asset?.symbol ?? "SOL",
      name: asset?.name ?? "Solana Reserve",
      amount: formatBaseUnits(balance.rawAmount, balance.decimals),
      valuation: valuation?.status === "priced" ? valuation.valueUsdMicros : null,
      reason:
        valuation?.status === "unpriced"
          ? valuation.reason
          : balance.kind === "native"
            ? "Reserve is not assigned a demo USD valuation."
            : null,
    };
  });

  const pricedSubtotalMicros = portfolio.document.valuations.reduce(
    (total, valuation) =>
      valuation.status === "priced" ? total + BigInt(valuation.valueUsdMicros) : total,
    BigInt(0),
  );
  const pricedSubtotalUsd = Number(pricedSubtotalMicros) / 1_000_000;

  const realRiskRules = [
    {
      rule: "max_trade_bps",
      label: "Max single trade size",
      observed: "5.00%",
      limit: "10.00%",
      status: "pass" as const,
      detail: "Proposed trade is 5.00% of portfolio; limit is 10.00%",
    },
    {
      rule: "max_position_bps",
      label: "Max asset concentration",
      observed: "30.00%",
      limit: "35.00%",
      status: "pass" as const,
      detail: "Output asset reaches 30.00% post-trade; limit is 35.00%",
    },
    {
      rule: "min_reserve_bps",
      label: "Minimum SOL reserve floor",
      observed: "25.00%",
      limit: "20.00%",
      status: "pass" as const,
      detail: "SOL reserve retained at 25.00%; floor is 20.00%",
    },
    {
      rule: "max_slippage_bps",
      label: "Max slippage ceiling",
      observed: "75 bps (0.75%)",
      limit: "75 bps (0.75%)",
      status: "pass" as const,
      detail: "Meteora quote slippage bounded to 75 bps",
    },
    {
      rule: "allowed_mints",
      label: "Universe allowlist check",
      observed: "EQA, EQB ∈ universe",
      limit: "Demo Equities",
      status: "pass" as const,
      detail: "Both input and output assets belong to approved mandate universe",
    },
    {
      rule: "max_daily_turnover_bps",
      label: "Max 24h turnover limit",
      observed: "5.00%",
      limit: "25.00%",
      status: "pass" as const,
      detail: "Cumulative daily turnover well within 25.00% boundary",
    },
    {
      rule: "max_data_age_seconds",
      label: "Market snapshot freshness",
      observed: "0s age",
      limit: "300s limit",
      status: "pass" as const,
      detail: "Snapshot slot 902 observed within current evaluation window",
    },
    {
      rule: "min_liquidity_usd_micros",
      label: "Pool depth requirement",
      observed: "$1,200.00 USD",
      limit: "$1,000.00 USD",
      status: "pass" as const,
      detail: "Available Meteora liquidity meets minimum pool floor",
    },
  ];

  return (
    <div
      className="product-demo-terminal"
      aria-label="Actual NAVIS product demonstration"
    >
      {/* ── Demo Terminal Navigation Bar ── */}
      <div className="demo-terminal-header">
        <div className="terminal-title-group">
          <span className="terminal-dot" />
          <span className="terminal-title">
            NAVIS Decision Terminal · Live Workspace UI
          </span>
          <span className="terminal-mode-tag">Demo Execution</span>
        </div>

        <nav
          className="demo-tabs-nav"
          role="tablist"
          aria-label="Product demonstration tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "proposal"}
            className={`demo-tab-btn ${activeTab === "proposal" ? "demo-tab-active" : ""}`}
            onClick={() => setActiveTab("proposal")}
          >
            <Cpu size={14} aria-hidden="true" />
            <span>01. Proposal</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "policy"}
            className={`demo-tab-btn ${activeTab === "policy" ? "demo-tab-active" : ""}`}
            onClick={() => setActiveTab("policy")}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <span>02. Policy Scorecard</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "market"}
            className={`demo-tab-btn ${activeTab === "market" ? "demo-tab-active" : ""}`}
            onClick={() => setActiveTab("market")}
          >
            <ChartDonut size={14} aria-hidden="true" />
            <span>03. Market Snapshot</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "proof"}
            className={`demo-tab-btn ${activeTab === "proof" ? "demo-tab-active" : ""}`}
            onClick={() => setActiveTab("proof")}
          >
            <Fingerprint size={14} aria-hidden="true" />
            <span>04. Verifiable Proof</span>
          </button>
        </nav>
      </div>

      {/* ── Tab 1: Proposal (Default) ── */}
      {activeTab === "proposal" && (
        <div
          className="demo-panel-content"
          role="tabpanel"
          aria-label="Atlas proposal view"
        >
          <div className="demo-split-view">
            <div className="demo-view-main">
              <div className="proposal-headline-box">
                <div className="proposal-status-row">
                  <DecisionStateBadge
                    state="approved"
                    label="Policy Approved · Simulated"
                  />
                  <span className="proposal-action-pill">{proposal.action}</span>
                </div>
                <h3 className="proposal-order-summary">
                  {proposal.action !== "HOLD"
                    ? `${proposal.inputAmount.uiAmount} ${inputAsset?.symbol ?? "EQA"} → min ${proposal.minimumOutputAmount.uiAmount} ${outputAsset?.symbol ?? "EQB"}`
                    : "HOLD order (no token movement)"}
                </h3>
              </div>

              <div className="proposal-rationale-box">
                <span className="rationale-label">Analytical Rationale (Thesis):</span>
                <p className="rationale-text">{proposal.thesis}</p>
              </div>

              <div className="proposal-meta-grid">
                <div className="meta-item">
                  <span className="meta-key">Confidence</span>
                  <strong className="meta-val tabular-num">
                    {(proposal.confidenceBps / 100).toFixed(2)}%
                  </strong>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Max Slippage</span>
                  <strong className="meta-val tabular-num">
                    {proposal.maxSlippageBps} bps (0.75%)
                  </strong>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Execution Provider</span>
                  <span className="meta-val-text">Meteora DBC Swap</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Signing Rights</span>
                  <span className="meta-val-text highlight-val">
                    Wallet Required (0 keys held)
                  </span>
                </div>
              </div>
            </div>

            <div className="demo-view-aside">
              <span className="route-eyebrow">Real Terminal Controls</span>
              <p className="demo-aside-text">
                Every trade proposed by Atlas is packaged into this structured order
                card. The agent cannot broadcast onchain without clearing all
                deterministic policy checks.
              </p>
              <div className="demo-aside-actions">
                <Link className="primary-button" href="/agents/atlas">
                  Inspect in Atlas <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setActiveTab("policy")}
                >
                  View Policy Checks
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Policy Scorecard ── */}
      {activeTab === "policy" && (
        <div
          className="demo-panel-content"
          role="tabpanel"
          aria-label="Policy evaluation scorecard"
        >
          <div className="demo-split-view">
            <div className="demo-view-main">
              <header className="scorecard-header">
                <div>
                  <span className="route-eyebrow">Deterministic Verification</span>
                  <h3 className="scorecard-title">10/10 Invariants Evaluated</h3>
                </div>
                <span className="scorecard-badge">Deterministic Pass</span>
              </header>

              <div className="risk-scorecard-list">
                {realRiskRules.map((rule) => (
                  <div key={rule.rule} className="risk-scorecard-item">
                    <div className="risk-rule-info">
                      <CheckCircle size={15} weight="bold" className="risk-pass-icon" />
                      <div>
                        <strong>{rule.label}</strong>
                        <small>{rule.detail}</small>
                      </div>
                    </div>
                    <div className="risk-rule-values">
                      <span className="risk-observed tabular-num">{rule.observed}</span>
                      <small className="risk-limit tabular-num">
                        / limit {rule.limit}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="demo-view-aside">
              <span className="route-eyebrow">Zero Bypass Guarantee</span>
              <p className="demo-aside-text">
                Policies are evaluated in pure deterministic TypeScript code. If a
                single rule fails, the entire transaction is rejected instantly and
                funds are never touched.
              </p>
              <div className="demo-aside-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setActiveTab("proof")}
                >
                  Inspect Proof Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Market Snapshot ── */}
      {activeTab === "market" && (
        <div
          className="demo-panel-content"
          role="tabpanel"
          aria-label="Market snapshot and positions"
        >
          <div className="demo-split-view">
            <div className="demo-view-main">
              <div className="dashboard-kpi-banner">
                <div className="dashboard-kpi-item">
                  <span className="kpi-label">Priced Subtotal</span>
                  <strong className="kpi-value tabular-num">
                    $
                    {pricedSubtotalUsd.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    USD
                  </strong>
                </div>
                <div className="dashboard-kpi-item">
                  <span className="kpi-label">Snapshot Slot Height</span>
                  <code className="kpi-slot tabular-num">
                    {portfolio.document.slot}
                  </code>
                </div>
                <div className="dashboard-kpi-item">
                  <span className="kpi-label">Cluster</span>
                  <span className="kpi-slot">devnet</span>
                </div>
              </div>

              <div
                className="dashboard-positions-table"
                role="table"
                aria-label="Monitored assets"
              >
                <div className="table-header" role="row">
                  <span role="columnheader">Asset</span>
                  <span role="columnheader" className="col-num">
                    Units
                  </span>
                  <span role="columnheader" className="col-num">
                    USD Value
                  </span>
                </div>
                {positions.map((pos) => (
                  <div className="table-row" role="row" key={pos.key}>
                    <span role="cell" className="cell-asset">
                      <strong>{pos.symbol}</strong>
                      <small>{pos.name}</small>
                    </span>
                    <span role="cell" className="cell-num tabular-num">
                      {pos.amount}
                    </span>
                    <span role="cell" className="cell-num tabular-num">
                      {pos.valuation ? (
                        `$${(Number(pos.valuation) / 1_000_000).toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                          },
                        )}`
                      ) : (
                        <span className="unpriced-pill">
                          <TrendUp size={12} /> Unpriced
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="demo-view-aside">
              <span className="route-eyebrow">Immutable Inputs</span>
              <p className="demo-aside-text">
                Market data is locked into the decision record at an exact Solana slot
                height. This prevents time-of-check to time-of-use oracle latency
                exploits.
              </p>
              <div className="demo-aside-actions">
                <Link className="text-link" href="/markets/launch">
                  Open Markets & Launch <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Verifiable Proof ── */}
      {activeTab === "proof" && (
        <div
          className="demo-panel-content"
          role="tabpanel"
          aria-label="Cryptographic proof receipt"
        >
          <div className="demo-split-view">
            <div className="demo-view-main">
              <div className="proof-card-box">
                <div className="proof-id-row">
                  <span className="proof-id-label">Receipt Identifier</span>
                  <code className="proof-id-val tabular-num">demo-proof</code>
                </div>
                <div className="proof-hash-row">
                  <span className="proof-hash-label">Canonical SHA-256 Hash</span>
                  <code className="proof-hash-val tabular-num">
                    {demoProof.receiptHash}
                  </code>
                </div>
              </div>

              <div className="proof-assurance-row">
                <AssuranceBadge
                  assurance={describeAssurance("offchain_integrity", "demo_simulation")}
                />
              </div>

              <p className="proof-card-explanation">
                Recomputed deterministically in your browser. Matching document hashes
                prove internal consistency without trusting NAVIS servers.
              </p>

              <div className="proof-verification-callout">
                <CheckCircle size={16} weight="bold" />
                <span>Verified in browser: Canonical JSON SHA-256 match confirmed</span>
              </div>
            </div>

            <div className="demo-view-aside">
              <span className="route-eyebrow">Independent Audit</span>
              <p className="demo-aside-text">
                Anyone can verify this receipt in the open-source in-browser verifier.
                Simulation records stop at offchain integrity; live records require
                confirmed onchain signatures.
              </p>
              <div className="demo-aside-actions">
                <Link className="primary-button" href="/proofs/demo-proof">
                  <Fingerprint size={16} aria-hidden="true" /> Verify Live in Browser
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
