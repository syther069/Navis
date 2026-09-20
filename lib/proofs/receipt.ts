import { z } from "zod";

import {
  portfolioSnapshotDocumentSchema,
  decisionContextSchema,
  riskPolicyDocumentSchema,
  strategyDocumentSchema,
  tradeProposalSchema,
} from "../domain";
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

export function verifyProofReceipt(candidate: unknown, claimedReceiptHash: string) {
  const document = proofReceiptDocumentSchema.parse(candidate);
  const checks = {
    receipt: hashCanonical(document) === claimedReceiptHash,
    strategy: hashCanonical(document.strategy.document) === document.strategy.hash,
    riskPolicy:
      hashCanonical(document.riskPolicy.document) === document.riskPolicy.hash,
    portfolio: hashCanonical(document.portfolio.document) === document.portfolio.hash,
    decision:
      hashCanonical({
        context: document.decision.context,
        proposal: document.decision.proposal,
      }) === document.decision.hash,
    executionEvidence:
      document.execution.state === "confirmed"
        ? Boolean(
            document.execution.transactionSignature &&
            document.execution.slot &&
            document.execution.explorerUrl,
          )
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
