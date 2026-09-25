export type AgentPhase = "monitoring" | "ready" | "executing" | "error";

export function phaseFromCapabilities(input: {
  mode: string;
  liveExecution: boolean;
}): { phase: AgentPhase; detail: string } {
  if (input.mode === "demo") {
    return { phase: "monitoring", detail: "Simulation only. No live execution." };
  }
  if (input.liveExecution) {
    return { phase: "ready", detail: "Wallet signing required for value movement." };
  }
  return { phase: "monitoring", detail: `${input.mode} execution is configured off.` };
}
