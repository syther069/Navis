import type { Metadata } from "next";

import { AgentOverview } from "@/components/agent-overview";
import { NavisIntro } from "@/components/agent/navis-intro";
import { RunDecisionPanel } from "@/components/decisions/run-decision-panel";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { demoProof } from "@/fixtures/demo-proof";
import { getPublicCapabilities } from "@/lib/env";
import { formatBaseUnits } from "@/lib/presentation";

export const metadata: Metadata = { title: "Atlas" };

export default function AtlasPage() {
  const capabilities = getPublicCapabilities();
  const { portfolio, policyEvaluation } = demoProof.document;
  const valuations = new Map(
    portfolio.document.valuations.map((valuation) => [valuation.mint, valuation]),
  );
  const assets = new Map(demoAgentBundle.assets.map((asset) => [asset.mint, asset]));
  const positions = portfolio.document.balances.map((balance) => {
    const valuation = balance.mint ? valuations.get(balance.mint) : undefined;
    const asset = balance.mint ? assets.get(balance.mint) : undefined;
    return {
      key: balance.mint ?? "native-sol",
      symbol: asset?.symbol ?? "SOL",
      amount: formatBaseUnits(balance.rawAmount, balance.decimals),
      valuation: valuation?.status === "priced" ? valuation.valueUsdMicros : null,
      reason:
        valuation?.status === "unpriced"
          ? valuation.reason
          : balance.kind === "native"
            ? "Reserve is not assigned a demo USD valuation."
            : null,
    };
  });
  const pricedSubtotalMicros = portfolio.document.valuations.reduce(
    (total, valuation) =>
      valuation.status === "priced" ? total + BigInt(valuation.valueUsdMicros) : total,
    BigInt(0),
  );
  const policyChecks = [
    "max_trade_bps",
    "max_position_bps",
    "min_reserve_bps",
    "max_slippage_bps",
  ].flatMap((rule) => {
    const check = policyEvaluation.checks.find((candidate) => candidate.rule === rule);
    return check
      ? [
          {
            label: rule.replaceAll("_", " "),
            observed: `${Number(check.observed) / 100}%`,
            threshold: `${Number(check.threshold) / 100}%`,
            detail: check.explanation,
            status: check.status === "fail" ? ("block" as const) : check.status,
          },
        ]
      : [];
  });

  return (
    <>
      <NavisIntro
        solanaRpcConfigured={capabilities.solanaRpcConfigured}
        cluster={capabilities.cluster}
      />
      <RunDecisionPanel />
      <div className="prepared-example-label">
        <span className="route-eyebrow">Prepared example</span>
      </div>
      <AgentOverview
        treasury={{
          capturedAt: portfolio.document.capturedAt,
          pricedSubtotalMicros: pricedSubtotalMicros.toString(),
          positions,
        }}
        policyChecks={policyChecks}
      />
    </>
  );
}
