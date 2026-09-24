import type { DecisionRunResult } from "./types";

/** Short, human headline for a run's proposal. */
export function headlineFor(run: DecisionRunResult) {
  const proposal = run.proposal;
  if (proposal.action === "HOLD") return "Hold. No asset moves.";
  const assets = new Map(run.receipt.decision.context.assets.map((asset) => [asset.mint, asset]));
  const symbol = (mint: string) => assets.get(mint)?.symbol ?? `${mint.slice(0, 4)}…`;
  const verb =
    proposal.action === "REBALANCE" ? "Rebalance" : proposal.action === "BUY" ? "Buy" : "Sell";
  return `${verb} ${proposal.inputAmount.uiAmount} ${symbol(proposal.inputMint)} into ${symbol(proposal.outputMint)}`;
}

export function policyTally(run: DecisionRunResult) {
  const checks = run.policyEvaluation.checks;
  const failed = checks.filter((check) => check.status === "fail");
  const warned = checks.filter((check) => check.status === "warn");
  return {
    total: checks.length,
    passed: checks.length - failed.length - warned.length,
    warned: warned.length,
    failed: failed.length,
    failedRules: failed.map((check) => check.rule.replaceAll("_", " ")),
  };
}

/** Same wording as the decision record's "why" line. */
export function whyLineFor(run: DecisionRunResult) {
  const tally = policyTally(run);
  if (run.policyEvaluation.approved) {
    return tally.warned > 0
      ? `Policy approved: ${tally.total - tally.warned} of ${tally.total} checks passed and ${tally.warned} warned.`
      : `Policy approved: all ${tally.total} checks passed.`;
  }
  return `Policy rejected: ${tally.failedRules.join(", ")} failed. Nothing was executed.`;
}
