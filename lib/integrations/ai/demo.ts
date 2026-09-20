import { parseProposalForContext, type DecisionContext } from "../../domain";
import { hashCanonical } from "../../proofs/canonical";
import type { DecisionProvider } from "./types";

export class DemoDecisionProvider implements DecisionProvider {
  async propose(context: DecisionContext) {
    const generatedAt = new Date(context.requestedAt);
    const expiresAt = new Date(generatedAt.getTime() + 5 * 60 * 1_000).toISOString();
    const [inputAsset, outputAsset] = context.assets;
    const sourceId = context.marketInputs[0]?.id ?? "deterministic-demo-fixture";

    const candidate =
      inputAsset && outputAsset && context.permittedActions.includes("REBALANCE")
        ? {
            action: "REBALANCE" as const,
            inputMint: inputAsset.mint,
            outputMint: outputAsset.mint,
            inputAmount: {
              rawAmount: `1${"0".repeat(inputAsset.decimals)}`,
              decimals: inputAsset.decimals,
              uiAmount: "1",
            },
            minimumOutputAmount: {
              rawAmount: `1${"0".repeat(outputAsset.decimals)}`,
              decimals: outputAsset.decimals,
              uiAmount: "1",
            },
            maxSlippageBps: 75,
            thesis:
              "The deterministic demo signal proposes a bounded one-unit rebalance for policy evaluation.",
            evidence: [
              {
                sourceId,
                claim:
                  "The labelled demo fixture selects the first eligible asset pair.",
              },
            ],
            confidenceBps: 6500,
            invalidationConditions: [
              "The proposal expires or either asset leaves the allowed universe.",
            ],
            dataTimestamp: context.requestedAt,
            expiresAt,
          }
        : {
            action: "HOLD" as const,
            maxSlippageBps: 0 as const,
            thesis:
              "The bounded context does not contain two eligible assets for a deterministic rebalance.",
            evidence: [
              {
                sourceId,
                claim: "The supplied context cannot construct a two-asset trade.",
              },
            ],
            confidenceBps: 10_000,
            invalidationConditions: ["Two verified eligible assets become available."],
            dataTimestamp: context.requestedAt,
            expiresAt,
          };

    const proposal = parseProposalForContext(candidate, context);
    return {
      proposal,
      metadata: {
        provider: "demo" as const,
        model: "navis-deterministic-v1",
        requestId: `demo_${hashCanonical({ context, proposal }).slice(0, 24)}`,
        generatedAt: context.requestedAt,
      },
    };
  }
}
