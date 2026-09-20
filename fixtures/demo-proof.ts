import { demoAgentBundle } from "./demo-agent";
import { evaluatePolicy } from "../lib/policy/runner";
import { hashCanonical } from "../lib/proofs/canonical";
import type { ProofReceiptDocument } from "../lib/proofs/receipt";
import { projectProofTimeline } from "../lib/proofs/timeline";

const timestamp = "2026-09-17T08:00:00.000Z";
const expiresAt = "2026-09-17T08:05:00.000Z";
const [inputAsset, outputAsset] = demoAgentBundle.assets;
const unpricedAsset = demoAgentBundle.assets[2];

if (!inputAsset || !outputAsset || !unpricedAsset) {
  throw new Error("Demo proof requires three assets.");
}

const portfolioDocument = {
  agentId: demoAgentBundle.agent.id,
  owner: "11111111111111111111111111111111",
  cluster: "devnet" as const,
  slot: "902",
  source: "demo_fixture" as const,
  capturedAt: timestamp,
  balances: [
    { kind: "native" as const, rawAmount: "2000000000", decimals: 9, slot: "902" },
    {
      kind: "spl-token" as const,
      mint: inputAsset.mint,
      rawAmount: "100000000",
      decimals: 6,
      slot: "902",
    },
    {
      kind: "spl-token" as const,
      mint: outputAsset.mint,
      rawAmount: "100000000",
      decimals: 6,
      slot: "902",
    },
    {
      kind: "spl-token" as const,
      mint: unpricedAsset.mint,
      rawAmount: "50000000",
      decimals: 6,
      slot: "902",
    },
  ],
  valuations: [
    {
      status: "priced" as const,
      mint: inputAsset.mint,
      valueUsdMicros: "120000000",
      source: "demo_fixture",
      observedAt: timestamp,
    },
    {
      status: "unpriced" as const,
      mint: unpricedAsset.mint,
      reason: "No trusted quote exists for this demo asset.",
    },
    {
      status: "priced" as const,
      mint: outputAsset.mint,
      valueUsdMicros: "100000000",
      source: "demo_fixture",
      observedAt: timestamp,
    },
  ],
};
const portfolioHash = hashCanonical(portfolioDocument);

const proposal = {
  action: "REBALANCE" as const,
  inputMint: inputAsset.mint,
  outputMint: outputAsset.mint,
  inputAmount: { rawAmount: "1000000", decimals: 6, uiAmount: "1" },
  minimumOutputAmount: { rawAmount: "990000", decimals: 6, uiAmount: "0.99" },
  maxSlippageBps: 75,
  thesis:
    "The deterministic demo signal proposes a bounded one-unit rebalance for policy evaluation.",
  evidence: [
    {
      sourceId: "demo_relative_strength_fixture",
      claim: "A labelled fixture selects the first eligible asset pair.",
    },
  ],
  confidenceBps: 6500,
  invalidationConditions: ["The proposal expires or either asset leaves the universe."],
  dataTimestamp: timestamp,
  expiresAt,
};

const decisionContext = {
  agentId: demoAgentBundle.agent.id,
  mode: "demo" as const,
  cluster: "devnet" as const,
  requestedAt: timestamp,
  strategy: {
    id: demoAgentBundle.strategy.id,
    version: demoAgentBundle.strategy.version,
    hash: demoAgentBundle.strategy.hash,
  },
  riskPolicy: {
    id: demoAgentBundle.riskPolicy.id,
    version: demoAgentBundle.riskPolicy.version,
    hash: demoAgentBundle.riskPolicy.hash,
  },
  portfolio: {
    id: "demo_snapshot_atlas_902",
    contentHash: portfolioHash,
    document: portfolioDocument,
  },
  assets: [...demoAgentBundle.assets],
  marketInputs: [
    {
      id: "demo_relative_strength_fixture",
      mint: outputAsset.mint,
      source: "demo_fixture",
      observedAt: timestamp,
      liquidityUsdMicros: "2000000000",
      quoteExpiresAt: expiresAt,
    },
  ],
  permittedActions: ["HOLD", "REBALANCE"] as ("HOLD" | "REBALANCE")[],
};
const decisionHash = hashCanonical({ context: decisionContext, proposal });

const facts = {
  now: timestamp,
  mode: "demo" as const,
  cluster: "devnet" as const,
  portfolioValueUsdMicros: "400000000",
  tradeValueUsdMicros: "20000000",
  postReserveUsdMicros: "100000000",
  postPositions: [
    { mint: inputAsset.mint, valueUsdMicros: "100000000" },
    { mint: outputAsset.mint, valueUsdMicros: "120000000" },
  ],
  dailyTurnoverUsdMicros: "40000000",
  dataObservedAt: timestamp,
  quoteExpiresAt: expiresAt,
  availableLiquidityUsdMicros: "2000000000",
  assetVerification: Object.fromEntries(
    demoAgentBundle.assets.map((asset) => [asset.mint, asset.verificationState]),
  ),
};
const policyEvaluation = evaluatePolicy(
  proposal,
  demoAgentBundle.riskPolicy.document,
  facts,
);
const policyInputHash = hashCanonical({
  proposal,
  policy: demoAgentBundle.riskPolicy.document,
  facts,
});

const document: ProofReceiptDocument = {
  version: 1,
  proofId: "demo-proof",
  mode: "demo",
  cluster: "devnet",
  generatedAt: "2026-09-17T08:00:02.000Z",
  strategy: {
    document: demoAgentBundle.strategy.document,
    hash: demoAgentBundle.strategy.hash,
  },
  riskPolicy: {
    document: demoAgentBundle.riskPolicy.document,
    hash: demoAgentBundle.riskPolicy.hash,
  },
  portfolio: { document: portfolioDocument, hash: portfolioHash },
  decision: { context: decisionContext, proposal, hash: decisionHash },
  policyEvaluation: {
    approved: policyEvaluation.approved,
    inputHash: policyInputHash,
    checks: [...policyEvaluation.checks],
  },
  execution: {
    state: "simulated",
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
      "The demo receipt hashes the decision offchain only; no memo instruction or transaction signature anchors it on Solana.",
  },
};

export const demoProof = Object.freeze({
  id: "demo-proof",
  title: "Atlas rebalance simulation",
  receiptHash: hashCanonical(document),
  document,
  timeline: projectProofTimeline({
    mode: "demo",
    snapshot: {
      capturedAt: timestamp,
      hash: portfolioHash,
      source: "demo_fixture",
    },
    decision: {
      createdAt: timestamp,
      hash: decisionHash,
      action: proposal.action,
    },
    evaluation: {
      evaluatedAt: "2026-09-17T08:00:01.000Z",
      approved: policyEvaluation.approved,
      inputHash: policyInputHash,
    },
    execution: {
      timestamp: document.generatedAt,
      state: "simulated",
      signature: null,
    },
  }),
});
