import { describe, expect, it, vi } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import {
  parseProposalForContext,
  type DecisionContext,
  type TradeProposal,
} from "../lib/domain";
import { DemoDecisionProvider } from "../lib/integrations/ai/demo";
import { OpenAiDecisionProvider } from "../lib/integrations/ai/openai";

const requestedAt = "2026-09-17T00:00:00.000Z";

function context(): DecisionContext {
  return {
    agentId: demoAgentBundle.agent.id,
    mode: "demo",
    cluster: "devnet",
    requestedAt,
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
      contentHash: "a".repeat(64),
      document: {
        agentId: demoAgentBundle.agent.id,
        owner: "11111111111111111111111111111111",
        cluster: "devnet",
        slot: "100",
        source: "solana_rpc",
        capturedAt: requestedAt,
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
    permittedActions: ["BUY", "SELL", "HOLD", "REBALANCE"],
  };
}

function proposal(): TradeProposal {
  return {
    action: "BUY",
    inputMint: "demo_mint_equity_a",
    outputMint: "demo_mint_equity_b",
    inputAmount: { rawAmount: "100000", decimals: 6, uiAmount: "0.1" },
    minimumOutputAmount: {
      rawAmount: "99000",
      decimals: 6,
      uiAmount: "0.099",
    },
    maxSlippageBps: 100,
    thesis: "The bounded fixture signal favors a small rotation into demo equity B.",
    evidence: [{ sourceId: "fixture-1", claim: "Relative strength is higher." }],
    confidenceBps: 7000,
    invalidationConditions: ["Relative strength reverses."],
    dataTimestamp: requestedAt,
    expiresAt: "2026-09-17T00:05:00.000Z",
  };
}

describe("decision contract", () => {
  it("accepts a fully bounded structured proposal", () => {
    expect(parseProposalForContext(proposal(), context())).toEqual(proposal());
  });

  it("rejects mints outside the supplied context", () => {
    const candidate = proposal();
    if (candidate.action === "HOLD") throw new Error("Expected a trade proposal");
    candidate.outputMint = "demo_mint_unknown";
    expect(() => parseProposalForContext(candidate, context())).toThrow(
      "outside the bounded asset context",
    );
  });

  it("rejects mismatched token decimals", () => {
    const candidate = proposal();
    if (candidate.action === "HOLD") throw new Error("Expected a trade proposal");
    candidate.inputAmount.decimals = 9;
    expect(() => parseProposalForContext(candidate, context())).toThrow(
      "decimals do not match",
    );
  });

  it("rejects raw prose and unknown fields", () => {
    expect(() => parseProposalForContext("buy the dip", context())).toThrow();
    expect(() =>
      parseProposalForContext({ ...proposal(), executeNow: true }, context()),
    ).toThrow();
  });

  it("rejects overlong proposal validity", () => {
    const candidate = proposal();
    candidate.expiresAt = "2026-09-17T00:16:00.000Z";
    expect(() => parseProposalForContext(candidate, context())).toThrow(
      "cannot exceed 15 minutes",
    );
  });
});

describe("decision providers", () => {
  it("produces a stable, visibly demo proposal without external calls", async () => {
    const provider = new DemoDecisionProvider();
    const first = await provider.propose(context());
    const second = await provider.propose(context());

    expect(first).toEqual(second);
    expect(first.metadata).toMatchObject({
      provider: "demo",
      model: "navis-deterministic-v1",
    });
    expect(first.metadata.requestId).toMatch(/^demo_[a-f0-9]{24}$/);
  });

  it("parses a structured OpenAI response through the same domain boundary", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_test",
          model: "configured-model",
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(proposal()) }],
            },
          ],
        }),
      ),
    );
    const provider = new OpenAiDecisionProvider({
      apiKey: "secret-test-key",
      model: "configured-model",
      fetcher,
    });

    await expect(provider.propose(context())).resolves.toMatchObject({
      proposal: proposal(),
      metadata: { provider: "openai", requestId: "resp_test" },
    });
    const request = fetcher.mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body));
    expect(body.store).toBe(false);
    expect(body.tools).toEqual([]);
    expect(body.text.format.type).toBe("json_schema");
  });

  it("rejects raw prose from a configured provider", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_test",
          model: "configured-model",
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "BUY immediately" }],
            },
          ],
        }),
      ),
    );
    const provider = new OpenAiDecisionProvider({
      apiKey: "secret-test-key",
      model: "configured-model",
      fetcher,
    });

    await expect(provider.propose(context())).rejects.toThrow("not valid JSON");
  });
});
