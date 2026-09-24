import type { PublicCapabilities } from "./types";

/**
 * Availability vocabulary. There is deliberately no "live", "connected" or
 * "healthy" value: public capabilities report configuration and mode flags,
 * never a verified connection.
 */
export type Availability =
  | "enabled"
  | "configured"
  | "devnet"
  | "simulation"
  | "preparation"
  | "blocked"
  | "unavailable"
  | "planned";

export type IntegrationRow = Readonly<{
  key: string;
  name: string;
  value: Availability;
  label: string;
  detail: string;
}>;

function executionRow(capabilities: PublicCapabilities): IntegrationRow {
  if (capabilities.mode === "mainnet" && capabilities.mainnetExecutionAvailable) {
    return {
      key: "execution",
      name: "Execution",
      value: "enabled",
      label: "Enabled by flags · mainnet",
      detail: "Mode flags allow wallet-signed mainnet transactions. Each one still needs your signature.",
    };
  }
  if (capabilities.mode === "devnet" && capabilities.devnetExecutionAvailable) {
    return {
      key: "execution",
      name: "Execution",
      value: "devnet",
      label: "Enabled by flags · devnet",
      detail: "Mode flags allow wallet-signed devnet transactions. Each one still needs your signature.",
    };
  }
  if (capabilities.mode === "demo") {
    return {
      key: "execution",
      name: "Execution",
      value: "simulation",
      label: "Simulation only",
      detail: "Demo mode records simulated attempts. Nothing is signed or sent.",
    };
  }
  return {
    key: "execution",
    name: "Execution",
    value: "blocked",
    label: "Execution off",
    detail: `${capabilities.mode} mode is set without its execution flags, so runs stay simulated.`,
  };
}

const unverified = "Configured · unverified";

/**
 * Integration truth derived only from the server's public capabilities.
 * A configured service is reported as configured, never as connected.
 */
export function integrationRows(capabilities: PublicCapabilities): IntegrationRow[] {
  return [
    executionRow(capabilities),
    {
      key: "solana",
      name: "Solana RPC",
      value: capabilities.solanaRpcConfigured ? "configured" : "unavailable",
      label: capabilities.solanaRpcConfigured ? unverified : "Not configured",
      detail: capabilities.solanaRpcConfigured
        ? `An RPC endpoint is set for ${capabilities.cluster}. Reachability is not checked here.`
        : "No RPC endpoint is configured for this instance.",
    },
    {
      key: "prestocks",
      name: "PreStocks",
      value: capabilities.prestocksConfigured ? "configured" : "unavailable",
      label: capabilities.prestocksConfigured ? unverified : "Not configured",
      detail: "Research catalogue for tokenized equities. Facts, not execution quotes.",
    },
    {
      key: "meteora",
      name: "Meteora DBC",
      value: capabilities.meteoraConfigured ? "preparation" : "unavailable",
      label: capabilities.meteoraConfigured ? "Configured · broadcast off" : "Not configured",
      detail: "Preparation and simulation only. Broadcasting is intentionally disabled.",
    },
    {
      key: "clawpump",
      name: "ClawPump",
      value: capabilities.clawpumpConfigured ? "configured" : "unavailable",
      label: capabilities.clawpumpConfigured ? unverified : "Not configured",
      detail: "Agent identity verification and launch preflight.",
    },
    {
      key: "ai",
      name: "Proposal service",
      value: capabilities.aiConfigured ? "configured" : "unavailable",
      label: capabilities.aiConfigured ? "Configured · provider not reported" : "Not configured",
      detail: capabilities.aiConfigured
        ? "A proposal provider is set. It may be the deterministic demo provider; each record names the provider it used. It proposes only and cannot approve or sign."
        : "No proposal provider is configured.",
    },
    {
      key: "persistence",
      name: "Records",
      value: capabilities.persistenceConfigured ? "configured" : "unavailable",
      label: capabilities.persistenceConfigured ? "Database configured" : "Not configured",
      detail: capabilities.persistenceConfigured
        ? "Availability unverified. If the database or schema is unavailable, record lists show an error instead of data."
        : "No database is configured, so runs are not stored.",
    },
  ];
}
