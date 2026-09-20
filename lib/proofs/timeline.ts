export type ProofTimelineEvent = Readonly<{
  id: string;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  mode: "demo" | "devnet" | "mainnet";
  state: "complete" | "warning" | "pending";
  evidence?: string;
}>;

export function projectProofTimeline(input: {
  mode: ProofTimelineEvent["mode"];
  snapshot: { capturedAt: string; hash: string; source: string };
  decision: { createdAt: string; hash: string; action: string };
  evaluation: { evaluatedAt: string; approved: boolean; inputHash: string };
  execution: {
    timestamp: string;
    state: "simulated" | "confirmed" | "failed" | "rejected";
    signature?: string | null;
  };
}): readonly ProofTimelineEvent[] {
  return Object.freeze([
    {
      id: "inputs",
      title: "Snapshot and immutable mandate captured",
      description: `Portfolio evidence is bound to ${input.snapshot.hash.slice(0, 12)}…`,
      source: input.snapshot.source,
      timestamp: input.snapshot.capturedAt,
      mode: input.mode,
      state: "complete",
      evidence: input.snapshot.hash,
    },
    {
      id: "proposal",
      title: `${input.decision.action} proposal recorded`,
      description: `Decision hash ${input.decision.hash.slice(0, 12)}… preserves the exact proposal and context.`,
      source: input.mode === "demo" ? "navis-deterministic-v1" : "decision_provider",
      timestamp: input.decision.createdAt,
      mode: input.mode,
      state: "complete",
      evidence: input.decision.hash,
    },
    {
      id: "policy",
      title: input.evaluation.approved
        ? "Deterministic policy checks passed"
        : "Policy blocked execution",
      description: `Evaluation input ${input.evaluation.inputHash.slice(0, 12)}… is retained for replay.`,
      source: "navis_policy_runner",
      timestamp: input.evaluation.evaluatedAt,
      mode: input.mode,
      state: input.evaluation.approved ? "complete" : "warning",
      evidence: input.evaluation.inputHash,
    },
    {
      id: "execution",
      title:
        input.execution.state === "simulated"
          ? "Simulation receipt finalized"
          : `Execution ${input.execution.state}`,
      description: input.execution.signature
        ? `RPC evidence references signature ${input.execution.signature.slice(0, 12)}…`
        : "No transaction signature exists for this explicitly simulated result.",
      source: input.execution.signature ? "solana_rpc" : "demo_simulator",
      timestamp: input.execution.timestamp,
      mode: input.mode,
      state:
        input.execution.state === "confirmed" || input.execution.state === "simulated"
          ? "complete"
          : "warning",
      evidence: input.execution.signature ?? undefined,
    },
  ]);
}
