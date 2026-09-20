import { describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import type { TradeProposal } from "../lib/domain";
import { ratioBps } from "../lib/math/fixed";
import { evaluatePolicy, type PolicyFacts } from "../lib/policy/runner";

const now = "2026-09-17T00:05:00.000Z";

function proposal(): TradeProposal {
  return {
    action: "REBALANCE",
    inputMint: "demo_mint_equity_a",
    outputMint: "demo_mint_equity_b",
    inputAmount: { rawAmount: "1000000", decimals: 6, uiAmount: "1" },
    minimumOutputAmount: { rawAmount: "990000", decimals: 6, uiAmount: "0.99" },
    maxSlippageBps: 75,
    thesis: "The deterministic fixture favors a bounded rotation into demo equity B.",
    evidence: [{ sourceId: "fixture", claim: "Relative strength favors B." }],
    confidenceBps: 6500,
    invalidationConditions: ["Relative strength reverses."],
    dataTimestamp: "2026-09-17T00:04:00.000Z",
    expiresAt: "2026-09-17T00:10:00.000Z",
  };
}

function facts(): PolicyFacts {
  return {
    now,
    mode: "demo",
    cluster: "devnet",
    portfolioValueUsdMicros: "10000000000",
    tradeValueUsdMicros: "500000000",
    postReserveUsdMicros: "2500000000",
    postPositions: [{ mint: "demo_mint_equity_b", valueUsdMicros: "3000000000" }],
    dailyTurnoverUsdMicros: "1000000000",
    lastExecutedAt: "2026-09-16T22:00:00.000Z",
    dataObservedAt: "2026-09-17T00:04:00.000Z",
    quoteExpiresAt: "2026-09-17T00:06:00.000Z",
    availableLiquidityUsdMicros: "2000000000",
    assetVerification: {
      demo_mint_equity_a: "unverified",
      demo_mint_equity_b: "unverified",
    },
  };
}

describe("integer-safe math", () => {
  it("rounds exposure conservatively without floating point", () => {
    expect(ratioBps(BigInt(1), BigInt(3), "floor")).toBe(BigInt(3333));
    expect(ratioBps(BigInt(1), BigInt(3), "ceil")).toBe(BigInt(3334));
  });

  it("handles amounts above Number.MAX_SAFE_INTEGER", () => {
    expect(
      ratioBps(BigInt("900719925474099300000"), BigInt("1801439850948198600000")),
    ).toBe(BigInt(5000));
  });
});

describe("deterministic policy runner", () => {
  it("returns observed values and thresholds for every required rule", () => {
    const result = evaluatePolicy(
      proposal(),
      demoAgentBundle.riskPolicy.document,
      facts(),
    );

    expect(result.approved).toBe(true);
    expect(result.checks.length).toBeGreaterThanOrEqual(10);
    expect(result.checks.every((item) => item.observed && item.threshold)).toBe(true);
  });

  it("rejects an oversized trade at the exact integer boundary", () => {
    const oversized = facts();
    oversized.tradeValueUsdMicros = "1000000001";
    const result = evaluatePolicy(
      proposal(),
      demoAgentBundle.riskPolicy.document,
      oversized,
    );

    expect(result.approved).toBe(false);
    expect(result.checks.find((item) => item.rule === "max_trade_bps")).toMatchObject({
      status: "fail",
      observed: "1001",
      threshold: "1000",
    });
  });

  it("fails closed on stale data and an expired quote", () => {
    const stale = facts();
    stale.dataObservedAt = "2026-09-16T23:00:00.000Z";
    stale.quoteExpiresAt = "2026-09-17T00:04:59.000Z";
    const result = evaluatePolicy(
      proposal(),
      demoAgentBundle.riskPolicy.document,
      stale,
    );

    expect(result.approved).toBe(false);
    expect(
      result.checks.filter((item) => item.status === "fail").map((item) => item.rule),
    ).toEqual(expect.arrayContaining(["max_data_age_seconds", "quote_expiry"]));
  });

  it("warns rather than inventing unavailable liquidity", () => {
    const unknownLiquidity = facts();
    delete unknownLiquidity.availableLiquidityUsdMicros;
    const result = evaluatePolicy(
      proposal(),
      demoAgentBundle.riskPolicy.document,
      unknownLiquidity,
    );

    expect(result.approved).toBe(true);
    expect(
      result.checks.find((item) => item.rule === "min_liquidity_usd_micros"),
    ).toMatchObject({ status: "warn", observed: "unavailable" });
  });

  it.each([
    ["devnet", "devnet"],
    ["mainnet", "mainnet-beta"],
  ] as const)(
    "fails closed when %s liquidity is unavailable for verified assets",
    (mode, cluster) => {
      const liveFacts = facts();
      liveFacts.mode = mode;
      liveFacts.cluster = cluster;
      delete liveFacts.availableLiquidityUsdMicros;
      liveFacts.assetVerification = {
        demo_mint_equity_a: "provider_verified",
        demo_mint_equity_b: "onchain_verified",
      };
      const livePolicy = structuredClone(demoAgentBundle.riskPolicy.document);
      const allowedModes = livePolicy.constraints.find(
        (constraint) => constraint.type === "allowed_modes",
      )!;
      allowedModes.modes = [mode];

      const result = evaluatePolicy(proposal(), livePolicy, liveFacts);

      expect(result.approved).toBe(false);
      expect(
        result.checks.find((item) => item.rule === "min_liquidity_usd_micros"),
      ).toMatchObject({ status: "fail", observed: "unavailable" });
      expect(
        result.checks.find((item) => item.rule === "verified_assets"),
      ).toMatchObject({ status: "pass", observed: "all verified" });
    },
  );

  it.each([
    ["demo", "devnet"],
    ["devnet", "devnet"],
    ["mainnet", "mainnet-beta"],
  ] as const)(
    "approves %s when verified assets have sufficient reliable liquidity",
    (mode, cluster) => {
      const modeFacts = facts();
      modeFacts.mode = mode;
      modeFacts.cluster = cluster;
      modeFacts.assetVerification = {
        demo_mint_equity_a: "provider_verified",
        demo_mint_equity_b: "onchain_verified",
      };
      const modePolicy = structuredClone(demoAgentBundle.riskPolicy.document);
      const allowedModes = modePolicy.constraints.find(
        (constraint) => constraint.type === "allowed_modes",
      )!;
      allowedModes.modes = [mode];

      const result = evaluatePolicy(proposal(), modePolicy, modeFacts);

      expect(result.approved).toBe(true);
      expect(
        result.checks.find((item) => item.rule === "min_liquidity_usd_micros"),
      ).toMatchObject({ status: "pass", observed: "2000000000" });
      expect(
        result.checks.find((item) => item.rule === "verified_assets"),
      ).toMatchObject({ status: "pass", observed: "all verified" });
    },
  );
});
