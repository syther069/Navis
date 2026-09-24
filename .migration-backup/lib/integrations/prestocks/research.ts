/**
 * Pure PreStocks research maths. Every figure here is derived from validated
 * catalogue fields (token price, mark price, mark valuation, implied
 * valuation, supply) and is research data, never an execution quote. Nothing
 * in this module reads the network or the environment, so it is safe for
 * client components and unit tests alike.
 */
import { assetSchema, type Asset, type SolanaCluster } from "../../domain";
import type { PreStocksAsset } from "./schemas";

export type PreStocksCatalogueLike = Readonly<{
  assets: readonly PreStocksAsset[];
  sourceUrl: string;
  capturedAt: string;
}>;

/**
 * The catalogue does not publish decimals. Live PreStocks mints are Token-2022
 * mints with 9 decimals (read onchain on mainnet, recorded in
 * docs/INTEGRATIONS.md). Fictional demo quantities use that figure; a live
 * agent must still read the mint account before any value moves.
 */
export const PRESTOCKS_TOKEN_DECIMALS = 9;
export const PRESTOCKS_ASSET_SOURCE = "prestocks_catalogue";
export const PRESTOCKS_CLUSTER: SolanaCluster = "mainnet-beta";

const BPS = 10_000;
const USD_MICROS = 1_000_000;

function finiteOrNull(value: number) {
  return Number.isFinite(value) ? value : null;
}

/** Signed basis points of token price above (+) or below (-) mark price. */
export function premiumBps(tokenPrice: number, markPrice: number): number | null {
  if (!(markPrice > 0) || !Number.isFinite(tokenPrice)) return null;
  return finiteOrNull(Math.round(((tokenPrice - markPrice) / markPrice) * BPS));
}

/** Implied valuation minus mark valuation, in USD and signed basis points of mark. */
export function valuationGap(
  markValuation: number,
  impliedValuation: number,
): Readonly<{ usd: number; bps: number | null }> {
  const usd = impliedValuation - markValuation;
  const bps =
    markValuation > 0 ? finiteOrNull(Math.round((usd / markValuation) * BPS)) : null;
  return { usd, bps };
}

/**
 * Concentration impact of putting `allocationUsd` into one asset: its share of
 * the portfolio and its share of the asset's implied valuation (both in bps,
 * rounded up so a limit breach is never rounded away).
 */
export function concentrationImpact({
  allocationUsd,
  portfolioUsd,
  impliedValuationUsd,
}: Readonly<{
  allocationUsd: number;
  portfolioUsd: number;
  impliedValuationUsd: number;
}>): Readonly<{ portfolioShareBps: number | null; valuationShareBps: number | null }> {
  const share = (numerator: number, denominator: number) =>
    denominator > 0 && numerator >= 0
      ? finiteOrNull(Math.ceil((numerator / denominator) * BPS))
      : null;
  return {
    portfolioShareBps: share(allocationUsd, portfolioUsd),
    valuationShareBps: share(allocationUsd, impliedValuationUsd),
  };
}

export type PreStocksResearchRow = Readonly<{
  symbol: string;
  name: string;
  mint: string;
  tokenPriceUsd: number;
  markPriceUsd: number;
  premiumBps: number | null;
  markValuationUsd: number;
  impliedValuationUsd: number;
  valuationGapUsd: number;
  valuationGapBps: number | null;
  supply: number;
  externalUrl: string;
}>;

export function researchRow(asset: PreStocksAsset): PreStocksResearchRow {
  const gap = valuationGap(asset.markValuation, asset.impliedValuation);
  return {
    symbol: asset.symbol,
    name: asset.name,
    mint: asset.contract_address,
    tokenPriceUsd: asset.tokenPrice,
    markPriceUsd: asset.markPrice,
    premiumBps: premiumBps(asset.tokenPrice, asset.markPrice),
    markValuationUsd: asset.markValuation,
    impliedValuationUsd: asset.impliedValuation,
    valuationGapUsd: gap.usd,
    valuationGapBps: gap.bps,
    supply: asset.supply,
    externalUrl: asset.external_url,
  };
}

export type PreStocksUniverse = Readonly<{
  source: "prestocks";
  sourceUrl: string;
  capturedAt: string;
  /** Domain assets ordered richest premium first, deepest discount second. */
  assets: readonly Asset[];
  allowedMints: readonly string[];
  research: readonly PreStocksResearchRow[];
  excluded: readonly Readonly<{ symbol: string; reason: string }>[];
}>;

export class PreStocksUniverseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreStocksUniverseError";
  }
}

/** USD price as integer micros; null when the price cannot be a research fact. */
export function usdMicros(value: number): string | null {
  if (!(value > 0) || !Number.isFinite(value)) return null;
  return String(Math.round(value * USD_MICROS));
}

/**
 * Orders research rows so the deterministic demo provider (which rebalances
 * the first asset into the second) rotates the richest premium into the
 * deepest discount. Ties fall back to symbol order for a stable result.
 */
export function orderByPremiumSignal(
  rows: readonly PreStocksResearchRow[],
): PreStocksResearchRow[] {
  const bySymbol = (a: PreStocksResearchRow, b: PreStocksResearchRow) =>
    a.symbol.localeCompare(b.symbol);
  const priced = rows.filter((row) => row.premiumBps !== null);
  if (priced.length < 2) return [...rows].sort(bySymbol);
  const sorted = [...priced].sort(
    (a, b) => (b.premiumBps ?? 0) - (a.premiumBps ?? 0) || bySymbol(a, b),
  );
  const richest = sorted[0]!;
  const deepest = sorted[sorted.length - 1]!;
  const rest = sorted.slice(1, -1);
  const unpriced = rows.filter((row) => row.premiumBps === null).sort(bySymbol);
  return [richest, deepest, ...rest, ...unpriced];
}

/**
 * Builds the allowed universe from validated catalogue rows. Each asset must
 * pass the domain asset schema (real mint, symbol shape, name length) and
 * carry a positive token price and mark price; anything else is excluded with
 * a reason rather than patched. Fewer than two usable assets is a failure so
 * the caller falls back visibly instead of inventing a pair.
 */
export function buildPreStocksUniverse(
  catalogue: PreStocksCatalogueLike,
): PreStocksUniverse {
  const excluded: { symbol: string; reason: string }[] = [];
  const rows: PreStocksResearchRow[] = [];
  const seen = new Set<string>();
  for (const asset of catalogue.assets) {
    if (seen.has(asset.contract_address)) {
      excluded.push({ symbol: asset.symbol, reason: "Duplicate contract address." });
      continue;
    }
    if (!(asset.tokenPrice > 0) || !(asset.markPrice > 0)) {
      excluded.push({
        symbol: asset.symbol,
        reason:
          "Token price or mark price is not positive, so no premium can be computed.",
      });
      continue;
    }
    const parsed = assetSchema.safeParse({
      id: `prestocks_${asset.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      mint: asset.contract_address,
      isDemo: false,
      cluster: PRESTOCKS_CLUSTER,
      symbol: asset.symbol.toUpperCase(),
      name: asset.name,
      decimals: PRESTOCKS_TOKEN_DECIMALS,
      issuer: "PreStocks",
      source: PRESTOCKS_ASSET_SOURCE,
      sourceTimestamp: catalogue.capturedAt,
      verificationState: "provider_verified",
    });
    if (!parsed.success) {
      excluded.push({
        symbol: asset.symbol,
        reason: `Catalogue row does not fit the Navis asset schema: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      });
      continue;
    }
    seen.add(asset.contract_address);
    rows.push(researchRow(asset));
  }
  const ordered = orderByPremiumSignal(rows).slice(0, 32);
  if (ordered.length < 2) {
    throw new PreStocksUniverseError(
      `PreStocks catalogue yielded ${ordered.length} usable asset(s); at least two are required for a research universe.`,
    );
  }
  const byMint = new Map(rows.map((row) => [row.mint, row]));
  const assets = ordered.map((row) => {
    const source = byMint.get(row.mint)!;
    return assetSchema.parse({
      id: `prestocks_${source.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      mint: source.mint,
      isDemo: false,
      cluster: PRESTOCKS_CLUSTER,
      symbol: source.symbol.toUpperCase(),
      name: source.name,
      decimals: PRESTOCKS_TOKEN_DECIMALS,
      issuer: "PreStocks",
      source: PRESTOCKS_ASSET_SOURCE,
      sourceTimestamp: catalogue.capturedAt,
      verificationState: "provider_verified",
    });
  });
  return {
    source: "prestocks",
    sourceUrl: catalogue.sourceUrl,
    capturedAt: catalogue.capturedAt,
    assets,
    allowedMints: assets.map((asset) => asset.mint),
    research: ordered,
    excluded,
  };
}

/** Formats signed bps as a human premium/discount label. */
export function describePremium(bps: number | null) {
  if (bps === null) return "not computable";
  if (bps === 0) return "at mark";
  const pct = (Math.abs(bps) / 100).toFixed(2);
  return bps > 0 ? `${pct}% premium` : `${pct}% discount`;
}
