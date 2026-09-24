export type IntegrationStatus =
  | "LIVE"
  | "CONNECTED"
  | "READ-ONLY"
  | "DEVNET"
  | "SIMULATION"
  | "PREPARATION ONLY"
  | "BLOCKED"
  | "PLANNED";

const tone: Record<IntegrationStatus, string> = {
  LIVE: "success",
  CONNECTED: "success",
  "READ-ONLY": "info",
  DEVNET: "simulation",
  SIMULATION: "simulation",
  "PREPARATION ONLY": "warning",
  BLOCKED: "danger",
  PLANNED: "muted",
};

export function StatusLabel({ status }: { status: IntegrationStatus }) {
  return (
    <span className="public-status" data-tone={tone[status]}>
      {status}
    </span>
  );
}
