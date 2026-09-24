import { describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import type { AgentBundle } from "../lib/db/repositories/types";
import type { RiskConstraint } from "../lib/domain";
import type { DecisionProvider } from "../lib/integrations/ai/types";
import { hashCanonical } from "../lib/proofs/canonical";
import { verifyProofReceipt } from "../lib/proofs/receipt";
import { runDecision } from "../lib/services/run-decision";

type NumericLimit = Extract<RiskConstraint, { value: number }>["type"];

/** Atlas with selected numeric limits replaced and the policy hash recomputed. */
function withLimits(limits: Partial<Record<NumericLimit, number>>): AgentBundle {
  const document = structuredClone(demoAgentBundle.riskPolicy.document);
  const constraints = document.constraints.map((constraint) =>
    "value" in constraint &&
    typeof constraint.value === "number" &&
    constraint.type in limits
      ? { ...constraint, value: limits[constraint.type as NumericLimit]! }
      : constraint,
  ) as typeof document.constraints;
  const riskPolicyDocument = { ...document, constraints };
  return {
    ...demoAgentBundle,
    riskPolicy: {
      ...demoAgentBundle.riskPolicy,
      document: riskPolicyDocument,
      hash: hashCanonical(riskPolicyDocument),
    },
  };
}

// Every policy the creation form accepts must keep the advertised outcomes:
// balanced approves, oversized rejects.
const boundaryPolicies: readonly [string, Partial<Record<NumericLimit, number>>][] = [
  ["tightest", { max_trade_bps: 1, max_position_bps: 1, max_slippage_bps: 1 }],
  [
    "loosest",
    {
      max_trade_bps: 10_000,
      max_position_bps: 10_000,
      min_reserve_bps: 0,
      max_slippage_bps: 2_000,
      max_daily_turnover_bps: 10_000,
    },
  ],
  ["full reserve", { min_reserve_bps: 10_000, max_slippage_bps: 10 }],
];

describe("fresh decision runs", () => {
  it.each(boundaryPolicies)(
    "keeps balanced approved and oversized rejected for the %s policy",
    async (_label, limits) => {
      const bundle = withLimits(limits);
      const balanced = await runDecision({ bundle, scenario: "balanced" });
      const oversized = await runDecision({ bundle, scenario: "oversized" });

      expect(balanced.policyEvaluation.approved).toBe(true);
      expect(
        balanced.policyEvaluation.checks.filter((check) => check.status === "fail"),
      ).toEqual([]);
      expect(oversized.policyEvaluation.approved).toBe(false);
      expect(
        oversized.policyEvaluation.checks.find(
          (check) => check.rule === "max_trade_bps",
        )?.status,
      ).toBe("fail");
    },
  );

  it("never requests more slippage than the policy allows", async () => {
    const run = await runDecision({
      bundle: withLimits({ max_slippage_bps: 5 }),
      scenario: "balanced",
    });
    expect(run.proposal.maxSlippageBps).toBe(5);
  });

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
