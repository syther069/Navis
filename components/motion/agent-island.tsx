/**
 * Navis original agent status island. Same job as Skiper 2 Dynamic Island,
 * which is Pro and was not provided. Not that component.
 */
export function AgentIsland({
  mode,
  cluster,
  liveExecution,
}: {
  mode: string;
  cluster: string;
  liveExecution: boolean;
}) {
  const state = mode === "demo" ? "simulated" : liveExecution ? "gated-live" : "held";
  const label =
    mode === "demo"
      ? "Atlas · simulated"
      : liveExecution
        ? `Atlas · ${mode} signing`
        : `Atlas · ${mode} held`;

  return (
    <p className="navis-agent-island" data-state={state}>
      <span className="navis-agent-island-dot" aria-hidden="true" />
      <span>{label}</span>
      <span className="navis-agent-island-cluster">{cluster}</span>
    </p>
  );
}
