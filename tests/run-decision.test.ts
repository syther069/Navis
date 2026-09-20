import { describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import type { DecisionProvider } from "../lib/integrations/ai/types";
import { verifyProofReceipt } from "../lib/proofs/receipt";
import { runDecision } from "../lib/services/run-decision";

describe("fresh decision runs", () => {
  it("approves balanced inputs and rejects oversized inputs", async () => {
    const balanced = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
    });
    const oversized = await runDecision({
      bundle: demoAgentBundle,
      scenario: "oversized",
    });

    expect(balanced.policyEvaluation.approved).toBe(true);
    expect(oversized.policyEvaluation.approved).toBe(false);
    expect(
      oversized.policyEvaluation.checks.find((check) => check.rule === "max_trade_bps")
        ?.status,
    ).toBe("fail");
  });

  it("creates fresh IDs and valid, distinct receipt hashes", async () => {
    const first = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
    });
    const second = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
    });

    expect(first.decisionId).not.toBe(second.decisionId);
    expect(first.generatedAt).not.toBe(second.generatedAt);
    expect(first.receiptHash).not.toBe(second.receiptHash);
    expect(verifyProofReceipt(first.receipt, first.receiptHash).valid).toBe(true);
  });

  it("records a provider failure before using the deterministic provider", async () => {
    const failingProvider: DecisionProvider = {
      propose: async () => {
        throw new Error("provider unavailable");
      },
    };
    const run = await runDecision({
      bundle: demoAgentBundle,
      scenario: "balanced",
      provider: failingProvider,
    });

    expect(run.modelMetadata.provider).toBe("demo");
    expect(run.modelMetadata.fallback?.used).toBe(true);
    expect(run.modelMetadata.fallback?.reason).toContain("provider unavailable");
  });
});
