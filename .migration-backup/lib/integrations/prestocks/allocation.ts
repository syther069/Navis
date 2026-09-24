import type { PreStocksUniverse } from "./research";

/**
 * Allocation simulation for the PreStocks research portfolio. Everything here
 * is integer arithmetic in USD micros and token base units so the proposal
 * amount, the research price, the trade value and the post-trade positions
 * reconcile exactly; nothing is taken from the scenario except the intended
 * trade size, and the proposal is what is finally measured.
 */

const BPS = BigInt(10_000);

export type PreStocksHolding = Readonly<{
  mint: string;
  symbol: string;
  decimals: number;
  rawAmount: string;
  priceUsdMicros: string;
  valueUsdMicros: string;
}>;

export type PreStocksPosition = Readonly<{
  mint: string;
  symbol: string;
  rawAmount: string;
  valueUsdMicros: string;
}>;

export type RotationSimulation = Readonly<{
  /** Sum of the priced holdings before the trade. */
  portfolioValueUsdMicros: string;
  /** Proposal input amount valued at the research price of the input mint. */
  tradeValueUsdMicros: string;
  /** Every holding after a value-for-value rotation at research prices. */
  postPositions: readonly PreStocksPosition[];
  input: Readonly<{ mint: string; rawAmount: string; heldRawAmount: string }> | null;
}>;

export class InfeasibleProposalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfeasibleProposalError";
  }
}

export function scaleOf(decimals: number) {
  return BigInt(10) ** BigInt(decimals);
}

/** Value of `rawAmount` base units at `priceUsdMicros` per whole token. */
export function valueUsdMicros(
  rawAmount: bigint,
  decimals: number,
  priceUsdMicros: bigint,
): bigint {
  return (rawAmount * priceUsdMicros) / scaleOf(decimals);
}

/** Largest whole number of base units worth at most `usdMicros`. */
export function rawAmountForUsd(
  usdMicros: bigint,
  decimals: number,
  priceUsdMicros: bigint,
): bigint {
  if (priceUsdMicros <= BigInt(0)) return BigInt(0);
  return (usdMicros * scaleOf(decimals)) / priceUsdMicros;
}

export type HoldingWeights = Readonly<{
  sourceBps: number;
  targetBps: number;
  otherBps: number;
}>;

/**
 * Starting weights for the research portfolio, derived from the agent's own
 * policy so the same two scenarios behave the same way for any policy:
 * the rotation source holds enough to fund the oversized trade (2.5x the
 * trade limit) and still sit under the position limit after a balanced
 * trade; the rotation target starts at a quarter of the position limit; the
 * remaining assets share what is left equally.
 */
export function holdingWeights(
  limits: Readonly<{ maxTradeBps: number; maxPositionBps: number }>,
  assetCount: number,
): HoldingWeights {
  const sourceBps = Math.min(10_000, Math.round(limits.maxTradeBps * 2.5));
  const targetBps = Math.min(
    10_000 - sourceBps,
    Math.max(1, Math.floor(limits.maxPositionBps / 4)),
  );
  const others = Math.max(0, assetCount - 2);
  const otherBps =
    others === 0 ? 0 : Math.floor((10_000 - sourceBps - targetBps) / others);
  return { sourceBps, targetBps, otherBps };
}

/**
 * Fictional research holdings for every usable PreStocks asset, sized from
 * `referenceUsdMicros` by the policy-derived weights. Quantities are whole
 * base units and each value is recomputed from that quantity at the catalogue
 * token price, so no holding carries a value the price cannot support.
 */
export function planHoldings(
  universe: PreStocksUniverse,
  weights: HoldingWeights,
  referenceUsdMicros: bigint,
): PreStocksHolding[] {
  return universe.research.map((row, index) => {
    const asset = universe.assets[index];
    if (!asset || asset.mint !== row.mint) {
      throw new Error("PreStocks universe assets and research rows are out of order.");
    }
    const weightBps =
      index === 0
        ? weights.sourceBps
        : index === 1
          ? weights.targetBps
          : weights.otherBps;
    const priceUsdMicros = usdToMicros(row.tokenPriceUsd);
    const targetUsdMicros = (referenceUsdMicros * BigInt(weightBps)) / BPS;
    const rawAmount = rawAmountForUsd(targetUsdMicros, asset.decimals, priceUsdMicros);
    const held = rawAmount > BigInt(0) ? rawAmount : BigInt(1);
    return {
      mint: row.mint,
      symbol: row.symbol,
      decimals: asset.decimals,
      rawAmount: held.toString(),
      priceUsdMicros: priceUsdMicros.toString(),
      valueUsdMicros: valueUsdMicros(held, asset.decimals, priceUsdMicros).toString(),
    };
  });
}

/** USD number from the catalogue to integer micros (truncated, never negative). */
export function usdToMicros(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) return BigInt(0);
  return BigInt(Math.floor(usd * 1_000_000));
}

export function portfolioValue(holdings: readonly PreStocksHolding[]) {
  return holdings.reduce(
    (sum, holding) => sum + BigInt(holding.valueUsdMicros),
    BigInt(0),
  );
}

/**
 * Apply a proposal to the holdings. The input amount is valued at the input
 * mint's research price; the output position grows by the same value (a
 * value-for-value rotation at research prices, before slippage), so the
 * portfolio total is unchanged and every post-trade position is the starting
 * holding plus or minus exactly that trade. A proposal that sells more than
 * the portfolio holds, or a mint it does not hold, is infeasible and refused.
 */
export function simulateRotation(
  holdings: readonly PreStocksHolding[],
  proposal:
    | Readonly<{ action: "HOLD" }>
    | Readonly<{
        action: string;
        inputMint: string;
        outputMint: string;
        inputAmount: Readonly<{ rawAmount: string; decimals: number }>;
      }>,
): RotationSimulation {
  const total = portfolioValue(holdings);
  if (proposal.action === "HOLD" || !("inputMint" in proposal)) {
    return {
      portfolioValueUsdMicros: total.toString(),
      tradeValueUsdMicros: "0",
      postPositions: holdings.map(position),
      input: null,
    };
  }
  const source = holdings.find((holding) => holding.mint === proposal.inputMint);
  const target = holdings.find((holding) => holding.mint === proposal.outputMint);
  if (!source) {
    throw new InfeasibleProposalError(
      `Proposal sells ${proposal.inputMint}, which the research portfolio does not hold.`,
    );
  }
  if (!target) {
    throw new InfeasibleProposalError(
      `Proposal buys ${proposal.outputMint}, which is outside the research portfolio.`,
    );
  }
  if (proposal.inputAmount.decimals !== source.decimals) {
    throw new InfeasibleProposalError(
      "Proposal amount decimals do not match the holding.",
    );
  }
  const sold = BigInt(proposal.inputAmount.rawAmount);
  const held = BigInt(source.rawAmount);
  if (sold > held) {
    throw new InfeasibleProposalError(
      `Proposal sells ${sold.toString()} base units of ${source.symbol} but the research portfolio holds only ${held.toString()}.`,
    );
  }
  const tradeValue = valueUsdMicros(
    sold,
    source.decimals,
    BigInt(source.priceUsdMicros),
  );
  const bought = rawAmountForUsd(
    tradeValue,
    target.decimals,
    BigInt(target.priceUsdMicros),
  );
  const postPositions = holdings.map((holding) => {
    if (holding.mint === source.mint) {
      return {
        mint: holding.mint,
        symbol: holding.symbol,
        rawAmount: (held - sold).toString(),
        valueUsdMicros: (BigInt(holding.valueUsdMicros) - tradeValue).toString(),
      };
    }
    if (holding.mint === target.mint) {
      return {
        mint: holding.mint,
        symbol: holding.symbol,
        rawAmount: (BigInt(holding.rawAmount) + bought).toString(),
        valueUsdMicros: (BigInt(holding.valueUsdMicros) + tradeValue).toString(),
      };
    }
    return position(holding);
  });
  return {
    portfolioValueUsdMicros: total.toString(),
    tradeValueUsdMicros: tradeValue.toString(),
    postPositions,
    input: {
      mint: source.mint,
      rawAmount: sold.toString(),
      heldRawAmount: held.toString(),
    },
  };
}

function position(holding: PreStocksHolding): PreStocksPosition {
  return {
    mint: holding.mint,
    symbol: holding.symbol,
    rawAmount: holding.rawAmount,
    valueUsdMicros: holding.valueUsdMicros,
  };
}

/** Decimal string for a raw amount, without exponent notation. */
export function formatUiAmount(rawAmount: bigint, decimals: number) {
  const digits = rawAmount.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals) || "0";
  const fraction = decimals === 0 ? "" : digits.slice(digits.length - decimals);
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}
