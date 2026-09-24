import type { PreparedExampleRecord } from "@/components/workspace/types";
import type { AgentBundle } from "@workspace/navis-core/lib/db/repositories/types";
import { verifyProofReceipt, type ProofReceiptDocument } from "@/lib/proofs/receipt";

export const PREPARED_EXAMPLE_NOTE =
  "Original bundled static example, not a newly generated or database-stored decision. Its fixture balances, prices, liquidity, and timestamps are fictional. No model request, wallet approval, or onchain transaction was recorded.";

/**
 * Project the existing receipt into the structured record's run-shaped input.
 * Preserve every evidence value and hash. Static provenance has its own
 * presentation discriminator so it cannot pretend to be a persisted API run.
 */
export function preparedExampleRecord(
  proof: { id: string; document: ProofReceiptDocument; receiptHash: string },
  bundle: AgentBundle,
): PreparedExampleRecord {
  const receipt = proof.document;
  return {
    decisionId: "demo-decision",
    proofId: proof.id,
    agent: {
      id: bundle.agent.id,
      slug: bundle.agent.slug,
      name: bundle.agent.name,
      mode: receipt.mode,
    },
    scenario: null,
    universe: {
      requested: "fixture",
      used: "fixture",
      note: "Original prepared fixture universe; no live catalogue or new run was requested.",
      prestocks: null,
    },
    generatedAt: receipt.generatedAt,
    proposal: receipt.decision.proposal,
    modelMetadata: {
      provider: "Static fixture",
      model: "No model invocation recorded",
      requestId: null,
      generatedAt: null,
    },
    policyEvaluation: {
      approved: receipt.policyEvaluation.approved,
      checks: receipt.policyEvaluation.checks,
    },
    executionEligibility: {
      eligible: false,
      reason: "Prepared static simulation only; no wallet authorization or execution was requested.",
    },
    receipt,
    receiptHash: proof.receiptHash,
    receiptVerified: verifyProofReceipt(receipt, proof.receiptHash).valid,
    persisted: { store: "static_fixture", note: PREPARED_EXAMPLE_NOTE },
  };
}