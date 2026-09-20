export const METEORA_BROADCAST_UNAVAILABLE_REASON =
  "Meteora broadcast is unavailable until server-approved preparation and simulation binding, onchain pool metadata verification, idempotency, and broadcast recovery are audited.";

/**
 * Deliberate code-level release gate. This is intentionally not derived from
 * environment configuration and cannot be enabled with a deployment toggle.
 */
export function isMeteoraBroadcastAvailable(): false {
  return false;
}
