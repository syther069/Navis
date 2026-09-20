import { z } from "zod";

import {
  assetIdentifierSchema,
  assetVerificationStateSchema,
  executionModeSchema,
  riskPolicyDocumentSchema,
  solanaClusterSchema,
  timestampSchema,
  tradeProposalSchema,
  type RiskConstraint,
} from "../domain";
import { parseUnsignedInteger, ratioBps, secondsBetween } from "../math/fixed";

const factsSchema = z.object({
  now: timestampSchema,
  mode: executionModeSchema,
  cluster: solanaClusterSchema,
  portfolioValueUsdMicros: z.string().regex(/^\d+$/),
  tradeValueUsdMicros: z.string().regex(/^\d+$/),
  postReserveUsdMicros: z.string().regex(/^\d+$/),
  postPositions: z.array(
    z.object({
      mint: assetIdentifierSchema,
      valueUsdMicros: z.string().regex(/^\d+$/),
    }),
  ),
  dailyTurnoverUsdMicros: z.string().regex(/^\d+$/),
  lastExecutedAt: timestampSchema.optional(),
  dataObservedAt: timestampSchema,
  quoteExpiresAt: timestampSchema.optional(),
  availableLiquidityUsdMicros: z.string().regex(/^\d+$/).optional(),
  assetVerification: z.record(assetIdentifierSchema, assetVerificationStateSchema),
});

export type PolicyFacts = z.infer<typeof factsSchema>;
export type PolicyRuleResult = Readonly<{
  rule: string;
  status: "pass" | "fail" | "warn";
  observed: string;
  threshold: string;
  explanation: string;
}>;
export type PolicyEvaluation = Readonly<{
  approved: boolean;
  checks: readonly PolicyRuleResult[];
}>;

function constraint<T extends RiskConstraint["type"]>(
  policy: z.infer<typeof riskPolicyDocumentSchema>,
  type: T,
) {
  return policy.constraints.find(
    (item): item is Extract<RiskConstraint, { type: T }> => item.type === type,
  )!;
}

function check(
  rule: string,
  passes: boolean,
  observed: string,
  threshold: string,
  explanation: string,
): PolicyRuleResult {
  return { rule, status: passes ? "pass" : "fail", observed, threshold, explanation };
}

export function evaluatePolicy(
  proposalCandidate: unknown,
  policyCandidate: unknown,
  factsCandidate: unknown,
): PolicyEvaluation {
  const proposal = tradeProposalSchema.parse(proposalCandidate);
  const policy = riskPolicyDocumentSchema.parse(policyCandidate);
  const facts = factsSchema.parse(factsCandidate);
  const total = parseUnsignedInteger(facts.portfolioValueUsdMicros, "portfolio value");
  const trade = parseUnsignedInteger(facts.tradeValueUsdMicros, "trade value");
  const reserve = parseUnsignedInteger(facts.postReserveUsdMicros, "reserve value");
  const turnover = parseUnsignedInteger(facts.dailyTurnoverUsdMicros, "daily turnover");
  if (total === BigInt(0))
    throw new Error("Policy evaluation requires a positive portfolio value");

  const allowedMints = constraint(policy, "allowed_mints").mints;
  const proposalMints =
    proposal.action === "HOLD" ? [] : [proposal.inputMint, proposal.outputMint];
  const checks: PolicyRuleResult[] = [
    check(
      "allowed_mints",
      proposalMints.every((mint) => allowedMints.includes(mint)),
      proposalMints.join(", ") || "none (HOLD)",
      allowedMints.join(", "),
      "Every value-moving mint must be present in the immutable allowlist.",
    ),
    check(
      "allowed_modes",
      constraint(policy, "allowed_modes").modes.includes(facts.mode),
      `${facts.mode}/${facts.cluster}`,
      constraint(policy, "allowed_modes").modes.join(", "),
      "The current execution mode must be explicitly permitted.",
    ),
  ];

  const maxTradeBps = BigInt(constraint(policy, "max_trade_bps").value);
  const observedTradeBps =
    proposal.action === "HOLD" ? BigInt(0) : ratioBps(trade, total, "ceil");
  checks.push(
    check(
      "max_trade_bps",
      observedTradeBps <= maxTradeBps,
      observedTradeBps.toString(),
      maxTradeBps.toString(),
      "Trade value must not exceed the configured share of portfolio value.",
    ),
  );

  const maxPositionBps = BigInt(constraint(policy, "max_position_bps").value);
  const largestPositionBps = facts.postPositions.reduce((largest, position) => {
    const weight = ratioBps(
      parseUnsignedInteger(position.valueUsdMicros, "position value"),
      total,
      "ceil",
    );
    return weight > largest ? weight : largest;
  }, BigInt(0));
  checks.push(
    check(
      "max_position_bps",
      largestPositionBps <= maxPositionBps,
      largestPositionBps.toString(),
      maxPositionBps.toString(),
      "No post-trade position may exceed the concentration limit.",
    ),
  );

  const reserveBps = ratioBps(reserve, total, "floor");
  const minReserveBps = BigInt(constraint(policy, "min_reserve_bps").value);
  checks.push(
    check(
      "min_reserve_bps",
      reserveBps >= minReserveBps,
      reserveBps.toString(),
      minReserveBps.toString(),
      "Post-trade reserve must remain at or above the policy floor.",
    ),
  );

  const maxSlippage = constraint(policy, "max_slippage_bps").value;
  checks.push(
    check(
      "max_slippage_bps",
      proposal.maxSlippageBps <= maxSlippage,
      String(proposal.maxSlippageBps),
      String(maxSlippage),
      "Requested slippage must remain within policy.",
    ),
  );

  const turnoverBps = ratioBps(turnover, total, "ceil");
  const maxTurnoverBps = BigInt(constraint(policy, "max_daily_turnover_bps").value);
  checks.push(
    check(
      "max_daily_turnover_bps",
      turnoverBps <= maxTurnoverBps,
      turnoverBps.toString(),
      maxTurnoverBps.toString(),
      "Rolling daily turnover must remain within the configured budget.",
    ),
  );

  const cooldown = constraint(policy, "cooldown_seconds").value;
  const elapsed = facts.lastExecutedAt
    ? secondsBetween(facts.lastExecutedAt, facts.now)
    : Number.POSITIVE_INFINITY;
  checks.push(
    check(
      "cooldown_seconds",
      elapsed >= cooldown,
      Number.isFinite(elapsed) ? String(elapsed) : "no prior execution",
      String(cooldown),
      "A new trade cannot execute during the post-execution cooldown.",
    ),
  );

  const dataAge = secondsBetween(facts.dataObservedAt, facts.now);
  const maxDataAge = constraint(policy, "max_data_age_seconds").value;
  checks.push(
    check(
      "max_data_age_seconds",
      dataAge >= 0 && dataAge <= maxDataAge,
      String(dataAge),
      String(maxDataAge),
      "Decision inputs must be fresh and cannot be future-dated.",
    ),
  );
  if (facts.quoteExpiresAt) {
    checks.push(
      check(
        "quote_expiry",
        Date.parse(facts.quoteExpiresAt) > Date.parse(facts.now),
        facts.quoteExpiresAt,
        `after ${facts.now}`,
        "The execution quote must remain valid at evaluation time.",
      ),
    );
  }

  const minimumLiquidity = parseUnsignedInteger(
    constraint(policy, "min_liquidity_usd_micros").value,
    "minimum liquidity",
  );
  if (facts.availableLiquidityUsdMicros === undefined) {
    checks.push({
      rule: "min_liquidity_usd_micros",
      status: facts.mode === "demo" ? "warn" : "fail",
      observed: "unavailable",
      threshold: minimumLiquidity.toString(),
      explanation:
        facts.mode === "demo"
          ? "No reliable liquidity measurement was supplied; demo evaluation requires an execution-time recheck."
          : "No reliable liquidity measurement was supplied; live-mode evaluation fails closed.",
    });
  } else {
    const liquidity = parseUnsignedInteger(facts.availableLiquidityUsdMicros);
    checks.push(
      check(
        "min_liquidity_usd_micros",
        liquidity >= minimumLiquidity,
        liquidity.toString(),
        minimumLiquidity.toString(),
        "Reliable available liquidity must meet the configured floor.",
      ),
    );
  }

  const unverified = proposalMints.filter(
    (mint) =>
      !["provider_verified", "onchain_verified"].includes(
        facts.assetVerification[mint],
      ),
  );
  checks.push(
    check(
      "verified_assets",
      unverified.length === 0 || facts.mode === "demo",
      unverified.join(", ") || "all verified",
      facts.mode === "demo" ? "demo identifiers allowed" : "verified assets only",
      "Unknown or unverified live assets are blocked by default.",
    ),
  );

  return Object.freeze({
    approved: checks.every((item) => item.status !== "fail"),
    checks: Object.freeze(checks),
  });
}
