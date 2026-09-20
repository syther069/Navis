import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { AgentBundle } from "../db/repositories/types";
import * as schema from "../db/schema";
import {
  decisionContextSchema,
  portfolioSnapshotDocumentSchema,
  type DecisionContext,
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
import { hashCanonical } from "../proofs/canonical";
import {
  proofReceiptDocumentSchema,
  verifyProofReceipt,
  type ProofReceiptDocument,
} from "../proofs/receipt";
import { prepareDecision } from "./decisions";
import { getRememberedDecisionRun, rememberDecisionRun } from "./decision-run-store";

type NavisDatabase = NodePgDatabase<typeof schema>;
let lastGeneratedAtMs = 0;

function freshGeneratedAt() {
  const now = Date.now();
  lastGeneratedAtMs = Math.max(now, lastGeneratedAtMs + 1);
  return new Date(lastGeneratedAtMs).toISOString();
}

export type DecisionScenario = "balanced" | "oversized";
export class PersistentDecisionRunsNotEnabledError extends Error {
  constructor() {
    super(
      "Fresh decisions for persistent agents are not enabled yet; demo simulation only.",
    );
    this.name = "PersistentDecisionRunsNotEnabledError";
  }
}

export type RunModelMetadata = DecisionProviderMetadata &
  Readonly<{
    fallback?: {
      used: true;
      reason: string;
      attemptedProvider: string;
    };
  }>;

export type DecisionRunResult = Readonly<{
  decisionId: string;
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
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      decisionId,
    )
  ) {
    return null;
  }

  const [row] = await database
    .select({
      decision: schema.decisions,
      evaluation: schema.policyEvaluations,
      proof: schema.proofReceipts,
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
  return {
    decisionId,
    generatedAt: row.proof.finalizedAt.toISOString(),
    proposal: row.decision.proposal,
    modelMetadata: row.decision.modelMetadata as RunModelMetadata,
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
      note: "Loaded from the configured database.",
    },
  };
}

function demoPortfolio(bundle: AgentBundle, generatedAt: string) {
  const [inputAsset, outputAsset, unpricedAsset] = bundle.assets;
  if (!inputAsset || !outputAsset || !unpricedAsset) {
    throw new Error("A decision run requires at least three configured assets.");
  }
  return portfolioSnapshotDocumentSchema.parse({
    agentId: bundle.agent.id,
    owner: "11111111111111111111111111111111",
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

export function buildDecisionContext(
  bundle: AgentBundle,
  generatedAt: string,
): DecisionContext {
  const portfolio = demoPortfolio(bundle, generatedAt);
  const portfolioHash = hashCanonical(portfolio);
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
      id: `run_snapshot_${randomUUID()}`,
      contentHash: portfolioHash,
      document: portfolio,
    },
    assets: [...bundle.assets],
    marketInputs: [
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

function demoPolicyFacts(
  bundle: AgentBundle,
  context: DecisionContext,
  scenario: DecisionScenario,
): PolicyFacts {
  if (
    bundle.agent.id !== "demo_agent_atlas" ||
    bundle.agent.slug !== "atlas" ||
    context.mode !== "demo" ||
    context.portfolio.document.source !== "demo_fixture"
  ) {
    throw new PersistentDecisionRunsNotEnabledError();
  }
  const [inputAsset, outputAsset] = context.assets;
  if (!inputAsset || !outputAsset) {
    throw new Error("A decision run requires two configured assets.");
  }
  return {
    now: context.requestedAt,
    mode: context.mode,
    cluster: context.cluster,
    portfolioValueUsdMicros: "400000000",
    tradeValueUsdMicros: scenario === "oversized" ? "200000000" : "20000000",
    postReserveUsdMicros: scenario === "oversized" ? "10000000" : "100000000",
    postPositions: [
      { mint: inputAsset.mint, valueUsdMicros: "100000000" },
      { mint: outputAsset.mint, valueUsdMicros: "120000000" },
    ],
    dailyTurnoverUsdMicros: "40000000",
    dataObservedAt: context.requestedAt,
    quoteExpiresAt: new Date(Date.parse(context.requestedAt) + 300_000).toISOString(),
    availableLiquidityUsdMicros: "2000000000",
    assetVerification: Object.fromEntries(
      context.assets.map((asset) => [asset.mint, asset.verificationState]),
    ),
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
  requestedProvider?: DecisionProvider,
) {
  let provider: DecisionProvider;
  try {
    provider = requestedProvider ?? createDecisionProvider();
    return await prepareDecision(context, provider);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown provider failure";
    const prepared = await prepareDecision(context, new DemoDecisionProvider());
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

export async function runDecision({
  bundle,
  context,
  scenario,
  provider,
  database,
}: {
  bundle: AgentBundle;
  context?: DecisionContext;
  scenario: DecisionScenario;
  provider?: DecisionProvider;
  database?: NavisDatabase;
}): Promise<DecisionRunResult> {
  if (database) {
    throw new PersistentDecisionRunsNotEnabledError();
  }
  const generatedAt = freshGeneratedAt();
  const decisionId = randomUUID();
  const decisionContext = context ?? buildDecisionContext(bundle, generatedAt);
  const prepared = await prepareWithFallback(decisionContext, provider);
  const facts = demoPolicyFacts(bundle, decisionContext, scenario);
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
  const executionEligibility = eligibility(bundle, policyEvaluation.approved);
  const receipt = proofReceiptDocumentSchema.parse({
    version: 1,
    proofId: decisionId,
    mode: decisionContext.mode,
    cluster: decisionContext.cluster,
    generatedAt,
    strategy: { document: bundle.strategy.document, hash: bundle.strategy.hash },
    riskPolicy: {
      document: bundle.riskPolicy.document,
      hash: bundle.riskPolicy.hash,
    },
    portfolio: {
      document: decisionContext.portfolio.document,
      hash: decisionContext.portfolio.contentHash,
    },
    decision: {
      context: decisionContext,
      proposal: prepared.proposal,
      hash: prepared.decisionHash,
    },
    policyEvaluation: {
      approved: policyEvaluation.approved,
      inputHash: policyInputHash,
      checks: [...policyEvaluation.checks],
    },
    execution: {
      state: policyEvaluation.approved ? "simulated" : "rejected",
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
  });
  const receiptHash = hashCanonical(receipt);
  const verified = verifyProofReceipt(receipt, receiptHash).valid;
  if (!verified) throw new Error("Generated proof receipt failed local verification.");

  const persisted: DecisionRunResult["persisted"] = {
    store: "memory",
    note: "Kept in memory for this server instance only.",
  };
  const result: DecisionRunResult = {
    decisionId,
    generatedAt,
    proposal: prepared.proposal,
    modelMetadata: prepared.modelMetadata,
    policyEvaluation,
    executionEligibility,
    receipt,
    receiptHash,
    receiptVerified: verified,
    persisted,
  };
  if (!database) rememberDecisionRun(result);
  return result;
}
