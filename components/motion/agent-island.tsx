"use client";

import { WarningCircle } from "@phosphor-icons/react";

export type AgentPhase = "monitoring" | "ready" | "executing" | "error";

type AgentIslandProps = {
  agentName?: string;
  phase: AgentPhase;
  detail: string;
  cluster?: string;
  progress?: number | null;
  errorMessage?: string | null;
};

const phaseLabel: Record<AgentPhase, string> = {
  monitoring: "Monitoring",
  ready: "Ready",
  executing: "Executing",
  error: "Error",
};

/**
 * One morphing status object. Driven only by caller-supplied state.
 * No fake confidence, P&L, or invented progress.
 */
export function AgentIsland({
  agentName = "NAVIS AGENT",
  phase,
  detail,
  cluster,
  progress = null,
  errorMessage = null,
}: AgentIslandProps) {
  const progressLabel =
    phase === "executing" && progress !== null && Number.isFinite(progress)
      ? `${Math.round(progress)}%`
      : null;

  return (
    <div
      className="navis-agent-island"
      data-phase={phase}
      role="status"
      aria-live="polite"
      aria-label={`${agentName}: ${phaseLabel[phase]}. ${errorMessage ?? detail}`}
    >
      <span className="navis-agent-island-core" aria-hidden="true">
        {phase === "error" ? <WarningCircle size={14} weight="fill" /> : <span />}
      </span>
      <span className="navis-agent-island-copy">
        <strong>{agentName}</strong>
        <span>
          {phaseLabel[phase]}
          {cluster ? ` · ${cluster}` : ""}
        </span>
        <small>{errorMessage ?? detail}</small>
      </span>
      {progressLabel ? (
        <span className="navis-agent-island-progress">{progressLabel}</span>
      ) : null}
    </div>
  );
}

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
