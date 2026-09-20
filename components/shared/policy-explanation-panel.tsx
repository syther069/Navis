import { PolicyResult, StatusBadge } from "./domain-primitives";

export type PolicyExplanationCheck = Readonly<{
  rule: string;
  status: "pass" | "warn" | "fail";
  observed: string;
  threshold: string;
  explanation?: string;
}>;

export function summarizePolicyOutcome(
  approved: boolean,
  checks: readonly PolicyExplanationCheck[],
) {
  const failed = checks.filter((check) => check.status === "fail");
  const warned = checks.filter((check) => check.status === "warn");
  if (approved) {
    return warned.length > 0
      ? `Passed: ${checks.length - warned.length} of ${checks.length} checks passed and ${warned.length} warned. Warnings never block a proposal on their own.`
      : `Passed: all ${checks.length} deterministic policy checks stayed within their limits.`;
  }
  return `Failed: ${failed
    .map((check) => check.rule.replaceAll("_", " "))
    .join(
      ", ",
    )} exceeded ${failed.length === 1 ? "its limit" : "their limits"}. A single failed check rejects the proposal and nothing is executed.`;
}

/**
 * "Why this passed or failed": every policy check with its observed value, the
 * threshold it was compared against, and the pass, warn, or fail result.
 */
export function PolicyExplanationPanel({
  approved,
  checks,
  headingId = "policy-explanation-title",
  note,
}: {
  approved: boolean;
  checks: readonly PolicyExplanationCheck[];
  headingId?: string;
  note?: string;
}) {
  return (
    <section
      className="policy-explanation"
      aria-labelledby={headingId}
      data-testid="policy-explanation"
      data-outcome={approved ? "passed" : "failed"}
    >
      <div className="policy-explanation-heading">
        <div>
          <span className="route-eyebrow">Policy verdict</span>
          <h2 id={headingId}>{`Why this ${approved ? "passed" : "failed"}`}</h2>
          <p>{summarizePolicyOutcome(approved, checks)}</p>
        </div>
        <StatusBadge tone={approved ? "pass" : "block"}>
          {approved ? "Passed" : "Failed"}
        </StatusBadge>
      </div>
      <div className="decision-run-checks">
        {checks.map((check) => (
          <PolicyResult
            key={check.rule}
            label={check.rule.replaceAll("_", " ")}
            observed={check.observed}
            threshold={check.threshold}
            detail={check.explanation}
            status={check.status === "fail" ? "block" : check.status}
          />
        ))}
      </div>
      {note ? <small className="policy-explanation-note">{note}</small> : null}
    </section>
  );
}
