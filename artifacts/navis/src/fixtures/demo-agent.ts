import {
  agentSchema,
  assetSchema,
  riskPolicyVersionSchema,
  strategyVersionSchema,
  type Asset,
  type RiskPolicyDocument,
  type StrategyDocument,
} from "../lib/domain";
import { hashCanonical } from "../lib/proofs/canonical";
import type { AgentBundle } from "@workspace/navis-core/lib/db/repositories/types";

const capturedAt = "2026-09-17T00:00:00.000Z";

const assets = [
  ["a", "EQA", "Demo Equity A"],
  ["b", "EQB", "Demo Equity B"],
  ["c", "EQC", "Demo Equity C"],
  ["d", "EQD", "Demo Equity D"],
].map(([suffix, symbol, name]) =>
  assetSchema.parse({
    id: `demo_asset_${suffix}`,
    mint: `demo_mint_equity_${suffix}`,
    isDemo: true,
    cluster: "devnet",
    symbol,
    name,
    decimals: 6,
    source: "demo_fixture",
    sourceTimestamp: capturedAt,
    verificationState: "unverified",
  }),
);

const demoMints = assets.map((asset) => asset.mint);

const riskPolicyDocument: RiskPolicyDocument = {
  constraints: [
    { type: "allowed_mints", mints: demoMints },
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

const strategyDocument: StrategyDocument = {
  objective:
    "Preserve demonstration capital while rotating through a bounded, explicitly fictional equity-token universe.",
  horizon: "monthly",
  cadence: { kind: "manual" },
  universe: demoMints,
  signals: [
    "Deterministic demo relative-strength fixture",
    "Minimum reserve protection",
  ],
  allowedActions: ["BUY", "SELL", "HOLD", "REBALANCE"],
  riskPolicyVersion: 1,
};

export const demoAgentBundle: AgentBundle = Object.freeze({
  agent: agentSchema.parse({
    id: "demo_agent_atlas",
    slug: "atlas",
    name: "Atlas",
    status: "active",
    mode: "demo",
    cluster: "devnet",
    activeStrategyVersion: 1,
    activeRiskPolicyVersion: 1,
    integrationStatus: "not_configured",
    createdAt: capturedAt,
    updatedAt: capturedAt,
  }),
  strategy: strategyVersionSchema.parse({
    id: "demo_strategy_atlas_v1",
    agentId: "demo_agent_atlas",
    version: 1,
    document: strategyDocument,
    hash: hashCanonical(strategyDocument),
    createdAt: capturedAt,
  }),
  riskPolicy: riskPolicyVersionSchema.parse({
    id: "demo_policy_atlas_v1",
    agentId: "demo_agent_atlas",
    version: 1,
    document: riskPolicyDocument,
    hash: hashCanonical(riskPolicyDocument),
    createdAt: capturedAt,
  }),
  assets: Object.freeze(assets) as readonly Asset[],
});
