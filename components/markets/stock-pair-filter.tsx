"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

export type StockPairFilterItem = Readonly<{
  mint: string;
  symbol: string;
  name: string;
}>;

/**
 * Client-side ticker/name filter over the server-rendered tokenized-stock
 * group. Cards arrive fully rendered; the filter only hides the ones that do
 * not match, so grouping, classification and preflight eligibility stay
 * server-side.
 */
export function StockPairFilter({
  pairs,
  children,
}: {
  pairs: readonly StockPairFilterItem[];
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const visibleMints = useMemo(() => {
    if (!needle) return null;
    return new Set(
      pairs
        .filter(
          (pair) =>
            pair.symbol.toLowerCase().includes(needle) ||
            pair.name.toLowerCase().includes(needle),
        )
        .map((pair) => pair.mint),
    );
  }, [pairs, needle]);

  const shown = visibleMints ? visibleMints.size : pairs.length;

  return (
    <div className="pair-group" data-testid="clawpump-stock-pairs">
      <div className="pair-group-head">
        <span className="route-eyebrow">Tokenized stocks ({shown})</span>
        <input
          type="search"
          className="pair-filter-input"
          placeholder="Filter by ticker or name"
          aria-label="Filter tokenized stocks by ticker or name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="pair-list">
        {Children.map(children, (child) => {
          if (!visibleMints || !isValidElement(child)) return child;
          const mint = (child.props as Record<string, unknown>)["data-pair-mint"];
          if (typeof mint !== "string") return child;
          return cloneElement(child as ReactElement<Record<string, unknown>>, {
            hidden: !visibleMints.has(mint),
          });
        })}
      </div>
      {visibleMints && shown === 0 ? (
        <p className="pair-filter-empty">
          No tokenized stocks match &quot;{query.trim()}&quot;.
        </p>
      ) : null}
    </div>
  );
}
