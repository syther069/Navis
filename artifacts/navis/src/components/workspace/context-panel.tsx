import { formatTimestamp, usdFromMicros } from "./lifecycle";
import { integrationRows } from "./integrations";
import { AvailabilityTag, EmptyNote } from "./primitives";
import type { DecisionRunResult, PublicCapabilities } from "./types";

export { integrationRows };

export function IntegrationList({ capabilities }: { capabilities: PublicCapabilities }) {
  return (
    <ul className="ws-integrations" data-testid="list-integrations">
      {integrationRows(capabilities).map((row) => (
        <li key={row.key} data-testid={`status-integration-${row.key}`}>
          <div>
            <strong>{row.name}</strong>
            <small>{row.detail}</small>
          </div>
          <AvailabilityTag value={row.value} label={row.label} />
        </li>
      ))}
    </ul>
  );
}

/** Market inputs actually used by the latest recorded decision. */
export function MarketSnapshot({ run }: { run: DecisionRunResult | null }) {
  if (!run) {
    return (
      <EmptyNote title="No market read recorded yet" testId="market-snapshot-empty">
        Market inputs are captured with each decision. Once a decision is recorded, its
        assets, prices and read time appear here.
      </EmptyNote>
    );
  }
  const fixture = run.universe.used === "fixture";
  const inputs = new Map(run.receipt.decision.context.marketInputs.map((input) => [input.mint, input]));
  const assets = run.receipt.decision.context.assets.slice(0, 6);
  const source = run.receipt.dataSource;
  return (
    <div className="ws-market" data-testid="market-snapshot">
      <p className="ws-market-source">
        <span className="ws-tag" data-kind={fixture ? "fixture" : "source"}>
          {fixture ? "Fictional fixture prices" : "Research facts"}
        </span>
        <span>
          {source ? `${source.source} · read ${formatTimestamp(source.capturedAt)}` : `Read ${formatTimestamp(run.generatedAt)}`}
        </span>
      </p>
      <table className="ws-table ws-table-compact">
        <caption className="sr-only">Assets and prices used by the latest decision</caption>
        <thead>
          <tr>
            <th scope="col">Asset</th>
            <th scope="col" data-numeric>
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.mint}>
              <th scope="row">
                <span className="ws-asset">
                  <strong>{asset.symbol}</strong>
                  <small>{asset.name}</small>
                </span>
              </th>
              <td data-numeric>
                {usdFromMicros(inputs.get(asset.mint)?.priceUsdMicros) ?? (
                  <span className="ws-muted">Unpriced</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {run.receipt.decision.context.assets.length > assets.length ? (
        <p className="ws-caption">
          {run.receipt.decision.context.assets.length - assets.length} more in the decision record.
        </p>
      ) : null}
    </div>
  );
}
