import { describe, expect, it } from "vitest";

import { demoProof } from "../fixtures/demo-proof";
import { verifyProofReceipt } from "../lib/proofs/receipt";

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
});
