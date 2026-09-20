import { describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import {
  formatUiAmount,
  holdingWeights,
  InfeasibleProposalError,
  planHoldings,
  rawAmountForUsd,
  simulateRotation,
  valueUsdMicros,
} from "../lib/integrations/prestocks/allocation";
import {
  buildPreStocksUniverse,
  concentrationImpact,
  describePremium,
  orderByPremiumSignal,
  premiumBps,
  researchRow,
  valuationGap,
  type PreStocksCatalogueLike,
} from "../lib/integrations/prestocks/research";
import type { PreStocksAsset } from "../lib/integrations/prestocks/schemas";
import { DemoDecisionProvider } from "../lib/integrations/ai/demo";
import { verifyProofReceipt } from "../lib/proofs/receipt";
import { runDecision } from "../lib/services/run-decision";

// Fresh enough for the Atlas 300-second data-age rule at run time.
const capturedAt = new Date(Date.now() - 5_000).toISOString();

function asset(
  overrides: Partial<PreStocksAsset> & { symbol: string },
): PreStocksAsset {
  return {
    name: `${overrides.symbol} PreStocks`,
    description: "Economic exposure only.",
    image: "https://prestocks.com/token.png",
    external_url: `https://prestocks.com/products/${overrides.symbol.toLowerCase()}`,
    contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    markPrice: 100,
    markValuation: 1_000_000_000,
    tokenPrice: 110,
    impliedValuation: 1_100_000_000,
    supply: 10_000_000,
    ...overrides,
  };
}

const catalogue: PreStocksCatalogueLike = {
  sourceUrl: "https://prestocks.com/api/prestocks",
  capturedAt,
  assets: [
    asset({
      symbol: "SPACEX",
      contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
      markPrice: 150,
      tokenPrice: 120,
      markValuation: 2_000_000_000_000,
      impliedValuation: 1_600_000_000_000,
    }),
    asset({
      symbol: "OPENAI",
      contract_address: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
      markPrice: 1_000,
      tokenPrice: 1_120,
      markValuation: 1_200_000_000_000,
      impliedValuation: 1_344_000_000_000,
    }),
    asset({
      symbol: "KALSHI",
      contract_address: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
      markPrice: 900,
      tokenPrice: 900,
    }),
    asset({
      symbol: "ANDURIL",
      contract_address: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
      markPrice: 154,
      tokenPrice: 160,
    }),
    asset({
      symbol: "POLYMARKET",
      contract_address: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP",
      markPrice: 143.84,
      tokenPrice: 144.15,
    }),
  ],
};
const usableAssets = catalogue.assets.length;

describe("PreStocks research maths", () => {
  it("computes signed premium and discount in basis points", () => {
    expect(premiumBps(110, 100)).toBe(1_000);
    expect(premiumBps(120, 150)).toBe(-2_000);
    expect(premiumBps(100, 100)).toBe(0);
    expect(premiumBps(100, 0)).toBeNull();
    expect(describePremium(1_000)).toBe("10.00% premium");
    expect(describePremium(-2_000)).toBe("20.00% discount");
    expect(describePremium(0)).toBe("at mark");
    expect(describePremium(null)).toBe("not computable");
  });

  it("computes the mark versus implied valuation gap", () => {
    expect(valuationGap(1_000, 1_250)).toEqual({ usd: 250, bps: 2_500 });
    expect(valuationGap(1_000, 800)).toEqual({ usd: -200, bps: -2_000 });
    expect(valuationGap(0, 800)).toEqual({ usd: 800, bps: null });
  });

  it("rounds concentration shares up and refuses impossible denominators", () => {
    expect(
      concentrationImpact({
        allocationUsd: 70,
        portfolioUsd: 400,
        impliedValuationUsd: 1_000_000,
      }),
    ).toEqual({ portfolioShareBps: 1_750, valuationShareBps: 1 });
    expect(
      concentrationImpact({
        allocationUsd: 1,
        portfolioUsd: 0,
        impliedValuationUsd: 0,
      }),
    ).toEqual({ portfolioShareBps: null, valuationShareBps: null });
  });

  it("orders richest premium first and deepest discount second", () => {
    const ordered = orderByPremiumSignal(catalogue.assets.map(researchRow));
    expect(ordered.map((row) => row.symbol).slice(0, 2)).toEqual(["OPENAI", "SPACEX"]);
    expect(ordered.map((row) => row.symbol)).toContain("KALSHI");
  });
});

describe("PreStocks universe construction", () => {
  it("builds provider-verified assets and the allowlist from contract addresses", () => {
    const universe = buildPreStocksUniverse(catalogue);
    expect(universe.allowedMints.slice(0, 2)).toEqual([
      "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
      "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    ]);
    expect(universe.allowedMints).toContain(
      "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
    );
    expect(universe.allowedMints).toHaveLength(usableAssets);
    expect(
      universe.assets.every((item) => item.verificationState === "provider_verified"),
    ).toBe(true);
    expect(universe.assets.every((item) => item.isDemo === false)).toBe(true);
    expect(universe.assets[0]?.sourceTimestamp).toBe(capturedAt);
    expect(universe.excluded).toEqual([]);
  });

  it("excludes rows it cannot use instead of patching them", () => {
    const universe = buildPreStocksUniverse({
      ...catalogue,
      assets: [
        ...catalogue.assets,
        asset({
          symbol: "ZEROMARK",
          contract_address: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
          markPrice: 0,
        }),
        asset({
          symbol: "too long symbol!",
          contract_address: "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S",
        }),
        asset({ symbol: "DUPLICATE" }),
      ],
    });
    expect(universe.assets).toHaveLength(usableAssets);
    expect(universe.excluded.map((item) => item.symbol)).toEqual([
      "ZEROMARK",
      "too long symbol!",
      "DUPLICATE",
    ]);
  });

  it("fails when fewer than two assets are usable", () => {
    expect(() =>
      buildPreStocksUniverse({ ...catalogue, assets: catalogue.assets.slice(0, 1) }),
    ).toThrow(/at least two/);
  });
});

describe("PreStocks allocation simulation", () => {
  const universe = buildPreStocksUniverse(catalogue);
  const weights = holdingWeights({ maxTradeBps: 1_000, maxPositionBps: 3_500 }, 5);
  const holdings = planHoldings(universe, weights, BigInt("400000000"));

  it("weights the source to fund the oversized trade and keeps the rest under the position limit", () => {
    expect(weights).toEqual({ sourceBps: 2_500, targetBps: 875, otherBps: 2_208 });
    expect(holdings.map((h) => h.symbol).slice(0, 2)).toEqual(["OPENAI", "SPACEX"]);
    expect(holdings).toHaveLength(5);
    // 100 USD of OPENAI at 1,120 USD per token, whole base units, value recomputed.
    expect(holdings[0]).toMatchObject({
      rawAmount: rawAmountForUsd(
        BigInt("100000000"),
        9,
        BigInt("1120000000"),
      ).toString(),
      priceUsdMicros: "1120000000",
    });
    for (const holding of holdings) {
      expect(BigInt(holding.valueUsdMicros)).toBe(
        valueUsdMicros(BigInt(holding.rawAmount), 9, BigInt(holding.priceUsdMicros)),
      );
      expect(BigInt(holding.valueUsdMicros) <= BigInt("400000000")).toBe(true);
    }
  });

  it("moves exactly the trade value between source and target and keeps the total", () => {
    const sold = rawAmountForUsd(BigInt("20000000"), 9, BigInt("1120000000"));
    const result = simulateRotation(holdings, {
      action: "REBALANCE",
      inputMint: holdings[0]!.mint,
      outputMint: holdings[1]!.mint,
      inputAmount: { rawAmount: sold.toString(), decimals: 9 },
    });
    const trade = BigInt(result.tradeValueUsdMicros);
    expect(trade).toBe(valueUsdMicros(sold, 9, BigInt("1120000000")));
    expect(trade <= BigInt("20000000") && trade > BigInt("19990000")).toBe(true);
    const [source, target, ...rest] = result.postPositions;
    expect(BigInt(source!.valueUsdMicros)).toBe(
      BigInt(holdings[0]!.valueUsdMicros) - trade,
    );
    expect(BigInt(target!.valueUsdMicros)).toBe(
      BigInt(holdings[1]!.valueUsdMicros) + trade,
    );
    expect(BigInt(source!.rawAmount)).toBe(BigInt(holdings[0]!.rawAmount) - sold);
    expect(rest.map((p) => p.valueUsdMicros)).toEqual(
      holdings.slice(2).map((h) => h.valueUsdMicros),
    );
    const total = result.postPositions.reduce(
      (sum, p) => sum + BigInt(p.valueUsdMicros),
      BigInt(0),
    );
    expect(total.toString()).toBe(result.portfolioValueUsdMicros);
  });

  it("refuses a proposal that sells more than the portfolio holds or an unheld mint", () => {
    expect(() =>
      simulateRotation(holdings, {
        action: "REBALANCE",
        inputMint: holdings[0]!.mint,
        outputMint: holdings[1]!.mint,
        inputAmount: {
          rawAmount: (BigInt(holdings[0]!.rawAmount) + BigInt(1)).toString(),
          decimals: 9,
        },
      }),
    ).toThrow(InfeasibleProposalError);
    expect(() =>
      simulateRotation(holdings, {
        action: "REBALANCE",
        inputMint: "demo_mint_equity_a",
        outputMint: holdings[1]!.mint,
        inputAmount: { rawAmount: "1", decimals: 9 },
      }),
    ).toThrow(/does not hold/);
    expect(simulateRotation(holdings, { action: "HOLD" }).tradeValueUsdMicros).toBe(
      "0",
    );
  });

  it("formats base units as plain decimal strings", () => {
    expect(formatUiAmount(BigInt(46216838), 9)).toBe("0.046216838");
    expect(formatUiAmount(BigInt(1000000000), 9)).toBe("1");
    expect(formatUiAmount(BigInt(0), 9)).toBe("0");
    expect(formatUiAmount(BigInt(12345), 0)).toBe("12345");
  });
});

describe("PreStocks universe decision runs", () => {
  const loadCatalogue = async () => catalogue;

  it("evaluates against PreStocks mints, freshness and valuations", async () => {
    const run = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
      universe: "prestocks",
      loadCatalogue,
    });
    expect(run.universe.requested).toBe("prestocks");
    expect(run.universe.used).toBe("prestocks");
    expect(run.universe.note).toBeNull();
    expect(run.policyEvaluation.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(run.policyEvaluation.approved).toBe(true);

    const allowed = run.policyEvaluation.checks.find((c) => c.rule === "allowed_mints");
    expect(allowed?.status).toBe("pass");
    expect(allowed?.threshold).toContain("PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF");
    expect(run.proposal.action).toBe("REBALANCE");
    if (run.proposal.action !== "HOLD") {
      expect(run.proposal.inputMint).toBe(
        "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
      );
      expect(run.proposal.outputMint).toBe(
        "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
      );
    }

    // No invented liquidity or quote: the liquidity rule warns, quote expiry is absent.
    const liquidity = run.policyEvaluation.checks.find(
      (c) => c.rule === "min_liquidity_usd_micros",
    );
    expect(liquidity?.status).toBe("warn");
    expect(run.policyEvaluation.checks.some((c) => c.rule === "quote_expiry")).toBe(
      false,
    );

    const summary = run.universe.prestocks!;
    expect(summary.capturedAt).toBe(capturedAt);
    expect(summary.sourceUrl).toBe(catalogue.sourceUrl);
    expect(summary.assetCount).toBe(usableAssets);
    expect(summary.research.map((row) => row.symbol).slice(0, 2)).toEqual([
      "OPENAI",
      "SPACEX",
    ]);
    expect(summary.factsUsed.max_data_age_seconds).toContain(capturedAt);
    expect(summary.factsUsed.allowed_mints).toContain("contract_address");
    expect(summary.factsUsed.max_position_bps).toContain("implied valuation");
    expect(summary.allocation.positions.map((p) => p.symbol).slice(0, 2)).toEqual([
      "OPENAI",
      "SPACEX",
    ]);
    // Target: 875 bps start plus a 500 bps trade, rounded up.
    expect(summary.allocation.positions[1]?.portfolioShareBps).toBe(1_376);

    // Receipt binds the derived policy and records the data source.
    expect(run.receipt.dataSource).toMatchObject({
      universe: "prestocks",
      sourceUrl: catalogue.sourceUrl,
      capturedAt,
      assetCount: usableAssets,
    });
    expect(
      run.receipt.riskPolicy.document.constraints.find(
        (c) => c.type === "allowed_mints",
      ),
    ).toMatchObject({ mints: summary.research.map((row) => row.mint) });
    expect(run.receipt.decision.context.marketInputs[0]).toMatchObject({
      source: "prestocks_catalogue",
      observedAt: capturedAt,
      priceUsdMicros: "1120000000",
    });
    expect(run.receipt.portfolio.document.valuations[0]).toMatchObject({
      status: "priced",
      source: "prestocks_catalogue_token_price",
    });
    expect(verifyProofReceipt(run.receipt, run.receiptHash).valid).toBe(true);
  });

  it("still rejects the oversized scenario on the PreStocks universe", async () => {
    const run = await runDecision({
      bundle: demoAgentBundle,
      scenario: "oversized",
      universe: "prestocks",
      loadCatalogue,
    });
    expect(run.universe.used).toBe("prestocks");
    expect(run.policyEvaluation.approved).toBe(false);
    const trade = run.policyEvaluation.checks.find((c) => c.rule === "max_trade_bps");
    expect(trade?.status).toBe("fail");
    expect(trade?.observed).toBe("2000");
    // Still a feasible proposal: the source holding funds it.
    const proposal = run.proposal;
    if (proposal.action === "HOLD") throw new Error("expected a rebalance");
    const held = run.receipt.portfolio.document.balances.find(
      (balance) => balance.kind === "spl-token" && balance.mint === proposal.inputMint,
    )!;
    expect(BigInt(proposal.inputAmount.rawAmount) <= BigInt(held.rawAmount)).toBe(true);
    expect(run.universe.prestocks?.allocation.positions[0]?.role).toBe(
      "rotation source",
    );
  });

  it("refuses a provider proposal that sells more than the research portfolio holds", async () => {
    const greedy = {
      async propose(context: Parameters<DemoDecisionProvider["propose"]>[0]) {
        const honest = await new DemoDecisionProvider({
          tradeValueUsdMicros: "1000000",
        }).propose(context);
        const proposal = honest.proposal;
        if (proposal.action === "HOLD") return honest;
        const held = context.portfolio.document.balances.find(
          (b) => b.kind === "spl-token" && b.mint === proposal.inputMint,
        )!;
        return {
          ...honest,
          proposal: {
            ...proposal,
            inputAmount: {
              ...proposal.inputAmount,
              rawAmount: (BigInt(held.rawAmount) * BigInt(2)).toString(),
              uiAmount: "999",
            },
          },
        };
      },
    };
    await expect(
      runDecision({
        bundle: demoAgentBundle,
        scenario: "balanced",
        universe: "prestocks",
        provider: greedy,
        loadCatalogue,
      }),
    ).rejects.toThrow(/holds only/);
  });

  it("fails the freshness rule when the catalogue read is older than the policy allows", async () => {
    const stale = new Date(Date.now() - 3_600_000).toISOString();
    const run = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
      universe: "prestocks",
      loadCatalogue: async () => ({ ...catalogue, capturedAt: stale }),
    });
    expect(run.universe.used).toBe("prestocks");
    expect(run.policyEvaluation.approved).toBe(false);
    expect(
      run.policyEvaluation.checks.find((c) => c.rule === "max_data_age_seconds")
        ?.status,
    ).toBe("fail");
  });

  it("falls back to the fixture universe with a note when the catalogue fails", async () => {
    const run = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
      universe: "prestocks",
      loadCatalogue: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(run.universe).toMatchObject({ requested: "prestocks", used: "fixture" });
    expect(run.universe.note).toContain("could not be reached");
    expect(run.universe.prestocks).toBeNull();
    expect(run.policyEvaluation.approved).toBe(true);
    expect(run.receipt.dataSource).toMatchObject({
      universe: "fixture",
      sourceUrl: null,
    });
    expect(run.receipt.riskPolicy.hash).toBe(demoAgentBundle.riskPolicy.hash);
    if (run.proposal.action !== "HOLD") {
      expect(run.proposal.inputMint).toBe("demo_mint_equity_a");
    }
  });

  it("falls back with the validation reason when too few assets are usable", async () => {
    const run = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
      universe: "prestocks",
      loadCatalogue: async () => ({
        ...catalogue,
        assets: catalogue.assets.slice(0, 1),
      }),
    });
    expect(run.universe.used).toBe("fixture");
    expect(run.universe.note).toContain("at least two");
  });

  it("does not read the catalogue for a fixture run", async () => {
    let reads = 0;
    const run = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
      universe: "fixture",
      loadCatalogue: async () => {
        reads += 1;
        return catalogue;
      },
    });
    expect(reads).toBe(0);
    expect(run.universe).toEqual({
      requested: "fixture",
      used: "fixture",
      note: null,
      prestocks: null,
    });
  });
});
