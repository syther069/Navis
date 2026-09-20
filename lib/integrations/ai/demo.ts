import { parseProposalForContext, type DecisionContext } from "../../domain";
import {
  formatUiAmount,
  rawAmountForUsd,
  valueUsdMicros,
} from "../prestocks/allocation";
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
  /**
   * Intended trade size in USD micros. When the context carries a research
   * price for both assets and a priced balance of the input asset, the
   * proposal sells exactly the quantity worth this much (capped at the
   * holding) and asks for the matching output after slippage. Without prices
   * the provider keeps its one-unit rebalance.
   */
  tradeValueUsdMicros?: string;
}>;

type SizedTrade = Readonly<{
  inputRaw: bigint;
  outputRaw: bigint;
  valueUsdMicros: bigint;
}>;

function sizedTrade(
  context: DecisionContext,
  inputMint: string,
  outputMint: string,
  inputDecimals: number,
  outputDecimals: number,
  tradeValueUsdMicros: string,
  slippageBps: number,
): SizedTrade | null {
  const price = (mint: string) =>
    context.marketInputs.find((input) => input.mint === mint && input.priceUsdMicros)
      ?.priceUsdMicros;
  const inputPrice = price(inputMint);
  const outputPrice = price(outputMint);
  const held = context.portfolio.document.balances.find(
    (balance) => balance.kind === "spl-token" && balance.mint === inputMint,
  );
  if (!inputPrice || !outputPrice || !held) return null;
  const heldRaw = BigInt(held.rawAmount);
  const wanted = rawAmountForUsd(
    BigInt(tradeValueUsdMicros),
    inputDecimals,
    BigInt(inputPrice),
  );
  const inputRaw = wanted < heldRaw ? wanted : heldRaw;
  if (inputRaw <= BigInt(0)) return null;
  const value = valueUsdMicros(inputRaw, inputDecimals, BigInt(inputPrice));
  const afterSlippage = (value * BigInt(10_000 - slippageBps)) / BigInt(10_000);
  const outputRaw = rawAmountForUsd(afterSlippage, outputDecimals, BigInt(outputPrice));
  return {
    inputRaw,
    outputRaw: outputRaw > BigInt(0) ? outputRaw : BigInt(1),
    valueUsdMicros: value,
  };
}

export class DemoDecisionProvider implements DecisionProvider {
  private readonly slippageBps: number;
  private readonly tradeValueUsdMicros: string | undefined;

  constructor(options: DemoDecisionProviderOptions = {}) {
    const ceiling = options.maxSlippageBps ?? DEMO_DEFAULT_SLIPPAGE_BPS;
    this.slippageBps = Math.max(
      1,
      Math.min(DEMO_DEFAULT_SLIPPAGE_BPS, Math.trunc(ceiling)),
    );
    this.tradeValueUsdMicros = options.tradeValueUsdMicros;
  }

  async propose(context: DecisionContext) {
    const generatedAt = new Date(context.requestedAt);
    const expiresAt = new Date(generatedAt.getTime() + 5 * 60 * 1_000).toISOString();
    const [inputAsset, outputAsset] = context.assets;
    const sourceId = context.marketInputs[0]?.id ?? "deterministic-demo-fixture";

    const sized =
      inputAsset && outputAsset && this.tradeValueUsdMicros
        ? sizedTrade(
            context,
            inputAsset.mint,
            outputAsset.mint,
            inputAsset.decimals,
            outputAsset.decimals,
            this.tradeValueUsdMicros,
            this.slippageBps,
          )
        : null;

    const candidate =
      inputAsset && outputAsset && context.permittedActions.includes("REBALANCE")
        ? {
            action: "REBALANCE" as const,
            inputMint: inputAsset.mint,
            outputMint: outputAsset.mint,
            inputAmount: sized
              ? {
                  rawAmount: sized.inputRaw.toString(),
                  decimals: inputAsset.decimals,
                  uiAmount: formatUiAmount(sized.inputRaw, inputAsset.decimals),
                }
              : {
                  rawAmount: `1${"0".repeat(inputAsset.decimals)}`,
                  decimals: inputAsset.decimals,
                  uiAmount: "1",
                },
            minimumOutputAmount: sized
              ? {
                  rawAmount: sized.outputRaw.toString(),
                  decimals: outputAsset.decimals,
                  uiAmount: formatUiAmount(sized.outputRaw, outputAsset.decimals),
                }
              : {
                  rawAmount: `1${"0".repeat(outputAsset.decimals)}`,
                  decimals: outputAsset.decimals,
                  uiAmount: "1",
                },
            maxSlippageBps: this.slippageBps,
            thesis: sized
              ? `The deterministic demo signal rotates ${(Number(sized.valueUsdMicros) / 1_000_000).toFixed(2)} USD of ${inputAsset.symbol} (priced from the research catalogue) into ${outputAsset.symbol}, sized from the fictional research portfolio for policy evaluation.`
              : "The deterministic demo signal proposes a bounded one-unit rebalance for policy evaluation.",
            evidence: [
              sized
                ? {
                    sourceId,
                    claim:
                      "Research token prices from the catalogue value the input amount and size the minimum output after slippage.",
                  }
                : {
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
