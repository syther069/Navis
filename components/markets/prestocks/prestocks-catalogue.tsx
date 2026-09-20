import { Buildings, WarningCircle } from "@phosphor-icons/react/dist/ssr";

import { AddressValue } from "@/components/shared/address-value";
import {
  AmountValue,
  SourceStamp,
  StatusBadge,
} from "@/components/shared/domain-primitives";
import type { PreStocksCatalogue } from "@/lib/integrations/prestocks/client";

type PreStocksCatalogueProps = {
  catalogue: PreStocksCatalogue;
};

function premiumPercent(asset: PreStocksCatalogue["assets"][number]) {
  if (asset.markPrice <= 0) return null;
  return ((asset.tokenPrice - asset.markPrice) / asset.markPrice) * 100;
}

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
          source="PreStocks /api/prestocks"
          timestamp={catalogue.capturedAt}
        />
        <StatusBadge tone="warn">Eligibility gated</StatusBadge>
      </div>

      <div className="prestocks-grid">
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
    <section className="route-panel route-panel-muted prestocks-panel">
      <div className="panel-heading">
        <Buildings aria-hidden="true" size={20} />
        <div>
          <span>PreStocks catalogue</span>
          <h2>Catalogue unavailable</h2>
        </div>
      </div>
      <p className="route-copy">
        {message} Navis will not substitute tickers, stale addresses, or placeholder
        mints for PreStocks assets.
      </p>
    </section>
  );
}
