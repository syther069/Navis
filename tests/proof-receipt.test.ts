import { describe, expect, it } from "vitest";
import bs58 from "bs58";

import { demoProof } from "../fixtures/demo-proof";
import { createSolanaExplorerUrl } from "../lib/integrations/solana/config";
import { hashCanonical } from "../lib/proofs/canonical";
import { verifyProofReceipt } from "../lib/proofs/receipt";

function rehashDecision(document: typeof demoProof.document) {
  document.decision.hash = hashCanonical({
    context: document.decision.context,
    proposal: document.decision.proposal,
  });
}

function verifyRehashed(document: typeof demoProof.document) {
  return verifyProofReceipt(document, hashCanonical(document));
}

function confirmedDevnetReceipt() {
  const document = structuredClone(demoProof.document);
  document.mode = "devnet";
  document.decision.context.mode = "devnet";
  document.portfolio.document.source = "solana_rpc";
  document.decision.context.assets.forEach((asset) => {
    asset.verificationState = "provider_verified";
  });

  const allowedModes = document.riskPolicy.document.constraints.find(
    (constraint) => constraint.type === "allowed_modes",
  )!;
  allowedModes.modes = ["devnet"];
  document.riskPolicy.hash = hashCanonical(document.riskPolicy.document);
  document.decision.context.riskPolicy.hash = document.riskPolicy.hash;

  const allowedModesCheck = document.policyEvaluation.checks.find(
    (check) => check.rule === "allowed_modes",
  )!;
  allowedModesCheck.observed = "devnet/devnet";
  allowedModesCheck.threshold = "devnet";
  const verifiedAssetsCheck = document.policyEvaluation.checks.find(
    (check) => check.rule === "verified_assets",
  )!;
  verifiedAssetsCheck.observed = "all verified";
  verifiedAssetsCheck.threshold = "verified assets only";

  const signature = bs58.encode(new Uint8Array(64).fill(7));
  document.execution = {
    state: "confirmed",
    transactionSignature: signature,
    slot: "903",
    feeLamports: "5000",
    explorerUrl: createSolanaExplorerUrl("tx", signature, "devnet"),
  };
  rehashDecision(document);
  return document;
}

describe("public proof receipt", () => {
  it("verifies every canonical demo evidence hash without onchain claims", () => {
    const result = verifyProofReceipt(demoProof.document, demoProof.receiptHash);
    expect(result.valid).toBe(true);
    expect(result.checks).toEqual({
      receipt: true,
      strategy: true,
      riskPolicy: true,
      portfolio: true,
      decision: true,
      strategyReference: true,
      riskPolicyReference: true,
      portfolioReference: true,
      proposalContext: true,
      modeClusterCoherence: true,
      agentCoherence: true,
      policyEvidence: true,
      policyApproval: true,
      executionEvidence: true,
      hashAnchoring: true,
    });
    expect(result.document.execution).toMatchObject({
      state: "simulated",
      transactionSignature: null,
      explorerUrl: null,
    });
    expect(result.document.hashAnchoring).toMatchObject({
      status: "offchain_only",
      decisionHashAnchored: false,
      transactionSignature: null,
      memo: null,
    });
  });

  it("rejects a mutated document against the published receipt hash", () => {
    const mutated = structuredClone(demoProof.document);
    mutated.decision.proposal.confidenceBps = 9_999;
    expect(verifyProofReceipt(mutated, demoProof.receiptHash).valid).toBe(false);
  });

  it("cannot relabel demo fixture evidence or add a fake signature", () => {
    const relabelled = { ...structuredClone(demoProof.document), mode: "devnet" };
    expect(() => verifyProofReceipt(relabelled, demoProof.receiptHash)).toThrow(
      "Demo fixture evidence cannot be labelled",
    );

    const fakeOnchain = {
      ...structuredClone(demoProof.document),
      execution: {
        ...demoProof.document.execution,
        transactionSignature: "5".repeat(64),
        explorerUrl: "https://explorer.solana.com/tx/fake?cluster=devnet",
      },
    };
    expect(() => verifyProofReceipt(fakeOnchain, demoProof.receiptHash)).toThrow(
      "Demo receipts cannot contain confirmed onchain evidence",
    );
  });

  it("rejects demo receipts that claim memo or signature anchoring", () => {
    const fakeAnchoring = {
      ...structuredClone(demoProof.document),
      hashAnchoring: {
        status: "memo_instruction",
        decisionHashAnchored: true,
        transactionSignature: "5".repeat(64),
        memo: `navis:${demoProof.document.decision.hash.slice(0, 16)}`,
        explanation: "Fake memo anchoring claim.",
      },
    };

    expect(() => verifyProofReceipt(fakeAnchoring, demoProof.receiptHash)).toThrow(
      "Demo receipts cannot claim onchain hash anchoring",
    );
  });

  it("rejects a rehashed decision with mismatched document references", () => {
    const strategyMismatch = structuredClone(demoProof.document);
    strategyMismatch.decision.context.strategy.hash = "a".repeat(64);
    rehashDecision(strategyMismatch);
    expect(verifyRehashed(strategyMismatch).checks.strategyReference).toBe(false);

    const policyMismatch = structuredClone(demoProof.document);
    policyMismatch.decision.context.riskPolicy.hash = "b".repeat(64);
    rehashDecision(policyMismatch);
    expect(verifyRehashed(policyMismatch).checks.riskPolicyReference).toBe(false);
  });

  it("rejects rehashed portfolio and agent relationship mismatches", () => {
    const contextPortfolioMismatch = structuredClone(demoProof.document);
    contextPortfolioMismatch.decision.context.portfolio.document.slot = "903";
    contextPortfolioMismatch.decision.context.portfolio.contentHash = hashCanonical(
      contextPortfolioMismatch.decision.context.portfolio.document,
    );
    rehashDecision(contextPortfolioMismatch);
    expect(verifyRehashed(contextPortfolioMismatch).checks.portfolioReference).toBe(
      false,
    );

    const agentMismatch = structuredClone(demoProof.document);
    agentMismatch.portfolio.document = structuredClone(
      agentMismatch.portfolio.document,
    );
    agentMismatch.portfolio.document.agentId = "different_agent";
    agentMismatch.portfolio.hash = hashCanonical(agentMismatch.portfolio.document);
    expect(verifyRehashed(agentMismatch).checks.agentCoherence).toBe(false);
  });

  it("rejects rehashed mode and cluster mismatches", () => {
    const modeMismatch = structuredClone(demoProof.document);
    modeMismatch.decision.context.mode = "devnet";
    rehashDecision(modeMismatch);
    expect(verifyRehashed(modeMismatch).checks.modeClusterCoherence).toBe(false);

    const clusterMismatch = structuredClone(demoProof.document);
    clusterMismatch.cluster = "mainnet-beta";
    expect(verifyRehashed(clusterMismatch).checks.modeClusterCoherence).toBe(false);
  });

  it("rejects rehashed policy evidence and approval mismatches", () => {
    const evidenceMismatch = structuredClone(demoProof.document);
    const allowedModes = evidenceMismatch.policyEvaluation.checks.find(
      (check) => check.rule === "allowed_modes",
    )!;
    allowedModes.observed = "mainnet/mainnet-beta";
    expect(verifyRehashed(evidenceMismatch).checks.policyEvidence).toBe(false);

    const approvalMismatch = structuredClone(demoProof.document);
    approvalMismatch.policyEvaluation.approved = false;
    expect(verifyRehashed(approvalMismatch).checks.policyApproval).toBe(false);
  });

  it("accepts syntactically valid confirmed execution evidence without claiming chain verification", () => {
    const document = confirmedDevnetReceipt();

    expect(verifyRehashed(document).checks.executionEvidence).toBe(true);
  });

  it("rejects confirmed execution when policy evaluation rejected it", () => {
    const document = confirmedDevnetReceipt();
    document.policyEvaluation.approved = false;

    expect(verifyRehashed(document).checks.executionEvidence).toBe(false);
  });

  it("rejects malformed confirmed transaction signatures", () => {
    const document = confirmedDevnetReceipt();
    document.execution.transactionSignature = "not-a-base58-signature";
    document.execution.explorerUrl = createSolanaExplorerUrl(
      "tx",
      document.execution.transactionSignature,
      "devnet",
    );

    expect(verifyRehashed(document).checks.executionEvidence).toBe(false);
  });

  it("rejects explorer evidence for the wrong signature or cluster", () => {
    const wrongSignature = confirmedDevnetReceipt();
    const otherSignature = bs58.encode(new Uint8Array(64).fill(8));
    wrongSignature.execution.explorerUrl = createSolanaExplorerUrl(
      "tx",
      otherSignature,
      "devnet",
    );
    expect(verifyRehashed(wrongSignature).checks.executionEvidence).toBe(false);

    const wrongCluster = confirmedDevnetReceipt();
    wrongCluster.execution.explorerUrl = createSolanaExplorerUrl(
      "tx",
      wrongCluster.execution.transactionSignature!,
      "mainnet-beta",
    );
    expect(verifyRehashed(wrongCluster).checks.executionEvidence).toBe(false);
  });
});
