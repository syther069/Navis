import { z } from "zod";

import { assetSchema } from "./asset";
import {
  assetIdentifierSchema,
  entityIdSchema,
  executionModeSchema,
  sha256Schema,
  solanaClusterSchema,
  timestampSchema,
  versionSchema,
} from "./common";
import { portfolioSnapshotDocumentSchema } from "./treasury";

const rawAmountSchema = z.string().regex(/^\d+$/, "Amount must use integer base units");
const uiAmountSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.\d+)?$/, "UI amount must be a non-negative decimal string");

export const proposalAmountSchema = z
  .object({
    rawAmount: rawAmountSchema,
    decimals: z.number().int().min(0).max(18),
    uiAmount: uiAmountSchema,
  })
  .strict();

const proposalEvidenceSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(96),
    claim: z.string().trim().min(3).max(240),
  })
  .strict();

const proposalNarrative = {
  thesis: z.string().trim().min(20).max(600),
  evidence: z.array(proposalEvidenceSchema).min(1).max(12),
  confidenceBps: z.number().int().min(0).max(10_000),
  invalidationConditions: z.array(z.string().trim().min(3).max(240)).min(1).max(8),
  dataTimestamp: timestampSchema,
  expiresAt: timestampSchema,
};

const valueMovingProposalSchema = z
  .object({
    action: z.enum(["BUY", "SELL", "REBALANCE"]),
    inputMint: assetIdentifierSchema,
    outputMint: assetIdentifierSchema,
    inputAmount: proposalAmountSchema,
    minimumOutputAmount: proposalAmountSchema,
    maxSlippageBps: z.number().int().min(1).max(2_000),
    ...proposalNarrative,
  })
  .strict()
  .refine((proposal) => proposal.inputMint !== proposal.outputMint, {
    message: "Trade input and output mints must differ",
    path: ["outputMint"],
  });

const holdProposalSchema = z
  .object({
    action: z.literal("HOLD"),
    maxSlippageBps: z.literal(0),
    ...proposalNarrative,
  })
  .strict();

export const tradeProposalSchema = z
  .union([valueMovingProposalSchema, holdProposalSchema])
  .superRefine((proposal, context) => {
    const dataTimestamp = Date.parse(proposal.dataTimestamp);
    const expiresAt = Date.parse(proposal.expiresAt);
    if (expiresAt <= dataTimestamp) {
      context.addIssue({
        code: "custom",
        message: "Proposal expiry must be after its data timestamp",
        path: ["expiresAt"],
      });
    }
    if (expiresAt - dataTimestamp > 15 * 60 * 1_000) {
      context.addIssue({
        code: "custom",
        message: "Proposal validity cannot exceed 15 minutes",
        path: ["expiresAt"],
      });
    }
  });

export const marketInputSchema = z
  .object({
    id: z.string().trim().min(1).max(96),
    mint: assetIdentifierSchema,
    source: z.string().trim().min(1).max(120),
    observedAt: timestampSchema,
    priceUsdMicros: rawAmountSchema.optional(),
    liquidityUsdMicros: rawAmountSchema.optional(),
    quoteExpiresAt: timestampSchema.optional(),
  })
  .strict();

const versionReferenceSchema = z
  .object({
    id: entityIdSchema,
    version: versionSchema,
    hash: sha256Schema,
  })
  .strict();

const portfolioReferenceSchema = z
  .object({
    id: entityIdSchema,
    contentHash: sha256Schema,
    document: portfolioSnapshotDocumentSchema,
  })
  .strict();

export const decisionContextSchema = z
  .object({
    agentId: entityIdSchema,
    mode: executionModeSchema,
    cluster: solanaClusterSchema,
    requestedAt: timestampSchema,
    strategy: versionReferenceSchema,
    riskPolicy: versionReferenceSchema,
    portfolio: portfolioReferenceSchema,
    assets: z.array(assetSchema).min(1).max(32),
    marketInputs: z.array(marketInputSchema).max(64),
    permittedActions: z.array(z.enum(["BUY", "SELL", "HOLD", "REBALANCE"])).min(1),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.mode === "devnet" && decision.cluster !== "devnet") {
      context.addIssue({
        code: "custom",
        message: "Devnet decisions require the devnet cluster",
        path: ["cluster"],
      });
    }
    if (decision.mode === "mainnet" && decision.cluster !== "mainnet-beta") {
      context.addIssue({
        code: "custom",
        message: "Mainnet decisions require the mainnet-beta cluster",
        path: ["cluster"],
      });
    }
    if (
      decision.portfolio.document.agentId !== decision.agentId ||
      decision.portfolio.document.cluster !== decision.cluster
    ) {
      context.addIssue({
        code: "custom",
        message: "Portfolio snapshot must belong to the decision agent and cluster",
        path: ["portfolio"],
      });
    }
    if (new Set(decision.permittedActions).size !== decision.permittedActions.length) {
      context.addIssue({
        code: "custom",
        message: "Permitted actions must be unique",
        path: ["permittedActions"],
      });
    }
  });

export function parseProposalForContext(
  proposalCandidate: unknown,
  contextCandidate: unknown,
) {
  const decision = decisionContextSchema.parse(contextCandidate);
  const proposal = tradeProposalSchema.parse(proposalCandidate);
  if (!decision.permittedActions.includes(proposal.action)) {
    throw new Error(`Action ${proposal.action} is not permitted by the strategy`);
  }
  if (proposal.action === "HOLD") return proposal;

  const assets = new Map(decision.assets.map((asset) => [asset.mint, asset]));
  const inputAsset = assets.get(proposal.inputMint);
  const outputAsset = assets.get(proposal.outputMint);
  if (!inputAsset || !outputAsset) {
    throw new Error("Proposal contains a mint outside the bounded asset context");
  }
  if (
    inputAsset.decimals !== proposal.inputAmount.decimals ||
    outputAsset.decimals !== proposal.minimumOutputAmount.decimals
  ) {
    throw new Error("Proposal amount decimals do not match the referenced assets");
  }
  return proposal;
}

export const decisionRecordSchema = z.object({
  id: entityIdSchema,
  agentId: entityIdSchema,
  strategyVersionId: entityIdSchema,
  riskPolicyVersionId: entityIdSchema,
  portfolioSnapshotId: entityIdSchema,
  status: z.enum([
    "proposed",
    "approved",
    "rejected",
    "expired",
    "executing",
    "executed",
    "failed",
  ]),
  proposal: tradeProposalSchema,
  modelMetadata: z.object({
    provider: z.enum(["demo", "openai"]),
    model: z.string().min(1),
    requestId: z.string().min(1),
    generatedAt: timestampSchema,
  }),
  decisionHash: sha256Schema,
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type DecisionContext = z.infer<typeof decisionContextSchema>;
export type DecisionRecord = z.infer<typeof decisionRecordSchema>;
export type MarketInput = z.infer<typeof marketInputSchema>;
export type TradeProposal = z.infer<typeof tradeProposalSchema>;
