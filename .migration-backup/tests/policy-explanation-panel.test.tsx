import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PolicyExplanationPanel,
  summarizePolicyOutcome,
} from "../components/shared/policy-explanation-panel";
import { demoProof } from "../fixtures/demo-proof";

describe("policy explanation panel", () => {
  it("lists every check with observed value, threshold and status for a passed evaluation", () => {
    const { approved, checks } = demoProof.document.policyEvaluation;
    const html = renderToStaticMarkup(
      <PolicyExplanationPanel approved={approved} checks={checks} />,
    );
    expect(html).toContain("Why this passed");
    expect(html).toContain('data-outcome="passed"');
    for (const check of checks) {
      expect(html).toContain(check.rule.replaceAll("_", " "));
      expect(html).toContain(check.observed);
      expect(html).toContain(`Limit ${check.threshold}`);
    }
    expect(html).toContain(`all ${checks.length} deterministic policy checks`);
  });

  it("names the failed rules for a rejected evaluation", () => {
    const html = renderToStaticMarkup(
      <PolicyExplanationPanel
        approved={false}
        checks={[
          {
            rule: "max_trade_bps",
            status: "fail",
            observed: "5000",
            threshold: "1000",
            explanation: "Trade too large.",
          },
          {
            rule: "max_slippage_bps",
            status: "pass",
            observed: "50",
            threshold: "100",
            explanation: "Within limit.",
          },
        ]}
      />,
    );
    expect(html).toContain("Why this failed");
    expect(html).toContain('data-outcome="failed"');
    expect(html).toContain("max trade bps exceeded its limit");
    expect(html).toContain('data-status="block"');
    expect(html).toContain('data-status="pass"');
  });

  it("reports warnings without treating them as blocks", () => {
    expect(
      summarizePolicyOutcome(true, [
        { rule: "a", status: "pass", observed: "1", threshold: "2" },
        { rule: "b", status: "warn", observed: "1", threshold: "2" },
      ]),
    ).toContain("1 warned");
  });
});
