import { parseProposalForContext, type DecisionContext } from "../../domain";
import { hashCanonical } from "../../proofs/canonical";
import type { DecisionProvider } from "./types";

export const DEMO_DEFAULT_SLIPPAGE_BPS = 75;

export type DemoDecisionProviderOptions = Readonly<{
  /**
   * Policy ceiling for requested slippage. The deterministic proposal never
   * asks for more than the agent's own max_slippage_bps, so a created agent
   * with a tight slippage policy still gets an approvable balanced run.
   */
  maxSlippageBps?: number;
}>;

export class DemoDecisionProvider implements DecisionProvider {
  private readonly slippageBps: number;

  constructor(options: DemoDecisionProviderOptions = {}) {
    const ceiling = options.maxSlippageBps ?? DEMO_DEFAULT_SLIPPAGE_BPS;
    this.slippageBps = Math.max(
      1,
      Math.min(DEMO_DEFAULT_SLIPPAGE_BPS, Math.trunc(ceiling)),
    );
  }

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
            maxSlippageBps: this.slippageBps,
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
