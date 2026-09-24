import type { DecisionContext, TradeProposal } from "../../domain";

export type DecisionProviderMetadata = Readonly<{
  provider: "demo" | "openai";
  model: string;
  requestId: string;
  generatedAt: string;
}>;

export type DecisionProviderResult = Readonly<{
  proposal: TradeProposal;
  metadata: DecisionProviderMetadata;
}>;

export interface DecisionProvider {
  propose(context: DecisionContext): Promise<DecisionProviderResult>;
}
