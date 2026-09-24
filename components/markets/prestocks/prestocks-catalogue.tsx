"use client";

import { Buildings, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { Fragment, useState } from "react";

import { SponsorPanelState } from "@/components/markets/sponsor-panel-state";
import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import type { PreStocksCatalogue } from "@/lib/integrations/prestocks/client";
import { describePremium, researchRow } from "@/lib/integrations/prestocks/research";

type Asset = PreStocksCatalogue["assets"][number];

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantityFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const valuationFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

function Missing({ reason }: { reason: string }) {
  return (
    <span className="unavailable" aria-label={`Unavailable: ${reason}`} title={reason}>
      —
    </span>
  );
}

function Price({ value }: { value: number | null }) {
  return value === null || !Number.isFinite(value) ? (
    <Missing reason="not provided by source" />
  ) : (
    <span>{priceFormat.format(value)}</span>
  );
}

function MarketDetail({
  asset,
  catalogue,
  onClose,
}: {
  asset: Asset;
  catalogue: PreStocksCatalogue;
  onClose: () => void;
}) {
  const research = researchRow(asset);
  return (
    <section className="prestocks-detail" aria-labelledby="prestocks-detail-title">
      <div className="prestocks-detail-head">
        <div>
          <span className="prestocks-overline">Market detail / {asset.symbol}</span>
          <h3 id="prestocks-detail-title">{asset.name}</h3>
          <span className="prestocks-detail-symbol">{asset.symbol}</span>
        </div>
        <button className="prestocks-close" type="button" onClick={onClose}>
          Close detail
        </button>
      </div>
      <p className="prestocks-detail-description">{asset.description}</p>
      <div className="prestocks-detail-metrics">
        <div>
          <span>Token price</span>
          <strong>
            <Price value={asset.tokenPrice} />
          </strong>
        </div>
        <div>
          <span>Mark price</span>
          <strong>
            <Price value={asset.markPrice} />
          </strong>
        </div>
        <div>
          <span>
            Premium / discount{" "}
            <InfoHint topic="atlasSignal" label="About the premium signal" />
          </span>
          <strong>
            {research.premiumBps === null ? (
              <Missing reason="mark price is zero; premium cannot be computed" />
            ) : (
              describePremium(research.premiumBps)
            )}
          </strong>
        </div>
        <div>
          <span>Supply</span>
          <strong>{quantityFormat.format(asset.supply)}</strong>
        </div>
      </div>
      <div className="prestocks-detail-research">
        <div className="prestocks-detail-subhead">
          <span>Research / valuation context</span>
          <InfoHint topic="marketSource" label="About market research sources" />
        </div>
        <dl>
          <div>
            <dt>Mark valuation</dt>
            <dd>{valuationFormat.format(research.markValuationUsd)}</dd>
          </div>
          <div>
            <dt>Implied valuation</dt>
            <dd>{valuationFormat.format(research.impliedValuationUsd)}</dd>
          </div>
          <div>
            <dt>Valuation gap</dt>
            <dd>{valuationFormat.format(research.valuationGapUsd)}</dd>
          </div>
        </dl>
        <p>
          Premium compares token price with mark price; valuation gap compares implied
          valuation with mark valuation. Research only, not an execution quote.
        </p>
        <p>
          The Atlas demo run on <Link href="/agents/atlas">/agents/atlas</Link> can use
          this catalogue as its asset universe. Its run result shows allocation impact;
          no PreStocks execution path exists.
        </p>
      </div>
      <div className="prestocks-detail-provenance">
        <div>
          <span>Mint address</span>
          <AddressValue
            value={asset.contract_address}
            label={`${asset.symbol} PreStocks mint`}
          />
        </div>
        <div>
          <span>Source / read time</span>
          <SourceStamp
            source="PreStocks catalogue read time"
            timestamp={catalogue.capturedAt}
          />
        </div>
        <a href={asset.external_url} target="_blank" rel="noreferrer">
          Open provider page ↗
        </a>
      </div>
    </section>
  );
}

export function PreStocksCatalogue({ catalogue }: { catalogue: PreStocksCatalogue }) {
  const [selectedMint, setSelectedMint] = useState<string | null>(null);

  return (
    <section className="route-panel prestocks-panel" aria-labelledby="prestocks-title">
      <div className="prestocks-heading">
        <div className="panel-heading">
          <Buildings aria-hidden="true" size={20} />
          <div>
            <span>PreStocks / read-only market data</span>
            <h2 id="prestocks-title">Economic-exposure tokens</h2>
          </div>
        </div>
        <span className="prestocks-count">{catalogue.assets.length} assets</span>
      </div>

      <div className="prestocks-source">
        <SourceStamp
          source="PreStocks catalogue read time"
          timestamp={catalogue.capturedAt}
        />
        <StatusBadge tone="warn">Eligibility gated</StatusBadge>
      </div>
      <p className="prestocks-freshness">
        This is Navis&apos;s catalogue read time, not a verified quote timestamp.
        Responses may be cached; upstream price freshness is unknown. Prices are for
        research, not execution quotes.
      </p>
      <div className="prestocks-disclosure">
        <WarningCircle aria-hidden="true" size={18} />
        <p>
          PreStocks are presented read-only in Navis. They provide economic exposure
          only, not company ownership, voting, dividend, information, or other legal
          rights. The provider discloses that they are risky, may lose all value, and
          are not available to U.S. persons or other ineligible persons.
        </p>
      </div>

      <div className="data-table-wrap prestocks-table-wrap">
        <table className="data-table prestocks-table">
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col">Symbol</th>
              <th scope="col" className="num">
                Price
              </th>
              <th scope="col" className="num">
                Change
              </th>
              <th scope="col">Timestamp</th>
              <th scope="col">
                Source <InfoHint topic="marketSource" label="About market sources" />
              </th>
              <th scope="col" className="num">
                Premium vs mark{" "}
                <InfoHint topic="atlasSignal" label="About the premium signal" />
              </th>
              <th scope="col">
                Risk <InfoHint topic="marketRisk" label="About market risk" />
              </th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {catalogue.assets.map((asset, index) => {
              const research = researchRow(asset);
              const active = selectedMint === asset.contract_address;
              return (
                <Fragment key={asset.contract_address}>
                  <tr data-selected={active || undefined}>
                    <th scope="row" data-label="Asset">
                      <button
                        className="prestocks-asset-button"
                        type="button"
                        onClick={() =>
                          setSelectedMint(active ? null : asset.contract_address)
                        }
                        aria-expanded={active}
                        aria-controls={active ? "prestocks-market-detail" : undefined}
                      >
                        <span className="prestocks-row-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{asset.name}</span>
                      </button>
                    </th>
                    <td data-label="Symbol" className="prestocks-symbol">
                      {asset.symbol}
                    </td>
                    <td data-label="Price" className="num">
                      <Price value={asset.tokenPrice} />
                    </td>
                    <td data-label="Change" className="num">
                      <Missing reason="not provided by source" />
                    </td>
                    <td data-label="Timestamp" className="prestocks-timestamp">
                      <time
                        dateTime={catalogue.capturedAt}
                        title="Catalogue read time; upstream quote time unavailable"
                      >
                        {new Date(catalogue.capturedAt).toLocaleString("en-US", {
                          timeZone: "UTC",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}{" "}
                        UTC
                      </time>
                    </td>
                    <td data-label="Source">
                      <span className="prestocks-provider">PreStocks</span>
                    </td>
                    <td data-label="Premium vs mark" className="num">
                      {research.premiumBps === null ? (
                        <Missing reason="mark price is zero; premium cannot be computed" />
                      ) : (
                        <span
                          className="prestocks-signal"
                          data-direction={
                            research.premiumBps > 0
                              ? "premium"
                              : research.premiumBps < 0
                                ? "discount"
                                : "mark"
                          }
                        >
                          {describePremium(research.premiumBps)}
                        </span>
                      )}
                    </td>
                    <td data-label="Risk">
                      <span className="prestocks-risk">
                        Eligibility gated
                        <br />
                        Economic exposure only
                      </span>
                    </td>
                    <td data-label="Action">
                      <button
                        className="prestocks-details-button"
                        type="button"
                        onClick={() =>
                          setSelectedMint(active ? null : asset.contract_address)
                        }
                        aria-expanded={active}
                        aria-controls={active ? "prestocks-market-detail" : undefined}
                      >
                        {active ? "Hide details" : "Details"}{" "}
                        <span aria-hidden="true">↗</span>
                      </button>
                    </td>
                  </tr>
                  {active ? (
                    <tr className="prestocks-expanded">
                      <td colSpan={9} id="prestocks-market-detail">
                        <MarketDetail
                          asset={asset}
                          catalogue={catalogue}
                          onClose={() => setSelectedMint(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="prestocks-table-foot">
        <span>
          Source{" "}
          <a href={catalogue.sourceUrl} target="_blank" rel="noreferrer">
            PreStocks catalogue ↗
          </a>
        </span>
        <span>
          Change not provided by source · Premium calculated from token / mark prices
        </span>
      </div>
    </section>
  );
}

export function PreStocksUnavailable({ message }: { message: string }) {
  let detail = message;
  try {
    const parsed: unknown = JSON.parse(message);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const issues = parsed.filter(
        (item): item is { path: (string | number)[]; message: string } =>
          item !== null &&
          typeof item === "object" &&
          "path" in item &&
          Array.isArray(item.path) &&
          "message" in item &&
          typeof item.message === "string",
      );
      if (issues.length === parsed.length) {
        const examples = issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        detail = `Provider catalogue validation failed on ${issues.length} field${issues.length === 1 ? "" : "s"} (${examples}${issues.length > 3 ? `; ${issues.length - 3} more` : ""}).`;
      }
    }
  } catch {
    // Preserve the provider error verbatim when it is not a validation issue list.
  }
  return (
    <SponsorPanelState
      provider="PreStocks catalogue"
      icon={Buildings}
      status="error"
      title="Catalogue unavailable"
      description={`${detail} Navis will not substitute tickers, stale addresses, or placeholder mints for PreStocks assets.`}
      headingId="prestocks-state-title"
    />
  );
}
