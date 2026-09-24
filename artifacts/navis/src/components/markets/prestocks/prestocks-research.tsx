import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import type { UniverseAllocationPosition } from "@/lib/decisions/universe";
import {
  describePremium,
  type PreStocksResearchRow,
} from "@/lib/integrations/prestocks/research";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function signedBps(bps: number | null) {
  if (bps === null) return "n/a";
  const pct = (bps / 100).toFixed(2);
  return bps > 0 ? `+${pct}%` : `${pct}%`;
}

function tone(bps: number | null): "neutral" | "warn" | "pass" {
  if (bps === null || bps === 0) return "neutral";
  return bps > 0 ? "warn" : "pass";
}

/**
 * Per-asset PreStocks research: token-price premium or discount to mark, mark
 * versus implied valuation, supply, and (when a run supplies one) the
 * concentration impact of the proposed allocation. Every figure is research
 * data from the catalogue read, never an execution quote.
 */
export function PreStocksResearchView({
  research,
  capturedAt,
  sourceUrl,
  positions = [],
  portfolioValueUsdMicros,
  excluded = [],
  headingId = "prestocks-research-title",
  eyebrow = "PreStocks research",
  title = "Premium, discount and valuation gap",
}: {
  research: readonly PreStocksResearchRow[];
  capturedAt: string;
  sourceUrl: string;
  positions?: readonly UniverseAllocationPosition[];
  portfolioValueUsdMicros?: string;
  excluded?: readonly Readonly<{ symbol: string; reason: string }>[];
  headingId?: string;
  eyebrow?: string;
  title?: string;
}) {
  const positionByMint = new Map(
    positions.map((position) => [position.mint, position]),
  );
  const hasAllocation = positions.length > 0;
  return (
    <section
      className="prestocks-research"
      aria-labelledby={headingId}
      data-testid="prestocks-research"
    >
      <div className="panel-heading">
        <div>
          <span>{eyebrow}</span>
          <h2 id={headingId}>{title}</h2>
        </div>
      </div>
      <div className="prestocks-source">
        <SourceStamp source="PreStocks catalogue read time" timestamp={capturedAt} />
        <StatusBadge tone="simulation">Research data, not execution quotes</StatusBadge>
      </div>
      <p className="route-copy">
        Source{" "}
        <a href={sourceUrl} rel="noreferrer" target="_blank">
          {sourceUrl}
        </a>
        . The timestamp is when Navis read the catalogue, not an upstream quote time;
        responses may be cached. Premium is token price against mark price; the
        valuation gap is implied valuation against mark valuation.
        {hasAllocation && portfolioValueUsdMicros
          ? ` Allocation impact is each research holding before and after the proposed trade (value for value at token prices, before slippage) as a share of the fictional ${(
              Number(portfolioValueUsdMicros) / 1_000_000
            ).toFixed(2)} USD research portfolio and of the asset's implied valuation.`
          : null}
      </p>
      <div className="prestocks-research-table-wrap">
        <table className="prestocks-research-table">
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col">Token price</th>
              <th scope="col">Mark price</th>
              <th scope="col">Premium / discount</th>
              <th scope="col">Mark valuation</th>
              <th scope="col">Implied valuation</th>
              <th scope="col">Valuation gap</th>
              <th scope="col">Supply</th>
              {hasAllocation ? <th scope="col">Proposed allocation</th> : null}
            </tr>
          </thead>
          <tbody>
            {research.map((row) => {
              const position = positionByMint.get(row.mint);
              return (
                <tr key={row.mint} data-testid={`prestocks-research-${row.symbol}`}>
                  <th scope="row">
                    <strong>{row.symbol}</strong>
                    <span>{row.name}</span>
                    <AddressValue value={row.mint} label={`${row.symbol} mint`} />
                  </th>
                  <td>{usd.format(row.tokenPriceUsd)}</td>
                  <td>{usd.format(row.markPriceUsd)}</td>
                  <td>
                    <StatusBadge tone={tone(row.premiumBps)}>
                      {describePremium(row.premiumBps)}
                    </StatusBadge>
                  </td>
                  <td>{compactUsd.format(row.markValuationUsd)}</td>
                  <td>{compactUsd.format(row.impliedValuationUsd)}</td>
                  <td>
                    {compactUsd.format(row.valuationGapUsd)}
                    <small>{signedBps(row.valuationGapBps)}</small>
                  </td>
                  <td>{plain.format(row.supply)}</td>
                  {hasAllocation ? (
                    <td>
                      {position ? (
                        <>
                          <strong>
                            {usd.format(
                              Number(position.startValueUsdMicros) / 1_000_000,
                            )}
                            {" to "}
                            {usd.format(Number(position.valueUsdMicros) / 1_000_000)}
                          </strong>
                          <small>
                            {position.role === "held"
                              ? "held, unchanged"
                              : position.role}
                            : {String(position.portfolioShareBps ?? "n/a")} bps of
                            portfolio,{" "}
                            {String(position.impliedValuationShareBps ?? "n/a")} bps of
                            implied valuation
                          </small>
                        </>
                      ) : (
                        <small>not held</small>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {excluded.length > 0 ? (
        <small className="prestocks-research-excluded">
          Excluded from the universe:{" "}
          {excluded.map((item) => `${item.symbol} (${item.reason})`).join("; ")}
        </small>
      ) : null}
    </section>
  );
}
