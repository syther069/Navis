import type { ExecutionMode, SolanaCluster } from "@workspace/navis-core/lib/env-core";

/**
 * Meteora broadcast release gate.
 *
 * Audited prerequisites (task 4, 2026-09-22; see docs/TASK4_METEORA_DEVNET_DELIVERY.md):
 *
 * 1. Server-approved preparation: transactions are built only by the server
 *    from allowlisted quote profiles (lib/integrations/meteora/quote-profiles.ts)
 *    and persisted as execution intents bound to owner wallet, cluster, message
 *    SHA-256, required signers, blockhash and expiry.
 * 2. Simulation binding: submission requires an intent whose signed bytes were
 *    simulated successfully against the same message hash and payer.
 * 3. Onchain verification: reconciliation decodes the config/pool account and
 *    only marks protocol_verified when it matches the recorded evidence
 *    (lib/services/meteora-reconciliation.ts).
 * 4. Idempotency and recovery: the message hash is unique, the signature is
 *    recorded before send, submission writes are compare-and-set, a send whose
 *    outcome is unknown becomes unknown_pending and reconciles instead of
 *    re-broadcasting, and replayed intents return the stored launch.
 *
 * Devnet-only release explicitly authorised by the owner on 2026-09-23.
 * All four capability checks must hold; mainnet remains blocked regardless of
 * deployment flags. Each transaction still requires wallet approval, successful
 * simulation, persisted intent binding and RPC genesis validation.
 */

export type MeteoraBroadcastCapability = Readonly<{
  executionMode: ExecutionMode;
  cluster: SolanaCluster;
  devnetExecutionEnabled: boolean;
  solanaRpcConfigured: boolean;
}>;

export const METEORA_MAINNET_BROADCAST_BLOCK =
  "Meteora mainnet broadcast stays disabled at code level; a separate audited release is required.";

export const METEORA_BROADCAST_UNAVAILABLE_REASON =
  "Meteora broadcast is available only in explicitly enabled devnet mode with a devnet RPC.";

export function isMeteoraBroadcastAvailable(
  capability: MeteoraBroadcastCapability,
): boolean {
  return (
    capability.executionMode === "devnet" &&
    capability.cluster === "devnet" &&
    capability.devnetExecutionEnabled &&
    capability.solanaRpcConfigured
  );
}

export function meteoraBroadcastUnavailableReason(
  capability: MeteoraBroadcastCapability,
): string {
  if (isMeteoraBroadcastAvailable(capability)) return "";
  if (capability.executionMode === "mainnet" || capability.cluster !== "devnet") {
    return METEORA_MAINNET_BROADCAST_BLOCK;
  }
  if (capability.executionMode === "demo") {
    return "Meteora broadcast is unavailable in demo mode. Use explicitly enabled devnet mode for test transactions.";
  }
  if (!capability.devnetExecutionEnabled) {
    return "Meteora devnet broadcast is disabled by ENABLE_DEVNET_EXECUTION.";
  }
  if (!capability.solanaRpcConfigured) {
    return "Meteora devnet broadcast needs SOLANA_RPC_URL pointing at a devnet RPC.";
  }
  return METEORA_BROADCAST_UNAVAILABLE_REASON;
}
