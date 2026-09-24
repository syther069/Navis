/**
 * Client-safe scenario catalogue shared by the run panel and the run service.
 */
export type DecisionScenario = "balanced" | "oversized";
export const decisionScenarios: readonly {
  value: DecisionScenario;
  label: string;
  description: string;
}[] = [
  {
    value: "balanced",
    label: "Balanced",
    description:
      "Sizes the trade at half the policy trade limit, keeps concentration at half the position limit and holds reserve above the floor. Policy should approve.",
  },
  {
    value: "oversized",
    label: "Oversized",
    description:
      "Doubles the trade and position limits and drains reserve below the floor. Policy should reject, and the receipt records why.",
  },
];
