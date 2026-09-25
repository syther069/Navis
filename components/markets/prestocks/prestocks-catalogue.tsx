import {
  ArrowSquareOut,
  Buildings,
  ChartDonut,
  Clock,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { SponsorPanelState } from "@/components/markets/sponsor-panel-state";
import { AddressValue } from "@/components/shared/address-value";
import {
  AmountValue,
  SourceStamp,
  StatusBadge,
} from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import type { PreStocksCatalogue } from "@/lib/integrations/prestocks/client";

type PreStocksCatalogueProps = {
  catalogue: PreStocksCatalogue;
};

function premiumPercent(asset: PreStocksCatalogue["assets"][number]) {
  if (asset.markPrice <= 0) return null;
  return ((asset.tokenPrice - asset.markPrice) / asset.markPrice) * 100;
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

export function PreStocksCatalogue({ catalogue }: PreStocksCatalogueProps) {
  return (
    <section className="route-panel prestocks-panel" aria-labelledby="prestocks-title">
      <div className="panel-heading">
        <Buildings aria-hidden="true" size={20} />
        <div>
          <span>PreStocks catalogue</span>
          <h2 id="prestocks-title">Economic-exposure tokens</h2>
        </div>
      </div>

      <div className="prestocks-disclosure">
        <WarningCircle aria-hidden="true" size={18} />
        <p>
          PreStocks are presented read-only in Navis. They provide economic exposure
          only, not company ownership, voting, dividend, information, or other legal
          rights. The provider discloses that they are risky, may lose all value, and
          are not available to U.S. persons or other ineligible persons.
        </p>
      </div>

      <div className="prestocks-source">
        <SourceStamp
          source="PreStocks catalogue read time"
          timestamp={catalogue.capturedAt}
        />
        <StatusBadge tone="warn">Eligibility gated</StatusBadge>
        <InfoHint topic="marketData" label="About PreStocks pricing & exposure" />
      </div>

      <p className="route-copy">
        This is Navis&apos;s catalogue read time, not a verified quote timestamp.
        Responses may be cached; upstream price freshness is unknown. These prices are
        for research, not execution quotes.
      </p>

      {/* Dense Comparative Financial Table (Primary Desktop View) */}
      <div className="prestocks-table-wrap">
        <table
          className="prestocks-table"
          aria-label="PreStocks economic-exposure tokens"
        >
          <thead>
            <tr>
              <th scope="col" className="text-left">
                Asset
              </th>
              <th scope="col" className="text-left">
                Symbol
              </th>
              <th scope="col" className="text-right">
                Token Price
              </th>
              <th scope="col" className="text-right">
                Mark Price
              </th>
              <th scope="col" className="text-right">
                Premium / Disc
              </th>
              <th scope="col" className="text-right">
                Implied Val
              </th>
              <th scope="col" className="text-right">
                Supply
              </th>
              <th scope="col" className="text-left">
                Mint Address
              </th>
              <th scope="col" className="text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {catalogue.assets.map((asset) => {
              const premium = premiumPercent(asset);
              const premiumSigned =
                premium !== null
                  ? `${premium > 0 ? "+" : ""}${premium.toFixed(2)}%`
                  : "n/a";
              const premiumTone =
                premium === null || premium === 0
                  ? "neutral"
                  : premium > 0
                    ? "warn"
                    : "pass";

              return (
                <tr key={asset.contract_address} data-symbol={asset.symbol}>
                  <td className="text-left">
                    <div className="table-asset-info">
                      <span className="prestocks-token-mark small" aria-hidden="true">
                        {asset.symbol.slice(0, 2)}
                      </span>
                      <strong>{asset.name}</strong>
                    </div>
                  </td>
                  <td className="text-left">
                    <span className="symbol-ticker-pill">{asset.symbol}</span>
                  </td>
                  <td className="text-right font-mono font-medium">
                    {usdFormatter.format(asset.tokenPrice)}
                  </td>
                  <td className="text-right font-mono text-secondary">
                    {usdFormatter.format(asset.markPrice)}
                  </td>
                  <td className="text-right font-mono">
                    <span className={`premium-indicator tone-${premiumTone}`}>
                      {premiumSigned}
                    </span>
                  </td>
                  <td className="text-right font-mono text-secondary">
                    {compactUsd.format(asset.impliedValuation)}
                  </td>
                  <td className="text-right font-mono text-secondary">
                    <AmountValue value={asset.supply} maximumFractionDigits={2} />
                  </td>
                  <td className="text-left">
                    <AddressValue
                      value={asset.contract_address}
                      label={`${asset.symbol} PreStocks mint`}
                    />
                  </td>
                  <td className="text-right">
                    <div className="table-action-btns">
                      <Link
                        href={`/markets/launch?mint=${asset.contract_address}`}
                        className="secondary-button compact-btn"
                        title={`Configure launch for ${asset.symbol}`}
                      >
                        <ChartDonut size={13} />
                        <span>Launch</span>
                      </Link>
                      <a
                        className="secondary-button compact-btn icon-only"
                        href={asset.external_url}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open ${asset.symbol} provider page`}
                        aria-label={`Open ${asset.symbol} provider page`}
                      >
                        <ArrowSquareOut size={13} />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grid cards maintained for responsive fallback */}
      <div className="prestocks-grid prestocks-cards-responsive">
        {catalogue.assets.map((asset) => (
          <article className="prestocks-card" key={asset.contract_address}>
            <div className="prestocks-card-heading">
              <span className="prestocks-token-mark" aria-hidden="true">
                {asset.symbol.slice(0, 2)}
              </span>
              <div>
                <span>{asset.symbol}</span>
                <h3>{asset.name}</h3>
              </div>
            </div>
            <p>{asset.description.split("\n\n")[0]}</p>
            <div className="prestocks-metrics">
              <div>
                <span>Token price</span>
                <AmountValue
                  value={asset.tokenPrice}
                  symbol="USD"
                  maximumFractionDigits={2}
                />
              </div>
              <div>
                <span>Mark price</span>
                <AmountValue
                  value={asset.markPrice}
                  symbol="USD"
                  maximumFractionDigits={2}
                />
              </div>
              <div>
                <span>Premium</span>
                <AmountValue
                  value={premiumPercent(asset)}
                  symbol="%"
                  maximumFractionDigits={2}
                />
              </div>
              <div>
                <span>Supply</span>
                <AmountValue value={asset.supply} maximumFractionDigits={2} />
              </div>
            </div>
            <AddressValue
              value={asset.contract_address}
              label={`${asset.symbol} PreStocks mint`}
            />
            <a
              className="secondary-button"
              href={asset.external_url}
              target="_blank"
              rel="noreferrer"
            >
              Provider page
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PreStocksUnavailable({ message }: { message: string }) {
  return (
    <SponsorPanelState
      provider="PreStocks catalogue"
      icon={Buildings}
      status="error"
      title="Catalogue unavailable"
      description={`${message} Navis will not substitute tickers, stale addresses, or placeholder mints for PreStocks assets.`}
      headingId="prestocks-state-title"
    />
  );
}
