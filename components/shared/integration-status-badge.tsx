import type { Icon } from "@phosphor-icons/react";
import {
  CheckCircle,
  Clock,
  Eye,
  Flask,
  Link as LinkIcon,
  LockKey,
  PencilSimple,
  Pulse,
} from "@phosphor-icons/react/dist/ssr";

export type IntegrationStatus =
  | "LIVE"
  | "CONNECTED"
  | "READ-ONLY"
  | "DEVNET"
  | "SIMULATION"
  | "PREPARATION ONLY"
  | "BLOCKED"
  | "PLANNED";

export type IntegrationReadinessTier =
  | "production"
  | "connected"
  | "informational"
  | "devnet"
  | "simulation"
  | "draft"
  | "blocked"
  | "future";

export type IntegrationStatusMeta = Readonly<{
  label: IntegrationStatus;
  tier: IntegrationReadinessTier;
  description: string;
  icon: Icon;
}>;

export const INTEGRATION_STATUS_META: Record<IntegrationStatus, IntegrationStatusMeta> =
  {
    LIVE: {
      label: "LIVE",
      tier: "production",
      description: "Active in production on Solana mainnet with live settlement.",
      icon: Pulse,
    },
    CONNECTED: {
      label: "CONNECTED",
      tier: "connected",
      description: "Verified external API or protocol connection active.",
      icon: LinkIcon,
    },
    "READ-ONLY": {
      label: "READ-ONLY",
      tier: "informational",
      description: "Read queries and metadata inspection only. Value actions disabled.",
      icon: Eye,
    },
    DEVNET: {
      label: "DEVNET",
      tier: "devnet",
      description:
        "Operating against Solana devnet test cluster with simulated capital.",
      icon: CheckCircle,
    },
    SIMULATION: {
      label: "SIMULATION",
      tier: "simulation",
      description:
        "Evaluated offchain in deterministic runtime. Zero onchain transactions.",
      icon: Flask,
    },
    "PREPARATION ONLY": {
      label: "PREPARATION ONLY",
      tier: "draft",
      description:
        "Transaction payload is constructed and verified, but execution is withheld.",
      icon: PencilSimple,
    },
    BLOCKED: {
      label: "BLOCKED",
      tier: "blocked",
      description:
        "Feature or route is disabled pending required prerequisite verification.",
      icon: LockKey,
    },
    PLANNED: {
      label: "PLANNED",
      tier: "future",
      description:
        "Roadmap integration. No code or network connection currently active.",
      icon: Clock,
    },
  };

export function IntegrationStatusBadge({
  status,
  size = "regular",
}: {
  status: IntegrationStatus;
  size?: "compact" | "regular";
}) {
  const meta = INTEGRATION_STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={`integration-badge integration-badge-${meta.tier} ${
        size === "compact" ? "integration-badge-compact" : ""
      }`}
      data-status={status}
      data-tier={meta.tier}
      title={meta.description}
    >
      <Icon aria-hidden="true" size={size === "compact" ? 11 : 13} weight="bold" />
      <span className="integration-badge-label">{status}</span>
    </span>
  );
}
