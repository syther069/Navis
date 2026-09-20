import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { AgentBundle } from "../db/repositories/types";
import * as schema from "../db/schema";
import {
  decisionContextSchema,
  portfolioSnapshotDocumentSchema,
  type DecisionContext,
  type PortfolioSnapshotDocument,
  type RiskConstraint,
  type RiskPolicyDocument,
} from "../domain";
import { env } from "../env";
import { DemoDecisionProvider } from "../integrations/ai/demo";
import { createDecisionProvider } from "../integrations/ai/server";
import type {
  DecisionProvider,
  DecisionProviderMetadata,
} from "../integrations/ai/types";
import {
  evaluatePolicy,
  type PolicyEvaluation,
  type PolicyFacts,
} from "../policy/runner";
import type { DecisionScenario } from "../decisions/scenarios";
import {
  FIXTURE_UNIVERSE_SUMMARY,
  type DecisionUniverseSource,
  type DecisionUniverseSummary,
  type PreStocksUniverseSummary,
  type UniverseAllocationPosition,
} from "../decisions/universe";
import {
  holdingWeights,
  planHoldings,
  portfolioValue,
  simulateRotation,
  type PreStocksHolding,
} from "../integrations/prestocks/allocation";
import { getPreStocksCatalogue } from "../integrations/prestocks/client";
import {
  buildPreStocksUniverse,
  concentrationImpact,
  describePremium,
  PRESTOCKS_CLUSTER,
  usdMicros,
  type PreStocksCatalogueLike,
  type PreStocksUniverse,
} from "../integrations/prestocks/research";
import { hashCanonical } from "../proofs/canonical";
import {
  proofReceiptDocumentSchema,
  verifyProofReceipt,
  type ProofReceiptDocument,
} from "../proofs/receipt";
import {
  persistPreparedDecision,
  prepareDecision,
  type PreparedDecision,
} from "./decisions";
import { getRememberedDecisionRun, rememberDecisionRun } from "./decision-run-store";
import { createExecutionAttempt, transitionExecutionAttempt } from "./execution";
import { persistPortfolioSnapshot } from "./treasury";

export { decisionScenarios, type DecisionScenario } from "../decisions/scenarios";

type NavisDatabase = NodePgDatabase<typeof schema>;
let lastGeneratedAtMs = 0;

function freshGeneratedAt() {
  const now = Date.now();
  lastGeneratedAtMs = Math.max(now, lastGeneratedAtMs + 1);
  return new Date(lastGeneratedAtMs).toISOString();
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Fictional demo treasury owner shared by every demo fixture snapshot. */
const DEMO_TREASURY_OWNER = "11111111111111111111111111111111";
/** Fictional total portfolio value used by demo policy facts (400 USD). */
const DEMO_PORTFOLIO_VALUE_USD_MICROS = BigInt("400000000");
const DEMO_MIN_LIQUIDITY_USD_MICROS = BigInt("2000000000");
const BPS_DENOMINATOR = BigInt(10_000);

export class PersistentDecisionRunsNotEnabledError extends Error {
  constructor() {
    super(
      "Fresh decisions are only available for demo-mode agents. Devnet and mainnet agents need a real treasury snapshot and live market data before Navis will evaluate a proposal for them.",
    );
    this.name = "PersistentDecisionRunsNotEnabledError";
  }
}

export type RunModelMetadata = DecisionProviderMetadata &
  Readonly<{
    /** Which demo scenario produced the policy facts, when known. */
    scenario?: DecisionScenario;
    /** Which asset universe the run evaluated against, when known. */
    universe?: DecisionUniverseSummary;
    fallback?: {
      used: true;
      reason: string;
      attemptedProvider: string;
    };
  }>;

export type DecisionRunResult = Readonly<{
  decisionId: string;
  /** Row id of the stored proof receipt; null for in-memory runs. */
  proofId: string | null;
  agent: Readonly<{ id: string; slug: string; name: string; mode: string }>;
  scenario: DecisionScenario | null;
  universe: DecisionUniverseSummary;
  generatedAt: string;
  proposal: Awaited<ReturnType<typeof prepareDecision>>["proposal"];
  modelMetadata: RunModelMetadata;
  policyEvaluation: PolicyEvaluation;
  executionEligibility: Readonly<{ eligible: boolean; reason: string }>;
  receipt: ProofReceiptDocument;
  receiptHash: string;
  receiptVerified: boolean;
  persisted: Readonly<{ store: "database" | "memory"; note: string }>;
}>;

export const DATABASE_PERSISTENCE_NOTE =
  "Stored in the database for the connected wallet: decision, policy evaluation, simulated execution attempt and proof receipt.";

export async function loadDecisionRun({
  decisionId,
  database,
  ownerWallet,
}: {
  decisionId: string;
  database?: NavisDatabase;
  ownerWallet?: string;
}): Promise<DecisionRunResult | null> {
  const remembered = getRememberedDecisionRun(decisionId);
  if (remembered) return remembered;
  if (!database || !ownerWallet) return null;
  if (!UUID_PATTERN.test(decisionId)) return null;

  const [row] = await database
    .select({
      decision: schema.decisions,
      evaluation: schema.policyEvaluations,
      proof: schema.proofReceipts,
      agent: {
        id: schema.agents.id,
        slug: schema.agents.slug,
        name: schema.agents.name,
        mode: schema.agents.mode,
      },
    })
    .from(schema.decisions)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.decisions.agentId))
    .innerJoin(
      schema.policyEvaluations,
      eq(schema.policyEvaluations.decisionId, schema.decisions.id),
    )
    .innerJoin(
      schema.proofReceipts,
      eq(schema.proofReceipts.decisionId, schema.decisions.id),
    )
    .where(
      and(
        eq(schema.decisions.id, decisionId),
        eq(schema.agents.ownerWallet, ownerWallet),
      ),
    )
    .limit(1);
  if (!row) return null;

  const receipt = proofReceiptDocumentSchema.parse(row.proof.document);
  const receiptVerified = verifyProofReceipt(receipt, row.proof.receiptHash).valid;
  const checks = receipt.policyEvaluation.checks;
  const approved = row.evaluation.approved;
  const modelMetadata = row.decision.modelMetadata as RunModelMetadata;
  return {
    decisionId,
    proofId: row.proof.id,
    agent: row.agent,
    scenario: modelMetadata.scenario ?? null,
    universe: modelMetadata.universe ?? FIXTURE_UNIVERSE_SUMMARY,
    generatedAt: row.proof.finalizedAt.toISOString(),
    proposal: row.decision.proposal,
    modelMetadata,
    policyEvaluation: { approved, checks },
    executionEligibility: {
      eligible: false,
      reason:
        receipt.mode === "demo"
          ? "Demo mode: execution is simulated only."
          : approved
            ? "Review current integration state before execution."
            : "Policy rejected this proposal.",
    },
    receipt,
    receiptHash: row.proof.receiptHash,
    receiptVerified,
    persisted: {
      store: "database",
      note: DATABASE_PERSISTENCE_NOTE,
    },
  };
}

/**
 * PreStocks research holdings: every usable asset, weighted from the agent's
 * own trade and position limits around the same fictional 400 USD reference
 * as the fixture portfolio. Quantities are whole base units and every value is
 * recomputed from that quantity at the catalogue token price.
 */
export function prestocksHoldings(
  universe: PreStocksUniverse,
  policy: RiskPolicyDocument,
): PreStocksHolding[] {
  return planHoldings(
    universe,
    holdingWeights(
      {
        maxTradeBps: policyLimit(policy, "max_trade_bps"),
        maxPositionBps: policyLimit(policy, "max_position_bps"),
      },
      universe.assets.length,
    ),
    DEMO_PORTFOLIO_VALUE_USD_MICROS,
  );
}

function demoPortfolio(
  bundle: AgentBundle,
  generatedAt: string,
  universe?: PreStocksUniverse,
) {
  if (universe) {
    const holdings = prestocksHoldings(universe, bundle.riskPolicy.document);
    return portfolioSnapshotDocumentSchema.parse({
      agentId: bundle.agent.id,
      owner: DEMO_TREASURY_OWNER,
      cluster: bundle.agent.cluster,
      slot: String(Date.now()),
      source: "demo_fixture",
      capturedAt: generatedAt,
      balances: [
        { kind: "native", rawAmount: "2000000000", decimals: 9, slot: "0" },
        ...holdings.map((holding) => ({
          kind: "spl-token",
          mint: holding.mint,
          rawAmount: holding.rawAmount,
          decimals: holding.decimals,
          slot: "0",
        })),
      ],
      valuations: holdings.map((holding) => ({
        status: "priced",
        mint: holding.mint,
        valueUsdMicros: holding.valueUsdMicros,
        source: "prestocks_catalogue_token_price",
        observedAt: universe.capturedAt,
      })),
    });
  }
  const [inputAsset, outputAsset, unpricedAsset] = bundle.assets;
  if (!inputAsset || !outputAsset || !unpricedAsset) {
    throw new Error("A decision run requires at least three configured assets.");
  }
  return portfolioSnapshotDocumentSchema.parse({
    agentId: bundle.agent.id,
    owner: DEMO_TREASURY_OWNER,
    cluster: bundle.agent.cluster,
    slot: String(Date.now()),
    source: "demo_fixture",
    capturedAt: generatedAt,
    balances: [
      { kind: "native", rawAmount: "2000000000", decimals: 9, slot: "0" },
      {
        kind: "spl-token",
        mint: inputAsset.mint,
        rawAmount: "100000000",
        decimals: inputAsset.decimals,
        slot: "0",
      },
      {
        kind: "spl-token",
        mint: outputAsset.mint,
        rawAmount: "100000000",
        decimals: outputAsset.decimals,
        slot: "0",
      },
      {
        kind: "spl-token",
        mint: unpricedAsset.mint,
        rawAmount: "50000000",
        decimals: unpricedAsset.decimals,
        slot: "0",
      },
    ],
    valuations: [
      {
        status: "priced",
        mint: inputAsset.mint,
        valueUsdMicros: "120000000",
        source: "fresh_demo_run",
        observedAt: generatedAt,
      },
      {
        status: "priced",
        mint: outputAsset.mint,
        valueUsdMicros: "100000000",
        source: "fresh_demo_run",
        observedAt: generatedAt,
      },
      {
        status: "unpriced",
        mint: unpricedAsset.mint,
        reason: "No trusted quote exists for this demo asset.",
      },
    ],
  });
}

/**
 * Atlas with its allowlist, strategy universe and assets replaced by the
 * PreStocks universe. The derived strategy and policy get their own hashes and
 * ids, so the receipt still binds the exact documents that were evaluated.
 * The run is labelled with the PreStocks cluster (mainnet-beta, the only place
 * those mints exist) while staying in demo mode: nothing is ever executed.
 */
export function withPreStocksUniverse(
  bundle: AgentBundle,
  universe: PreStocksUniverse,
): AgentBundle {
  const riskPolicyDocument: RiskPolicyDocument = {
    ...bundle.riskPolicy.document,
    constraints: bundle.riskPolicy.document.constraints.map((constraint) =>
      constraint.type === "allowed_mints"
        ? { ...constraint, mints: [...universe.allowedMints] }
        : constraint,
    ),
  };
  const strategyDocument = {
    ...bundle.strategy.document,
    universe: [...universe.allowedMints],
  };
  return {
    ...bundle,
    agent: { ...bundle.agent, cluster: PRESTOCKS_CLUSTER },
    strategy: {
      ...bundle.strategy,
      id: `${bundle.strategy.id}_prestocks`,
      document: strategyDocument,
      hash: hashCanonical(strategyDocument),
    },
    riskPolicy: {
      ...bundle.riskPolicy,
      id: `${bundle.riskPolicy.id}_prestocks`,
      document: riskPolicyDocument,
      hash: hashCanonical(riskPolicyDocument),
    },
    assets: universe.assets,
  };
}

type PortfolioReference = Readonly<{
  id: string;
  contentHash: string;
  document: PortfolioSnapshotDocument;
}>;

export function buildDecisionContext(
  bundle: AgentBundle,
  generatedAt: string,
  portfolio?: PortfolioReference,
  universe?: PreStocksUniverse,
): DecisionContext {
  const portfolioReference: PortfolioReference = portfolio ?? {
    id: `run_snapshot_${randomUUID()}`,
    contentHash: "",
    document: demoPortfolio(bundle, generatedAt, universe),
  };
  const contentHash =
    portfolioReference.contentHash || hashCanonical(portfolioReference.document);
  const outputAsset = bundle.assets[1];
  if (!outputAsset) throw new Error("A decision run requires two configured assets.");
  return decisionContextSchema.parse({
    agentId: bundle.agent.id,
    mode: bundle.agent.mode,
    cluster: bundle.agent.cluster,
    requestedAt: generatedAt,
    strategy: {
      id: bundle.strategy.id,
      version: bundle.strategy.version,
      hash: bundle.strategy.hash,
    },
    riskPolicy: {
      id: bundle.riskPolicy.id,
      version: bundle.riskPolicy.version,
      hash: bundle.riskPolicy.hash,
    },
    portfolio: {
      id: portfolioReference.id,
      contentHash,
      document: portfolioReference.document,
    },
    assets: [...bundle.assets],
    // PreStocks rows are research prices with no liquidity and no quote
    // expiry: the catalogue publishes neither, so neither is invented.
    marketInputs: universe
      ? universe.research.map((row) => ({
          id: `prestocks_${row.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          mint: row.mint,
          source: "prestocks_catalogue",
          observedAt: universe.capturedAt,
          ...(usdMicros(row.tokenPriceUsd)
            ? { priceUsdMicros: usdMicros(row.tokenPriceUsd)! }
            : {}),
        }))
      : [
          {
            id: `fresh_run_${randomUUID()}`,
            mint: outputAsset.mint,
            source: "fresh_demo_run",
            observedAt: generatedAt,
            liquidityUsdMicros: "2000000000",
            quoteExpiresAt: new Date(Date.parse(generatedAt) + 300_000).toISOString(),
          },
        ],
    permittedActions: bundle.strategy.document.allowedActions,
  });
}

export async function loadLatestDecisionContext(
  bundle: AgentBundle,
  database: NavisDatabase,
  generatedAt: string,
) {
  const [result] = await database
    .select({
      snapshot: schema.portfolioSnapshots,
      ownerPublicKey: schema.treasuryAccounts.ownerPublicKey,
    })
    .from(schema.portfolioSnapshots)
    .innerJoin(
      schema.treasuryAccounts,
      eq(schema.treasuryAccounts.id, schema.portfolioSnapshots.treasuryAccountId),
    )
    .where(eq(schema.portfolioSnapshots.agentId, bundle.agent.id))
    .orderBy(desc(schema.portfolioSnapshots.capturedAt))
    .limit(1);
  if (!result) throw new Error("The agent has no portfolio snapshot for a decision.");
  const row = result.snapshot;
  const document = portfolioSnapshotDocumentSchema.parse({
    agentId: row.agentId,
    owner: result.ownerPublicKey,
    cluster: row.cluster,
    slot: row.slot.toString(),
    source: row.source,
    capturedAt: row.capturedAt.toISOString(),
    balances: row.balances,
    valuations: row.valuations,
  });
  return decisionContextSchema.parse({
    agentId: bundle.agent.id,
    mode: bundle.agent.mode,
    cluster: bundle.agent.cluster,
    requestedAt: generatedAt,
    strategy: {
      id: bundle.strategy.id,
      version: bundle.strategy.version,
      hash: bundle.strategy.hash,
    },
    riskPolicy: {
      id: bundle.riskPolicy.id,
      version: bundle.riskPolicy.version,
      hash: bundle.riskPolicy.hash,
    },
    portfolio: { id: row.id, contentHash: row.contentHash, document },
    assets: [...bundle.assets],
    marketInputs: [],
    permittedActions: bundle.strategy.document.allowedActions,
  });
}

function policyLimitString<T extends RiskConstraint["type"]>(
  policy: RiskPolicyDocument,
  type: T,
): string {
  const found = policy.constraints.find((item) => item.type === type);
  if (!found || !("value" in found) || typeof found.value !== "string") {
    throw new Error(`Risk policy is missing the ${type} constraint.`);
  }
  return found.value;
}

function policyLimit<T extends RiskConstraint["type"]>(
  policy: RiskPolicyDocument,
  type: T,
): number {
  const found = policy.constraints.find((item) => item.type === type);
  if (!found || !("value" in found) || typeof found.value !== "number") {
    throw new Error(`Risk policy is missing the numeric ${type} constraint.`);
  }
  return found.value;
}

function shareOfPortfolio(bps: number) {
  return (
    (DEMO_PORTFOLIO_VALUE_USD_MICROS * BigInt(Math.max(0, Math.trunc(bps)))) /
    BPS_DENOMINATOR
  ).toString();
}

/**
 * Scenario facts are derived from the agent's own policy so the same two
 * scenarios behave the same way for Atlas and for any created demo agent:
 * "balanced" sits at half of each limit, "oversized" doubles the trade and
 * position limits and halves the reserve floor.
 */
export function demoScenarioFacts(
  policy: RiskPolicyDocument,
  scenario: DecisionScenario,
) {
  const maxTradeBps = policyLimit(policy, "max_trade_bps");
  const maxPositionBps = policyLimit(policy, "max_position_bps");
  const minReserveBps = policyLimit(policy, "min_reserve_bps");
  const maxTurnoverBps = policyLimit(policy, "max_daily_turnover_bps");
  const minLiquidity = BigInt(policyLimitString(policy, "min_liquidity_usd_micros"));
  // Liquidity is never the deciding rule: it always clears the policy floor.
  const liquidityUsdMicros = (
    minLiquidity * BigInt(2) > DEMO_MIN_LIQUIDITY_USD_MICROS
      ? minLiquidity * BigInt(2)
      : DEMO_MIN_LIQUIDITY_USD_MICROS
  ).toString();
  // A breach is deliberately not capped at 10_000 bps: even a policy that
  // allows the whole portfolio in one trade must see the oversized scenario
  // fail, so the fictional trade is sized at twice the portfolio when needed.
  const breach = (limit: number) => Math.max(limit + 1, limit * 2);
  return scenario === "oversized"
    ? {
        tradeBps: breach(maxTradeBps),
        inputPositionBps: Math.floor(maxPositionBps / 4),
        outputPositionBps: breach(maxPositionBps),
        reserveBps: Math.floor(minReserveBps / 2),
        turnoverBps: Math.floor(maxTurnoverBps / 2),
        liquidityUsdMicros,
      }
    : {
        tradeBps: Math.floor(maxTradeBps / 2),
        inputPositionBps: Math.floor(maxPositionBps / 4),
        outputPositionBps: Math.floor(maxPositionBps / 2),
        reserveBps: Math.min(10_000, minReserveBps + 500),
        turnoverBps: Math.floor(maxTurnoverBps / 2),
        liquidityUsdMicros,
      };
}

function demoPolicyFacts(
  bundle: AgentBundle,
  context: DecisionContext,
  scenario: DecisionScenario,
): PolicyFacts {
  if (context.mode !== "demo" || context.portfolio.document.source !== "demo_fixture") {
    throw new PersistentDecisionRunsNotEnabledError();
  }
  const [inputAsset, outputAsset] = context.assets;
  if (!inputAsset || !outputAsset) {
    throw new Error("A decision run requires two configured assets.");
  }
  const facts = demoScenarioFacts(bundle.riskPolicy.document, scenario);
  return {
    now: context.requestedAt,
    mode: context.mode,
    cluster: context.cluster,
    portfolioValueUsdMicros: DEMO_PORTFOLIO_VALUE_USD_MICROS.toString(),
    tradeValueUsdMicros: shareOfPortfolio(facts.tradeBps),
    postReserveUsdMicros: shareOfPortfolio(facts.reserveBps),
    postPositions: [
      {
        mint: inputAsset.mint,
        valueUsdMicros: shareOfPortfolio(facts.inputPositionBps),
      },
      {
        mint: outputAsset.mint,
        valueUsdMicros: shareOfPortfolio(facts.outputPositionBps),
      },
    ],
    dailyTurnoverUsdMicros: shareOfPortfolio(facts.turnoverBps),
    dataObservedAt: context.requestedAt,
    quoteExpiresAt: new Date(Date.parse(context.requestedAt) + 300_000).toISOString(),
    availableLiquidityUsdMicros: facts.liquidityUsdMicros,
    liquidityObservedAt: context.marketInputs[0]?.observedAt ?? context.requestedAt,
    assetVerification: Object.fromEntries(
      context.assets.map((asset) => [asset.mint, asset.verificationState]),
    ),
  };
}

type PreStocksSimulation = Readonly<{
  facts: PolicyFacts;
  holdings: readonly PreStocksHolding[];
  simulation: ReturnType<typeof simulateRotation>;
}>;

/**
 * PreStocks facts are measured from the proposal itself: the input amount is
 * valued at the catalogue token price, every post-trade position is the
 * starting holding plus or minus exactly that value, turnover is that trade,
 * and freshness is the catalogue read time. There is no execution quote to
 * expire and no published liquidity figure, so neither is supplied and the
 * liquidity rule warns instead of leaning on an invented number. The reserve
 * floor still comes from the scenario, because the research portfolio holds
 * no cash leg; the UI says so.
 */
function prestocksPolicyFacts(
  bundle: AgentBundle,
  context: DecisionContext,
  scenario: DecisionScenario,
  universe: PreStocksUniverse,
  proposal: PreparedDecision["proposal"],
): PreStocksSimulation {
  if (context.mode !== "demo" || context.portfolio.document.source !== "demo_fixture") {
    throw new PersistentDecisionRunsNotEnabledError();
  }
  const holdings = prestocksHoldings(universe, bundle.riskPolicy.document);
  const simulation = simulateRotation(holdings, proposal);
  const scenarioFacts = demoScenarioFacts(bundle.riskPolicy.document, scenario);
  const total = BigInt(simulation.portfolioValueUsdMicros);
  const facts: PolicyFacts = {
    now: context.requestedAt,
    mode: context.mode,
    cluster: context.cluster,
    portfolioValueUsdMicros: simulation.portfolioValueUsdMicros,
    tradeValueUsdMicros: simulation.tradeValueUsdMicros,
    postReserveUsdMicros: (
      (total * BigInt(Math.max(0, Math.trunc(scenarioFacts.reserveBps)))) /
      BPS_DENOMINATOR
    ).toString(),
    postPositions: simulation.postPositions.map((position) => ({
      mint: position.mint,
      valueUsdMicros: position.valueUsdMicros,
    })),
    dailyTurnoverUsdMicros: simulation.tradeValueUsdMicros,
    dataObservedAt: universe.capturedAt,
    assetVerification: Object.fromEntries(
      context.assets.map((asset) => [asset.mint, asset.verificationState]),
    ),
  };
  return { facts, holdings, simulation };
}

/** The scenario's intended trade size against the priced research holdings. */
export function prestocksTradeTarget(
  bundle: AgentBundle,
  universe: PreStocksUniverse,
  scenario: DecisionScenario,
) {
  const holdings = prestocksHoldings(universe, bundle.riskPolicy.document);
  const total = portfolioValue(holdings);
  const tradeBps = demoScenarioFacts(bundle.riskPolicy.document, scenario).tradeBps;
  return (
    (total * BigInt(Math.max(0, Math.trunc(tradeBps)))) /
    BPS_DENOMINATOR
  ).toString();
}

/**
 * Everything the run result and receipt say about the PreStocks universe:
 * freshness, the research rows, the concentration impact of the proposed
 * allocation and which fact fed which policy rule.
 */
function summarizePreStocksUniverse(
  universe: PreStocksUniverse,
  run: PreStocksSimulation,
  proposal: PreparedDecision["proposal"],
): PreStocksUniverseSummary {
  const { facts, holdings, simulation } = run;
  const portfolioUsd = Number(facts.portfolioValueUsdMicros) / 1_000_000;
  const byMint = new Map(universe.research.map((row) => [row.mint, row]));
  const heldByMint = new Map(holdings.map((holding) => [holding.mint, holding]));
  const inputMint = proposal.action === "HOLD" ? null : proposal.inputMint;
  const outputMint = proposal.action === "HOLD" ? null : proposal.outputMint;
  const positions: UniverseAllocationPosition[] = simulation.postPositions.map(
    (position) => {
      const row = byMint.get(position.mint);
      const held = heldByMint.get(position.mint);
      const impact = concentrationImpact({
        allocationUsd: Number(position.valueUsdMicros) / 1_000_000,
        portfolioUsd,
        impliedValuationUsd: row?.impliedValuationUsd ?? 0,
      });
      return {
        mint: position.mint,
        symbol: row?.symbol ?? position.mint,
        role:
          position.mint === inputMint
            ? "rotation source"
            : position.mint === outputMint
              ? "rotation target"
              : "held",
        startValueUsdMicros: held?.valueUsdMicros ?? "0",
        valueUsdMicros: position.valueUsdMicros,
        portfolioShareBps: impact.portfolioShareBps,
        impliedValuationShareBps: impact.valuationShareBps,
      };
    },
  );
  const source = positions.find((position) => position.role === "rotation source");
  const target = positions.find((position) => position.role === "rotation target");
  const sourceRow = source ? byMint.get(source.mint) : undefined;
  const targetRow = target ? byMint.get(target.mint) : undefined;
  const usd = (micros: string) => `${(Number(micros) / 1_000_000).toFixed(2)} USD`;
  const positionLine = (position: UniverseAllocationPosition | undefined) => {
    const row = position ? byMint.get(position.mint) : undefined;
    return position && row
      ? `${position.symbol} ${usd(position.startValueUsdMicros)} before, ${usd(position.valueUsdMicros)} after = ${String(position.portfolioShareBps ?? "n/a")} bps of the portfolio and ${String(position.impliedValuationShareBps ?? "n/a")} bps of its PreStocks implied valuation (${row.impliedValuationUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD)`
      : null;
  };
  const inputLine =
    proposal.action !== "HOLD" && simulation.input && sourceRow
      ? `${proposal.inputAmount.uiAmount} ${sourceRow.symbol} x ${sourceRow.tokenPriceUsd.toFixed(2)} USD token price = ${usd(simulation.tradeValueUsdMicros)}`
      : `no trade (HOLD)`;
  const factsUsed: Record<string, string> = {
    allowed_mints: `Allowlist is the ${String(universe.allowedMints.length)} validated PreStocks contract_address values read at ${universe.capturedAt}: ${universe.research
      .map((row) => `${row.symbol} ${row.mint}`)
      .join(", ")}.`,
    max_data_age_seconds: `Data age is measured from Navis's PreStocks catalogue read time ${universe.capturedAt} (${universe.sourceUrl}). This is the read time, not an upstream quote timestamp.`,
    max_trade_bps: `Trade value is the proposal amount at the catalogue token price: ${inputLine}, against a ${portfolioUsd.toFixed(2)} USD research portfolio (sum of the priced holdings). ${sourceRow ? `${sourceRow.symbol} is ${describePremium(sourceRow.premiumBps)} to mark` : ""}${targetRow ? `, ${targetRow.symbol} is ${describePremium(targetRow.premiumBps)} to mark` : ""}; PreStocks prices chose the pair, the scenario chose the intended size.`,
    max_position_bps: [
      "Post-trade positions are the starting research holdings moved by exactly the trade value (value for value at catalogue token prices, before slippage).",
      positionLine(source),
      positionLine(target),
    ]
      .filter(Boolean)
      .join(" "),
    max_daily_turnover_bps: `Turnover is this trade alone: ${usd(simulation.tradeValueUsdMicros)} of ${portfolioUsd.toFixed(2)} USD.`,
    min_liquidity_usd_micros:
      "PreStocks publishes no liquidity figure, so no liquidity value was supplied and the rule warns instead of using an invented number.",
    verified_assets: `All ${String(universe.assets.length)} assets are provider_verified from the catalogue contract_address; demo mode does not require an onchain mint check.`,
  };
  return {
    sourceUrl: universe.sourceUrl,
    capturedAt: universe.capturedAt,
    assetCount: universe.assets.length,
    excluded: universe.excluded,
    research: universe.research,
    allocation: {
      portfolioValueUsdMicros: facts.portfolioValueUsdMicros,
      tradeValueUsdMicros: facts.tradeValueUsdMicros,
      positions,
    },
    factsUsed,
  };
}

function eligibility(bundle: AgentBundle, approved: boolean) {
  if (!approved) return { eligible: false, reason: "Policy rejected this proposal." };
  if (bundle.agent.mode === "demo") {
    return {
      eligible: false,
      reason: "Demo mode: execution is simulated only.",
    };
  }
  const enabled =
    bundle.agent.mode === "devnet"
      ? env.enableDevnetExecution
      : env.enableMainnetExecution;
  if (bundle.agent.integrationStatus !== "linked" || !env.solanaRpcUrl || !enabled) {
    return {
      eligible: false,
      reason: "Execution integrations are not fully configured.",
    };
  }
  return {
    eligible: true,
    reason: "Approved and execution integrations are configured.",
  };
}

async function prepareWithFallback(
  context: DecisionContext,
  policy: RiskPolicyDocument,
  requestedProvider?: DecisionProvider,
  tradeValueUsdMicros?: string,
): Promise<
  Omit<PreparedDecision, "modelMetadata"> & { modelMetadata: RunModelMetadata }
> {
  // The deterministic provider respects the agent's own slippage ceiling so a
  // balanced run is approvable for every policy the creation form accepts.
  const demo = {
    maxSlippageBps: policyLimit(policy, "max_slippage_bps"),
    ...(tradeValueUsdMicros ? { tradeValueUsdMicros } : {}),
  };
  let provider: DecisionProvider;
  try {
    provider = requestedProvider ?? createDecisionProvider({ demo });
    return await prepareDecision(context, provider);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown provider failure";
    const prepared = await prepareDecision(context, new DemoDecisionProvider(demo));
    return {
      ...prepared,
      modelMetadata: {
        ...prepared.modelMetadata,
        fallback: {
          used: true as const,
          reason,
          attemptedProvider: requestedProvider?.constructor.name ?? env.aiProvider,
        },
      },
    };
  }
}

type EvaluatedRun = Readonly<{
  generatedAt: string;
  context: DecisionContext;
  prepared: Omit<PreparedDecision, "modelMetadata"> &
    Readonly<{ modelMetadata: RunModelMetadata }>;
  policyEvaluation: PolicyEvaluation;
  policyInputHash: string;
  executionEligibility: Readonly<{ eligible: boolean; reason: string }>;
  universe: DecisionUniverseSummary;
}>;

function buildReceipt(bundle: AgentBundle, run: EvaluatedRun, proofId: string) {
  const receipt = proofReceiptDocumentSchema.parse({
    version: 1,
    proofId,
    mode: run.context.mode,
    cluster: run.context.cluster,
    generatedAt: run.generatedAt,
    strategy: { document: bundle.strategy.document, hash: bundle.strategy.hash },
    riskPolicy: {
      document: bundle.riskPolicy.document,
      hash: bundle.riskPolicy.hash,
    },
    portfolio: {
      document: run.context.portfolio.document,
      hash: run.context.portfolio.contentHash,
    },
    decision: {
      context: run.context,
      proposal: run.prepared.proposal,
      hash: run.prepared.decisionHash,
    },
    policyEvaluation: {
      approved: run.policyEvaluation.approved,
      inputHash: run.policyInputHash,
      checks: [...run.policyEvaluation.checks],
    },
    execution: {
      state: run.policyEvaluation.approved ? "simulated" : "rejected",
      transactionSignature: null,
      slot: null,
      feeLamports: null,
      explorerUrl: null,
    },
    hashAnchoring: {
      status: "offchain_only",
      decisionHashAnchored: false,
      transactionSignature: null,
      memo: null,
      explanation:
        "This receipt hashes the decision offchain only. No Solana transaction anchors it.",
    },
    dataSource: run.universe.prestocks
      ? {
          universe: "prestocks",
          source: "PreStocks catalogue (research data, not execution quotes)",
          sourceUrl: run.universe.prestocks.sourceUrl,
          capturedAt: run.universe.prestocks.capturedAt,
          assetCount: run.universe.prestocks.assetCount,
          note: run.universe.note,
        }
      : {
          universe: "fixture",
          source: "Demo fixture universe",
          sourceUrl: null,
          capturedAt: run.generatedAt,
          assetCount: run.context.assets.length,
          note: run.universe.note,
        },
  });
  const receiptHash = hashCanonical(receipt);
  const verified = verifyProofReceipt(receipt, receiptHash).valid;
  if (!verified) throw new Error("Generated proof receipt failed local verification.");
  return { receipt, receiptHash };
}

type ResolvedUniverse = Readonly<{
  requested: DecisionUniverseSource;
  note: string | null;
  prestocks: PreStocksUniverse | null;
}>;

const FIXTURE_RESOLVED: ResolvedUniverse = {
  requested: "fixture",
  note: null,
  prestocks: null,
};

async function evaluateRun(
  bundle: AgentBundle,
  context: DecisionContext,
  scenario: DecisionScenario,
  provider: DecisionProvider | undefined,
  generatedAt: string,
  resolved: ResolvedUniverse = FIXTURE_RESOLVED,
): Promise<EvaluatedRun> {
  const prepared = await prepareWithFallback(
    context,
    bundle.riskPolicy.document,
    provider,
    resolved.prestocks
      ? prestocksTradeTarget(bundle, resolved.prestocks, scenario)
      : undefined,
  );
  const prestocksRun = resolved.prestocks
    ? prestocksPolicyFacts(
        bundle,
        context,
        scenario,
        resolved.prestocks,
        prepared.proposal,
      )
    : null;
  const facts = prestocksRun
    ? prestocksRun.facts
    : demoPolicyFacts(bundle, context, scenario);
  const universe: DecisionUniverseSummary = {
    requested: resolved.requested,
    used: resolved.prestocks ? "prestocks" : "fixture",
    note: resolved.note,
    prestocks:
      resolved.prestocks && prestocksRun
        ? summarizePreStocksUniverse(
            resolved.prestocks,
            prestocksRun,
            prepared.proposal,
          )
        : null,
  };
  const policyEvaluation = evaluatePolicy(
    prepared.proposal,
    bundle.riskPolicy.document,
    facts,
  );
  const policyInputHash = hashCanonical({
    proposal: prepared.proposal,
    policy: bundle.riskPolicy.document,
    facts,
  });
  return {
    generatedAt,
    context,
    prepared: {
      ...prepared,
      modelMetadata: { ...prepared.modelMetadata, scenario, universe },
    },
    policyEvaluation,
    policyInputHash,
    executionEligibility: eligibility(bundle, policyEvaluation.approved),
    universe,
  };
}

function toResult(
  bundle: AgentBundle,
  run: EvaluatedRun,
  identity: Readonly<{ decisionId: string; proofId: string | null }>,
  receipt: ReturnType<typeof buildReceipt>,
  persisted: DecisionRunResult["persisted"],
  scenario: DecisionScenario,
): DecisionRunResult {
  return {
    decisionId: identity.decisionId,
    proofId: identity.proofId,
    agent: {
      id: bundle.agent.id,
      slug: bundle.agent.slug,
      name: bundle.agent.name,
      mode: bundle.agent.mode,
    },
    scenario,
    universe: run.universe,
    generatedAt: run.generatedAt,
    proposal: run.prepared.proposal,
    modelMetadata: run.prepared.modelMetadata,
    policyEvaluation: run.policyEvaluation,
    executionEligibility: run.executionEligibility,
    receipt: receipt.receipt,
    receiptHash: receipt.receiptHash,
    receiptVerified: true,
    persisted,
  };
}

/**
 * Resolves the requested universe. PreStocks is read live and validated; any
 * failure (network, schema, fewer than two usable assets) falls back to the
 * fixture universe with the reason recorded on the run. No value is invented.
 */
async function resolveUniverse(
  requested: DecisionUniverseSource,
  loadCatalogue: () => Promise<PreStocksCatalogueLike>,
): Promise<ResolvedUniverse> {
  if (requested === "fixture") return FIXTURE_RESOLVED;
  try {
    const catalogue = await loadCatalogue();
    const universe = buildPreStocksUniverse(catalogue);
    const note =
      universe.excluded.length > 0
        ? `${String(universe.excluded.length)} catalogue row(s) were excluded from the universe: ${universe.excluded
            .map((item) => `${item.symbol} (${item.reason})`)
            .join("; ")}`
        : null;
    return { requested, note, prestocks: universe };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    const reason = /fetch failed/i.test(detail)
      ? "the PreStocks catalogue could not be reached"
      : detail;
    return {
      requested,
      prestocks: null,
      note: `PreStocks universe unavailable (${reason}). This run used the fixture universe instead; no PreStocks value was substituted.`,
    };
  }
}

async function runInMemory(
  bundle: AgentBundle,
  scenario: DecisionScenario,
  provider: DecisionProvider | undefined,
  context: DecisionContext | undefined,
  resolved: ResolvedUniverse,
): Promise<DecisionRunResult> {
  const generatedAt = freshGeneratedAt();
  const decisionId = randomUUID();
  const runBundle = resolved.prestocks
    ? withPreStocksUniverse(bundle, resolved.prestocks)
    : bundle;
  const decisionContext =
    context ??
    buildDecisionContext(
      runBundle,
      generatedAt,
      undefined,
      resolved.prestocks ?? undefined,
    );
  const run = await evaluateRun(
    runBundle,
    decisionContext,
    scenario,
    provider,
    generatedAt,
    resolved,
  );
  const receipt = buildReceipt(runBundle, run, decisionId);
  const result = toResult(
    runBundle,
    run,
    { decisionId, proofId: null },
    receipt,
    { store: "memory", note: "Kept in memory for this server instance only." },
    scenario,
  );
  rememberDecisionRun(result);
  return result;
}

/**
 * Persisted demo run: the fixture snapshot, decision, policy evaluation,
 * terminal execution attempt (simulated or rejected) and proof receipt are all
 * written in one transaction so a stored receipt always has stored inputs.
 */
const PERSISTED_UNIVERSE_NOTE =
  "Stored agents evaluate against their own immutable policy allowlist, so the PreStocks universe is not applied to this run. It is available on the Atlas demo run.";

async function runPersisted(
  bundle: AgentBundle,
  scenario: DecisionScenario,
  provider: DecisionProvider | undefined,
  database: NavisDatabase,
  requestedUniverse: DecisionUniverseSource,
): Promise<DecisionRunResult> {
  if (bundle.agent.mode !== "demo") throw new PersistentDecisionRunsNotEnabledError();
  if (!UUID_PATTERN.test(bundle.agent.id)) {
    throw new Error("Only persisted agents can store decision runs.");
  }
  const generatedAt = freshGeneratedAt();
  const snapshotId = randomUUID();
  const document = demoPortfolio(bundle, generatedAt);
  const contentHash = hashCanonical(document);
  const context = buildDecisionContext(bundle, generatedAt, {
    id: snapshotId,
    contentHash,
    document,
  });
  // The provider (live AI or deterministic demo) runs before any write so the
  // transaction never waits on a network call.
  const run = await evaluateRun(bundle, context, scenario, provider, generatedAt, {
    requested: requestedUniverse,
    prestocks: null,
    note: requestedUniverse === "prestocks" ? PERSISTED_UNIVERSE_NOTE : null,
  });

  return database.transaction(async (transaction) => {
    await persistPortfolioSnapshot(
      { id: snapshotId, custodyType: "watch_only", document, contentHash },
      transaction,
    );
    const decision = await persistPreparedDecision(run.prepared, transaction);
    await transaction.insert(schema.policyEvaluations).values({
      decisionId: decision.id,
      approved: run.policyEvaluation.approved,
      checks: [...run.policyEvaluation.checks],
      inputHash: run.policyInputHash,
      evaluatedAt: new Date(generatedAt),
    });
    await transaction
      .update(schema.decisions)
      .set({
        status: run.policyEvaluation.approved ? "approved" : "rejected",
        updatedAt: new Date(generatedAt),
      })
      .where(eq(schema.decisions.id, decision.id));

    const attempt = await createExecutionAttempt(
      {
        decisionId: decision.id,
        idempotencyKey: `demo-run:${decision.id}`,
        cluster: context.cluster,
      },
      transaction,
    );
    await transitionExecutionAttempt(
      attempt.id,
      run.policyEvaluation.approved ? "simulated" : "rejected",
      run.policyEvaluation.approved
        ? {
            metadata: {
              kind: "demo_simulation",
              scenario,
              note: "Demo mode: no transaction was built, signed or submitted.",
            },
          }
        : {
            errorCode: "policy_rejected",
            safeError: "Policy rejected the proposal; nothing was executed.",
            metadata: {
              kind: "demo_simulation",
              scenario,
              failedRules: run.policyEvaluation.checks
                .filter((check) => check.status === "fail")
                .map((check) => check.rule),
            },
          },
      transaction,
    );

    // The receipt names its own proof row id, so the URL, the row and the
    // signed document all agree on the receipt's identity.
    const proofId = randomUUID();
    const receipt = buildReceipt(bundle, run, proofId);
    const [proof] = await transaction
      .insert(schema.proofReceipts)
      .values({
        id: proofId,
        decisionId: decision.id,
        executionAttemptId: attempt.id,
        mode: context.mode,
        cluster: context.cluster,
        receiptHash: receipt.receiptHash,
        document: receipt.receipt,
        finalizedAt: new Date(generatedAt),
      })
      .returning({ id: schema.proofReceipts.id });
    if (!proof || proof.id !== proofId) {
      throw new Error("Proof receipt persistence returned no record.");
    }

    return toResult(
      bundle,
      run,
      { decisionId: decision.id, proofId: proof.id },
      receipt,
      { store: "database", note: DATABASE_PERSISTENCE_NOTE },
      scenario,
    );
  });
}

export async function runDecision({
  bundle,
  context,
  scenario,
  provider,
  database,
  universe = "fixture",
  loadCatalogue = getPreStocksCatalogue,
}: {
  bundle: AgentBundle;
  context?: DecisionContext;
  scenario: DecisionScenario;
  provider?: DecisionProvider;
  database?: NavisDatabase;
  /** Asset universe; callers default to "prestocks" when the catalogue may be reachable. */
  universe?: DecisionUniverseSource;
  /** Catalogue loader, injectable for tests; defaults to the live PreStocks client. */
  loadCatalogue?: () => Promise<PreStocksCatalogueLike>;
}): Promise<DecisionRunResult> {
  if (database) return runPersisted(bundle, scenario, provider, database, universe);
  if (bundle.agent.slug !== "atlas" || bundle.agent.mode !== "demo") {
    // Without a database only the public Atlas fixture may run in memory.
    throw new PersistentDecisionRunsNotEnabledError();
  }
  // A caller-supplied context already fixes the assets, so it always runs
  // against the fixture universe.
  const resolved = context
    ? FIXTURE_RESOLVED
    : await resolveUniverse(universe, loadCatalogue);
  return runInMemory(bundle, scenario, provider, context, resolved);
}
