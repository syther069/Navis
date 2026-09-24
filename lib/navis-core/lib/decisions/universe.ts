import type { PreStocksResearchRow } from "../integrations/prestocks/research";

/**
 * Client-safe universe catalogue shared by the run panel, the API route and
 * the run service. "prestocks" is the default: the allowed mints and research
 * facts come from the validated PreStocks catalogue when it is reachable, and
 * the run falls back to the fixture universe with a visible note when it is
 * not.
 */
export type DecisionUniverseSource = "prestocks" | "fixture";

export const decisionUniverses: readonly {
  value: DecisionUniverseSource;
  label: string;
  description: string;
}[] = [
  {
    value: "prestocks",
    label: "PreStocks universe",
    description:
      "Allowed mints come from validated PreStocks contract addresses; token price, mark price, valuations and supply are used as research facts (not execution quotes). Falls back to the fixture universe with a note if the catalogue is unavailable.",
  },
  {
    value: "fixture",
    label: "Fixture universe",
    description:
      "Four explicitly fictional demo equity tokens with fixture prices and liquidity. No provider data is read.",
  },
];

export type UniverseAllocationPosition = Readonly<{
  mint: string;
  symbol: string;
  role: "rotation source" | "rotation target" | "held";
  /** Starting research holding, before the proposed trade. */
  startValueUsdMicros: string;
  /** Post-trade position: the holding moved by exactly the trade value. */
  valueUsdMicros: string;
  portfolioShareBps: number | null;
  impliedValuationShareBps: number | null;
}>;

export type PreStocksUniverseSummary = Readonly<{
  sourceUrl: string;
  capturedAt: string;
  assetCount: number;
  excluded: readonly Readonly<{ symbol: string; reason: string }>[];
  research: readonly PreStocksResearchRow[];
  allocation: Readonly<{
    portfolioValueUsdMicros: string;
    tradeValueUsdMicros: string;
    positions: readonly UniverseAllocationPosition[];
  }>;
  /** Which PreStocks fact fed each policy rule, keyed by rule id. */
  factsUsed: Readonly<Record<string, string>>;
}>;

export type DecisionUniverseSummary = Readonly<{
  requested: DecisionUniverseSource;
  used: DecisionUniverseSource;
  /** Present when the run did not use what was requested, or a caveat applies. */
  note: string | null;
  prestocks: PreStocksUniverseSummary | null;
}>;

export const FIXTURE_UNIVERSE_SUMMARY: DecisionUniverseSummary = Object.freeze({
  requested: "fixture",
  used: "fixture",
  note: null,
  prestocks: null,
});
