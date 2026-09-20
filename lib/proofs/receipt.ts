import bs58 from "bs58";
import { z } from "zod";

import {
  portfolioSnapshotDocumentSchema,
  decisionContextSchema,
  riskPolicyDocumentSchema,
  strategyDocumentSchema,
  tradeProposalSchema,
} from "../domain";
import { createSolanaExplorerUrl } from "../integrations/solana/config";
import { hashCanonical } from "./canonical";

export const proofReceiptDocumentSchema = z
  .object({
    version: z.literal(1),
    proofId: z.string().min(3),
    mode: z.enum(["demo", "devnet", "mainnet"]),
    cluster: z.enum(["devnet", "mainnet-beta"]),
    generatedAt: z.string().datetime({ offset: true }),
    strategy: z.object({
      document: strategyDocumentSchema,
      hash: z.string().length(64),
    }),
    riskPolicy: z.object({
      document: riskPolicyDocumentSchema,
      hash: z.string().length(64),
    }),
    portfolio: z.object({
      document: portfolioSnapshotDocumentSchema,
      hash: z.string().length(64),
    }),
    decision: z.object({
      context: decisionContextSchema,
      proposal: tradeProposalSchema,
      hash: z.string().length(64),
    }),
    policyEvaluation: z.object({
      approved: z.boolean(),
      inputHash: z.string().length(64),
      checks: z.array(
        z.object({
          rule: z.string(),
          status: z.enum(["pass", "fail", "warn"]),
          observed: z.string(),
          threshold: z.string(),
          explanation: z.string(),
        }),
      ),
    }),
    execution: z.object({
      state: z.enum(["simulated", "confirmed", "failed", "rejected"]),
      transactionSignature: z.string().nullable(),
      slot: z.string().nullable(),
      feeLamports: z.string().nullable(),
      explorerUrl: z.url().nullable(),
    }),
    hashAnchoring: z.object({
      status: z.enum(["offchain_only", "signature_only", "memo_instruction"]),
      decisionHashAnchored: z.boolean(),
      transactionSignature: z.string().nullable(),
      memo: z.string().nullable(),
      explanation: z.string().min(1),
    }),
  })
  .superRefine((receipt, context) => {
    if (receipt.mode === "demo") {
      if (
        receipt.execution.state === "confirmed" ||
        receipt.execution.transactionSignature ||
        receipt.execution.explorerUrl
      ) {
        context.addIssue({
          code: "custom",
          message: "Demo receipts cannot contain confirmed onchain evidence.",
          path: ["execution"],
        });
      }
      if (
        receipt.hashAnchoring.status !== "offchain_only" ||
        receipt.hashAnchoring.decisionHashAnchored ||
        receipt.hashAnchoring.transactionSignature ||
        receipt.hashAnchoring.memo
      ) {
        context.addIssue({
          code: "custom",
          message: "Demo receipts cannot claim onchain hash anchoring.",
          path: ["hashAnchoring"],
        });
      }
    } else if (
      receipt.portfolio.document.source === "demo_fixture" ||
      receipt.decision.context.mode === "demo"
    ) {
      context.addIssue({
        code: "custom",
        message: "Demo fixture evidence cannot be labelled as a live execution mode.",
        path: ["mode"],
      });
    }

    if (receipt.mode === "mainnet" && receipt.cluster !== "mainnet-beta") {
      context.addIssue({
        code: "custom",
        message: "Mainnet receipts require mainnet-beta.",
        path: ["cluster"],
      });
    }
    if (receipt.mode === "devnet" && receipt.cluster !== "devnet") {
      context.addIssue({
        code: "custom",
        message: "Devnet receipts require devnet.",
        path: ["cluster"],
      });
    }

    if (receipt.hashAnchoring.status === "offchain_only") {
      if (
        receipt.hashAnchoring.decisionHashAnchored ||
        receipt.hashAnchoring.transactionSignature ||
        receipt.hashAnchoring.memo
      ) {
        context.addIssue({
          code: "custom",
          message: "Offchain-only receipts cannot include anchoring evidence.",
          path: ["hashAnchoring"],
        });
      }
    } else {
      if (!receipt.hashAnchoring.decisionHashAnchored) {
        context.addIssue({
          code: "custom",
          message: "Onchain anchoring claims must mark the decision hash as anchored.",
          path: ["hashAnchoring", "decisionHashAnchored"],
        });
      }
      if (
        !receipt.execution.transactionSignature ||
        receipt.hashAnchoring.transactionSignature !==
          receipt.execution.transactionSignature
      ) {
        context.addIssue({
          code: "custom",
          message: "Onchain anchoring must reference the execution signature.",
          path: ["hashAnchoring", "transactionSignature"],
        });
      }
    }

    if (
      receipt.hashAnchoring.status === "memo_instruction" &&
      !receipt.hashAnchoring.memo?.includes(receipt.decision.hash.slice(0, 16))
    ) {
      context.addIssue({
        code: "custom",
        message: "Memo anchoring must include the compact decision hash.",
        path: ["hashAnchoring", "memo"],
      });
    }
  });

export type ProofReceiptDocument = z.infer<typeof proofReceiptDocumentSchema>;

function policyEvidenceMatches(document: ProofReceiptDocument) {
  const checksByRule = new Map(
    document.policyEvaluation.checks.map((check) => [check.rule, check]),
  );
  if (checksByRule.size !== document.policyEvaluation.checks.length) return false;

  const constraintRules = document.riskPolicy.document.constraints.map(
    (constraint) => constraint.type,
  );
  if (
    !constraintRules.every((rule) => checksByRule.has(rule)) ||
    !checksByRule.has("verified_assets")
  ) {
    return false;
  }

  const proposal = document.decision.proposal;
  const proposalMints =
    proposal.action === "HOLD" ? [] : [proposal.inputMint, proposal.outputMint];
  const allowedMints = document.riskPolicy.document.constraints.find(
    (constraint) => constraint.type === "allowed_mints",
  )!;
  const allowedModes = document.riskPolicy.document.constraints.find(
    (constraint) => constraint.type === "allowed_modes",
  )!;
  const maxSlippage = document.riskPolicy.document.constraints.find(
    (constraint) => constraint.type === "max_slippage_bps",
  )!;
  const assetVerification = new Map(
    document.decision.context.assets.map((asset) => [
      asset.mint,
      asset.verificationState,
    ]),
  );
  const unverified = proposalMints.filter(
    (mint) =>
      !["provider_verified", "onchain_verified"].includes(
        assetVerification.get(mint) ?? "unknown",
      ),
  );

  const expected = {
    allowed_mints: {
      status: proposalMints.every((mint) => allowedMints.mints.includes(mint))
        ? "pass"
        : "fail",
      observed: proposalMints.join(", ") || "none (HOLD)",
      threshold: allowedMints.mints.join(", "),
    },
    allowed_modes: {
      status: allowedModes.modes.includes(document.decision.context.mode)
        ? "pass"
        : "fail",
      observed: `${document.decision.context.mode}/${document.decision.context.cluster}`,
      threshold: allowedModes.modes.join(", "),
    },
    max_slippage_bps: {
      status: proposal.maxSlippageBps <= maxSlippage.value ? "pass" : "fail",
      observed: String(proposal.maxSlippageBps),
      threshold: String(maxSlippage.value),
    },
    verified_assets: {
      status:
        unverified.length === 0 || document.decision.context.mode === "demo"
          ? "pass"
          : "fail",
      observed: unverified.join(", ") || "all verified",
      threshold:
        document.decision.context.mode === "demo"
          ? "demo identifiers allowed"
          : "verified assets only",
    },
  } as const;

  return Object.entries(expected).every(([rule, values]) => {
    const actual = checksByRule.get(rule);
    return (
      actual?.status === values.status &&
      actual.observed === values.observed &&
      actual.threshold === values.threshold
    );
  });
}

function hasValidConfirmedExecutionEvidence(document: ProofReceiptDocument) {
  const signature = document.execution.transactionSignature;
  if (
    !document.policyEvaluation.approved ||
    !signature ||
    !document.execution.slot ||
    !document.execution.explorerUrl
  ) {
    return false;
  }

  try {
    if (bs58.decode(signature).length !== 64) return false;
  } catch {
    return false;
  }

  return (
    document.execution.explorerUrl ===
    createSolanaExplorerUrl("tx", signature, document.cluster)
  );
}

export function verifyProofReceipt(candidate: unknown, claimedReceiptHash: string) {
  const document = proofReceiptDocumentSchema.parse(candidate);
  const context = document.decision.context;
  const proposal = document.decision.proposal;
  const strategyUniverse = new Set(document.strategy.document.universe);
  const contextAssets = new Set(context.assets.map((asset) => asset.mint));
  const proposalMints =
    proposal.action === "HOLD" ? [] : [proposal.inputMint, proposal.outputMint];
  const checks = {
    receipt: hashCanonical(document) === claimedReceiptHash,
    strategy: hashCanonical(document.strategy.document) === document.strategy.hash,
    riskPolicy:
      hashCanonical(document.riskPolicy.document) === document.riskPolicy.hash,
    portfolio: hashCanonical(document.portfolio.document) === document.portfolio.hash,
    decision:
      hashCanonical({
        context,
        proposal,
      }) === document.decision.hash,
    strategyReference:
      context.strategy.hash === document.strategy.hash &&
      document.strategy.document.riskPolicyVersion === context.riskPolicy.version &&
      context.permittedActions.every((action) =>
        document.strategy.document.allowedActions.includes(action),
      ) &&
      context.assets.every((asset) => strategyUniverse.has(asset.mint)),
    riskPolicyReference: context.riskPolicy.hash === document.riskPolicy.hash,
    portfolioReference:
      context.portfolio.contentHash === document.portfolio.hash &&
      hashCanonical(context.portfolio.document) === document.portfolio.hash,
    proposalContext:
      context.permittedActions.includes(proposal.action) &&
      proposalMints.every((mint) => contextAssets.has(mint)),
    modeClusterCoherence:
      document.mode === context.mode &&
      document.cluster === context.cluster &&
      document.portfolio.document.cluster === context.cluster &&
      context.portfolio.document.cluster === context.cluster &&
      context.assets.every((asset) => asset.cluster === context.cluster),
    agentCoherence:
      document.portfolio.document.agentId === context.agentId &&
      context.portfolio.document.agentId === context.agentId,
    policyEvidence: policyEvidenceMatches(document),
    policyApproval:
      document.policyEvaluation.approved ===
      document.policyEvaluation.checks.every((check) => check.status !== "fail"),
    executionEvidence:
      document.execution.state === "confirmed"
        ? hasValidConfirmedExecutionEvidence(document)
        : document.execution.transactionSignature === null &&
          document.execution.explorerUrl === null,
    hashAnchoring:
      document.hashAnchoring.status === "offchain_only"
        ? !document.hashAnchoring.decisionHashAnchored &&
          document.hashAnchoring.transactionSignature === null &&
          document.hashAnchoring.memo === null
        : document.hashAnchoring.decisionHashAnchored &&
          document.hashAnchoring.transactionSignature ===
            document.execution.transactionSignature,
  };

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    document,
  };
}
