import type { DecisionRunResult } from "./run-decision";

const MAX_RUNS = 50;
const storeGlobal = globalThis as typeof globalThis & {
  navisDecisionRuns?: Map<string, DecisionRunResult>;
};
const runs =
  storeGlobal.navisDecisionRuns ??
  (storeGlobal.navisDecisionRuns = new Map<string, DecisionRunResult>());

export function rememberDecisionRun(run: DecisionRunResult) {
  runs.set(run.decisionId, run);
  while (runs.size > MAX_RUNS) {
    const oldest = runs.keys().next().value;
    if (oldest) runs.delete(oldest);
  }
}

export function getRememberedDecisionRun(decisionId: string) {
  return runs.get(decisionId) ?? null;
}
