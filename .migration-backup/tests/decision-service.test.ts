import { describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import type { DecisionContext } from "../lib/domain";
import { DemoDecisionProvider } from "../lib/integrations/ai/demo";
import { prepareDecision } from "../lib/services/decisions";

function context(): DecisionContext {
  const timestamp = "2026-09-17T00:00:00.000Z";
  return {
    agentId: demoAgentBundle.agent.id,
    mode: "demo",
    cluster: "devnet",
    requestedAt: timestamp,
    strategy: {
      id: demoAgentBundle.strategy.id,
      version: 1,
      hash: demoAgentBundle.strategy.hash,
    },
    riskPolicy: {
      id: demoAgentBundle.riskPolicy.id,
      version: 1,
      hash: demoAgentBundle.riskPolicy.hash,
    },
    portfolio: {
      id: "demo_snapshot_atlas_100",
      contentHash: "b".repeat(64),
      document: {
        agentId: demoAgentBundle.agent.id,
        owner: "11111111111111111111111111111111",
        cluster: "devnet",
        slot: "100",
        source: "solana_rpc",
        capturedAt: timestamp,
        balances: [
          {
            kind: "spl-token",
            mint: "demo_mint_equity_a",
            rawAmount: "1000000",
            decimals: 6,
            slot: "100",
          },
        ],
        valuations: [],
      },
    },
    assets: [...demoAgentBundle.assets],
    marketInputs: [],
    permittedActions: ["HOLD", "REBALANCE"],
  };
}

describe("decision orchestration", () => {
  it("binds the exact context and proposal into a stable hash", async () => {
    const provider = new DemoDecisionProvider();
    const first = await prepareDecision(context(), provider);
    const second = await prepareDecision(context(), provider);

    expect(first).toEqual(second);
    expect(first.decisionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the hash when an input-source reference changes", async () => {
    const provider = new DemoDecisionProvider();
    const firstContext = context();
    const secondContext = context();
    secondContext.portfolio.contentHash = "c".repeat(64);

    const first = await prepareDecision(firstContext, provider);
    const second = await prepareDecision(secondContext, provider);
    expect(first.decisionHash).not.toBe(second.decisionHash);
  });
});
