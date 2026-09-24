import { describe, expect, it } from "vitest";

import {
  agentSchema,
  assetSchema,
  riskPolicyDocumentSchema,
  solanaPublicKeySchema,
  strategyDocumentSchema,
  type RiskPolicyDocument,
} from "../lib/domain";

const mintA = "11111111111111111111111111111111";
const mintB = "So11111111111111111111111111111111111111112";

function validRiskPolicy(): RiskPolicyDocument {
  return {
    constraints: [
      { type: "allowed_mints", mints: [mintA, mintB] },
      { type: "max_trade_bps", value: 1_000 },
      { type: "max_position_bps", value: 3_500 },
      { type: "min_reserve_bps", value: 2_000 },
      { type: "max_slippage_bps", value: 75 },
      { type: "max_daily_turnover_bps", value: 2_500 },
      { type: "cooldown_seconds", value: 3_600 },
      { type: "max_data_age_seconds", value: 300 },
      { type: "min_liquidity_usd_micros", value: "1000000000" },
      { type: "allowed_modes", modes: ["demo"] },
    ],
  };
}

describe("domain schemas", () => {
  it("rejects non-base58 and implausible Solana public keys", () => {
    expect(solanaPublicKeySchema.safeParse("0OIl-not-base58").success).toBe(false);
    expect(solanaPublicKeySchema.safeParse(mintA).success).toBe(true);
  });

  it("accepts a complete risk policy", () => {
    expect(riskPolicyDocumentSchema.safeParse(validRiskPolicy()).success).toBe(true);
  });

  it("requires every MVP constraint exactly once", () => {
    const policy = validRiskPolicy();
    policy.constraints = policy.constraints.filter(
      (constraint) => constraint.type !== "max_slippage_bps",
    );
    expect(riskPolicyDocumentSchema.safeParse(policy).success).toBe(false);
  });

  it("enforces max trade weight at or below max position weight", () => {
    const policy = validRiskPolicy();
    const maxTrade = policy.constraints.find(
      (constraint) => constraint.type === "max_trade_bps",
    );
    if (maxTrade?.type === "max_trade_bps") maxTrade.value = 4_000;
    expect(riskPolicyDocumentSchema.safeParse(policy).success).toBe(false);
  });

  it("rejects duplicate strategy mints and actions", () => {
    const result = strategyDocumentSchema.safeParse({
      objective:
        "Preserve capital while rotating through an approved equity-token universe.",
      horizon: "monthly",
      cadence: { kind: "manual" },
      universe: [mintA, mintA],
      signals: ["Provider-verified relative momentum"],
      allowedActions: ["HOLD", "HOLD"],
      riskPolicyVersion: 1,
    });
    expect(result.success).toBe(false);
  });

  it("keeps execution mode and cluster consistent", () => {
    const result = agentSchema.safeParse({
      id: "agent_atlas",
      slug: "atlas",
      name: "Atlas",
      status: "draft",
      mode: "mainnet",
      cluster: "devnet",
      integrationStatus: "not_configured",
      createdAt: "2026-09-17T00:00:00.000Z",
      updatedAt: "2026-09-17T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("does not permit a linked agent without provider evidence", () => {
    const result = agentSchema.safeParse({
      id: "agent_atlas",
      slug: "atlas",
      name: "Atlas",
      status: "draft",
      mode: "demo",
      cluster: "devnet",
      integrationStatus: "linked",
      createdAt: "2026-09-17T00:00:00.000Z",
      updatedAt: "2026-09-17T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("bounds asset decimals and preserves explicit verification state", () => {
    const result = assetSchema.safeParse({
      id: "asset_demo",
      mint: mintB,
      isDemo: false,
      cluster: "devnet",
      symbol: "DEMO",
      name: "Demonstration asset",
      decimals: 30,
      source: "demo_fixture",
      verificationState: "unverified",
    });
    expect(result.success).toBe(false);
  });

  it("makes demo asset identifiers visibly impossible to confuse with live mints", () => {
    const base = {
      id: "asset_demo",
      cluster: "devnet" as const,
      symbol: "DEMO",
      name: "Demonstration asset",
      decimals: 6,
      source: "demo_fixture",
      verificationState: "unverified" as const,
    };

    expect(
      assetSchema.safeParse({ ...base, isDemo: true, mint: "demo_mint_equity_a" })
        .success,
    ).toBe(true);
    expect(assetSchema.safeParse({ ...base, isDemo: true, mint: mintB }).success).toBe(
      false,
    );
    expect(
      assetSchema.safeParse({ ...base, isDemo: false, mint: "demo_mint_equity_a" })
        .success,
    ).toBe(false);
  });
});
