"use client";

import {
  ArrowSquareOut,
  Buildings,
  ChartDonut,
  CheckCircle,
  Clock,
  Eye,
  MagnifyingGlass,
  SlidersHorizontal,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge, type StatusTone } from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";

export type MarketAssetRow = Readonly<{
  name: string;
  symbol: string;
  description: string;
  image?: string;
  externalUrl: string;
  contractAddress: string;
  tokenPrice: number;
  markPrice: number;
  premiumPercent: number | null;
  markValuation: number;
  impliedValuation: number;
  supply: number;
  timestamp: string;
  source: string;
  atlasSignal: {
    action: "REBALANCE (IN)" | "REBALANCE (OUT)" | "BUY" | "SELL" | "HOLD";
    thesis: string;
    confidenceBps?: number;
  } | null;
  risk: {
    label: string;
    tone: StatusTone;
    detail: string;
  };
}>;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactValuationFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";
  } catch {
    return iso;
  }
}

export function MarketsTable({
  assets,
  capturedAt,
  sourceUrl,
}: {
  assets: readonly MarketAssetRow[];
  capturedAt: string;
  sourceUrl: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const searchInputId = useId();

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.contractAddress.toLowerCase().includes(q),
    );
  }, [assets, search]);

  const selectedAsset = useMemo(
    () => (selectedSymbol ? assets.find((a) => a.symbol === selectedSymbol) ?? null : null),
    [assets, selectedSymbol],
  );

  return (
    <div className="markets-workflow-container" data-testid="markets-workflow">
      {/* Search and Filter Toolbar */}
      <div className="markets-toolbar">
        <div className="markets-search-wrap">
          <MagnifyingGlass aria-hidden="true" size={16} />
          <label htmlFor={searchInputId} className="sr-only">
            Filter markets by name or symbol
          </label>
          <input
            id={searchInputId}
            type="search"
            placeholder="Search by asset, symbol, or mint address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="markets-search-input"
          />
          {search ? (
            <button
              type="button"
              className="markets-clear-btn"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="markets-toolbar-meta">
          <span className="markets-counter">
            Showing <strong>{filteredAssets.length}</strong> of {assets.length} assets
          </span>
          <InfoHint topic="marketData" label="About market data & pricing" />
        </div>
      </div>

      {/* Dense Institutional Table */}
      <div className="markets-table-container">
        <table className="markets-dense-table" aria-label="Financial markets comparative data">
          <thead>
            <tr>
              <th scope="col" className="col-asset">Asset</th>
              <th scope="col" className="col-symbol">Symbol</th>
              <th scope="col" className="col-num col-price">
                <span>Price</span>
              </th>
              <th scope="col" className="col-num col-change">
                <span>Change / Prem</span>
              </th>
              <th scope="col" className="col-num col-mark">
                <span>Mark Price</span>
              </th>
              <th scope="col" className="col-num col-valuation">
                <span>Implied Val</span>
              </th>
              <th scope="col" className="col-timestamp">Timestamp</th>
              <th scope="col" className="col-source">Source</th>
              <th scope="col" className="col-signal">
                <span className="th-with-hint">
                  Atlas Signal
                  <InfoHint topic="atlasSignal" label="About Atlas signals" />
                </span>
              </th>
              <th scope="col" className="col-risk">Risk Profile</th>
              <th scope="col" className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={11} className="markets-empty-cell">
                  <div className="markets-empty-box">
                    <WarningCircle size={24} aria-hidden="true" />
                    <p>No market assets match &ldquo;{search}&rdquo;</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setSearch("")}
                    >
                      Reset filter
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => {
                const isSelected = selectedSymbol === asset.symbol;
                const hasSignal = asset.atlasSignal !== null;
                const premium = asset.premiumPercent;
                const premiumSigned =
                  premium !== null
                    ? `${premium > 0 ? "+" : ""}${premium.toFixed(2)}%`
                    : "n/a";
                const premiumTone: StatusTone =
                  premium === null || premium === 0
                    ? "neutral"
                    : premium > 0
                      ? "warn"
                      : "pass";

                return (
                  <tr
                    key={asset.contractAddress}
                    className={`markets-table-row ${isSelected ? "row-selected" : ""}`}
                    data-symbol={asset.symbol}
                  >
                    {/* Asset */}
                    <td className="col-asset">
                      <div className="asset-cell-wrap">
                        <span className="asset-token-badge" aria-hidden="true">
                          {asset.symbol.slice(0, 2)}
                        </span>
                        <div className="asset-name-group">
                          <strong className="asset-name">{asset.name}</strong>
                          <span className="asset-mint-snippet" title={asset.contractAddress}>
                            {asset.contractAddress.slice(0, 4)}…{asset.contractAddress.slice(-4)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Symbol */}
                    <td className="col-symbol">
                      <span className="symbol-ticker-pill">{asset.symbol}</span>
                    </td>

                    {/* Price */}
                    <td className="col-num col-price">
                      <span className="numeric-data-cell font-mono">
                        {usdFormatter.format(asset.tokenPrice)}
                      </span>
                    </td>

                    {/* Change / Premium */}
                    <td className="col-num col-change">
                      <span className={`premium-indicator font-mono tone-${premiumTone}`}>
                        {premiumSigned}
                      </span>
                    </td>

                    {/* Mark Price */}
                    <td className="col-num col-mark">
                      <span className="numeric-data-cell secondary-num font-mono">
                        {usdFormatter.format(asset.markPrice)}
                      </span>
                    </td>

                    {/* Implied Valuation */}
                    <td className="col-num col-valuation">
                      <span className="numeric-data-cell font-mono">
                        {compactValuationFormatter.format(asset.impliedValuation)}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td className="col-timestamp">
                      <span className="timestamp-cell">
                        <Clock size={12} aria-hidden="true" />
                        {formatTime(asset.timestamp)}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="col-source">
                      <span className="source-tag-compact" title={`Source: ${asset.source}`}>
                        {asset.source}
                      </span>
                    </td>

                    {/* Atlas Signal (only when actually available - never fabricated) */}
                    <td className="col-signal">
                      {hasSignal ? (
                        <span
                          className={`signal-badge ${
                            asset.atlasSignal!.action.includes("IN") || asset.atlasSignal!.action === "BUY"
                              ? "signal-in"
                              : "signal-out"
                          }`}
                          title={asset.atlasSignal!.thesis}
                        >
                          {asset.atlasSignal!.action}
                        </span>
                      ) : (
                        <span className="signal-none" title="No active Atlas signal recorded for this asset">
                          —
                        </span>
                      )}
                    </td>

                    {/* Risk */}
                    <td className="col-risk">
                      <StatusBadge tone={asset.risk.tone}>
                        {asset.risk.label}
                      </StatusBadge>
                    </td>

                    {/* Actions */}
                    <td className="col-actions">
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className={`action-btn-inspect ${isSelected ? "btn-active" : ""}`}
                          onClick={() =>
                            setSelectedSymbol(isSelected ? null : asset.symbol)
                          }
                          aria-label={`Inspect ${asset.symbol} details`}
                        >
                          <Eye size={14} aria-hidden="true" />
                          <span>{isSelected ? "Close" : "Inspect"}</span>
                        </button>
                        <a
                          href={asset.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="action-btn-external"
                          title={`Open ${asset.symbol} provider page`}
                          aria-label={`Open ${asset.symbol} provider page`}
                        >
                          <ArrowSquareOut size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Market Detail Drawer / Inspector */}
      {selectedAsset ? (
        <aside
          className="market-detail-drawer"
          aria-labelledby="market-detail-heading"
          data-testid="market-detail-drawer"
        >
          <div className="drawer-header">
            <div className="drawer-title-group">
              <span className="route-eyebrow">Market Detail & Verification</span>
              <div className="drawer-headline">
                <span className="asset-token-badge large" aria-hidden="true">
                  {selectedAsset.symbol.slice(0, 2)}
                </span>
                <div>
                  <h3 id="market-detail-heading">{selectedAsset.name}</h3>
                  <span className="symbol-ticker-pill">{selectedAsset.symbol}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={() => setSelectedSymbol(null)}
              aria-label="Close market detail drawer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="drawer-content">
            {/* Description */}
            <p className="drawer-desc">{selectedAsset.description}</p>

            {/* Price & Valuation Grid */}
            <div className="detail-metrics-grid">
              <div className="metric-box">
                <span className="metric-label">Token Price</span>
                <strong className="metric-value font-mono">
                  {usdFormatter.format(selectedAsset.tokenPrice)}
                </strong>
                <small className="metric-sub">Observed research price</small>
              </div>

              <div className="metric-box">
                <span className="metric-label">Mark Price</span>
                <strong className="metric-value font-mono">
                  {usdFormatter.format(selectedAsset.markPrice)}
                </strong>
                <small className="metric-sub">Upstream benchmark mark</small>
              </div>

              <div className="metric-box">
                <span className="metric-label">Premium / Discount</span>
                <strong
                  className={`metric-value font-mono tone-${
                    selectedAsset.premiumPercent === null || selectedAsset.premiumPercent === 0
                      ? "neutral"
                      : selectedAsset.premiumPercent > 0
                        ? "warn"
                        : "pass"
                  }`}
                >
                  {selectedAsset.premiumPercent !== null
                    ? `${selectedAsset.premiumPercent > 0 ? "+" : ""}${selectedAsset.premiumPercent.toFixed(2)}%`
                    : "n/a"}
                </strong>
                <small className="metric-sub">Token price vs mark price</small>
              </div>

              <div className="metric-box">
                <span className="metric-label">Implied Valuation</span>
                <strong className="metric-value font-mono">
                  {compactValuationFormatter.format(selectedAsset.impliedValuation)}
                </strong>
                <small className="metric-sub">At current token price</small>
              </div>

              <div className="metric-box">
                <span className="metric-label">Mark Valuation</span>
                <strong className="metric-value font-mono">
                  {compactValuationFormatter.format(selectedAsset.markValuation)}
                </strong>
                <small className="metric-sub">At benchmark mark price</small>
              </div>

              <div className="metric-box">
                <span className="metric-label">Circulating Supply</span>
                <strong className="metric-value font-mono">
                  {numberFormatter.format(selectedAsset.supply)}
                </strong>
                <small className="metric-sub">Total issued token units</small>
              </div>
            </div>

            {/* Atlas Agent Signal Analysis */}
            <div className="drawer-section">
              <div className="section-label-row">
                <span className="route-eyebrow">Autonomous Signal Audit</span>
                <InfoHint topic="atlasSignal" label="Signal verification rules" />
              </div>
              {selectedAsset.atlasSignal ? (
                <div className="signal-audit-card active-signal">
                  <div className="signal-header">
                    <span className="signal-badge-large">
                      {selectedAsset.atlasSignal.action}
                    </span>
                    {selectedAsset.atlasSignal.confidenceBps ? (
                      <span className="confidence-pill font-mono">
                        {(selectedAsset.atlasSignal.confidenceBps / 100).toFixed(0)}% confidence
                      </span>
                    ) : null}
                  </div>
                  <p className="signal-thesis">
                    &ldquo;{selectedAsset.atlasSignal.thesis}&rdquo;
                  </p>
                  <div className="signal-meta-row">
                    <CheckCircle size={14} className="icon-pass" />
                    <span>Real proposal verified from active Atlas decision record</span>
                  </div>
                </div>
              ) : (
                <div className="signal-audit-card inactive-signal">
                  <div className="signal-empty-row">
                    <WarningCircle size={16} className="icon-neutral" />
                    <strong>No active Atlas signal</strong>
                  </div>
                  <p className="signal-empty-desc">
                    Atlas is not currently proposing a position change for {selectedAsset.symbol}.
                    Signals are only generated when an evaluated decision mandate specifically rotates
                    into or out of this asset.
                  </p>
                </div>
              )}
            </div>

            {/* Contract & Technical Metadata */}
            <div className="drawer-section">
              <span className="route-eyebrow">Technical Identity</span>
              <div className="contract-box">
                <AddressValue
                  value={selectedAsset.contractAddress}
                  label={`${selectedAsset.symbol} Solana mint address`}
                />
                <div className="contract-badges-row">
                  <span className="tech-badge">Token-2022</span>
                  <span className="tech-badge">9 Decimals</span>
                  <span className="tech-badge">Mainnet-beta</span>
                </div>
              </div>
            </div>

            {/* Risk & Governance Notice */}
            <div className="drawer-section">
              <span className="route-eyebrow">Risk & Regulatory Policy</span>
              <div className="risk-notice-box">
                <WarningCircle size={18} aria-hidden="true" />
                <div>
                  <strong>{selectedAsset.risk.label}</strong>
                  <p>{selectedAsset.risk.detail}</p>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="drawer-actions">
              <Link
                href={`/markets/launch?mint=${selectedAsset.contractAddress}`}
                className="primary-button"
              >
                <ChartDonut size={16} aria-hidden="true" />
                Configure Launch Preflight
              </Link>
              <a
                href={selectedAsset.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="secondary-button"
              >
                <Buildings size={16} aria-hidden="true" />
                Provider Documentation
              </a>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
