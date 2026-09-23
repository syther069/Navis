import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProofReceiptView } from "../components/proofs/proof-receipt-view";
import { demoProof } from "../fixtures/demo-proof";
import { hashCanonical } from "../lib/proofs/canonical";
import { verifyProofReceipt, type ProofReceiptDocument } from "../lib/proofs/receipt";

function renderReceipt(document: ProofReceiptDocument) {
  const receiptHash = hashCanonical(document);
  return renderToStaticMarkup(
    <ProofReceiptView
      title="Demo receipt"
      document={document}
      receiptHash={receiptHash}
      verification={verifyProofReceipt(document, receiptHash)}
      timeline={demoProof.timeline}
      origin={{ label: "demo", note: "No transaction was submitted." }}
    />,
  );
}

describe("proof receipt policy outcome", () => {
  it("counts warnings without claiming every check passed", () => {
    const document = structuredClone(demoProof.document);
    const liquidity = document.policyEvaluation.checks.find(
      (check) => check.rule === "min_liquidity_usd_micros",
    )!;
    liquidity.status = "warn";
    liquidity.observed = "unavailable";
    const html = renderReceipt(document);
    expect(html).toContain(
      `${document.policyEvaluation.checks.length - 1} checks passed, 1 warned; no failed checks`,
    );
    expect(html).not.toContain(
      `All ${document.policyEvaluation.checks.length} checks passed`,
    );
  });

  it("reports zero warnings for an all-pass receipt", () => {
    const html = renderReceipt(demoProof.document);
    expect(html).toContain(
      `${demoProof.document.policyEvaluation.checks.length} checks passed, 0 warned; no failed checks`,
    );
  });

  it("keeps rejected outcomes distinct from approved warnings", () => {
    const document = structuredClone(demoProof.document);
    document.policyEvaluation.approved = false;
    document.execution.state = "rejected";
    document.policyEvaluation.checks[0]!.status = "fail";
    const html = renderReceipt(document);
    expect(html).toContain("Nothing was executed.");
    expect(html).not.toContain("no failed checks");
  });
});
