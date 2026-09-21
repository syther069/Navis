// Client-side request key for idempotent agent creation.
//
// The key is written to sessionStorage together with a fingerprint of the
// mandate it belongs to. If the tab is reloaded after a failed or
// unconfirmed save, reviewing the same mandate again reuses the key and the
// server replays the first agent instead of creating a second one. A changed
// mandate produces a new key, so a key can never be sent with different
// content. The fingerprint covers exactly the fields the server binds the key
// to (name, objective and the risk limits); the ClawPump link flag is stored
// only so the form can be restored after a reload.

export type MandateSnapshot = Readonly<{
  name: string;
  objective: string;
  maxTradeBps: number;
  maxPositionBps: number;
  minReserveBps: number;
  maxSlippageBps: number;
  linkClawPump: boolean;
}>;

export type PendingCreation = Readonly<{
  fingerprint: string;
  key: string;
  mandate: MandateSnapshot;
}>;

export const PENDING_CREATION_STORAGE_KEY = "navis:agent-creation:pending";

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function mandateFingerprint(mandate: MandateSnapshot): string {
  return JSON.stringify({
    name: mandate.name.trim(),
    objective: mandate.objective.trim(),
    maxTradeBps: mandate.maxTradeBps,
    maxPositionBps: mandate.maxPositionBps,
    minReserveBps: mandate.minReserveBps,
    maxSlippageBps: mandate.maxSlippageBps,
  });
}

export function newRequestKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isPendingCreation(value: unknown): value is PendingCreation {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.fingerprint === "string" &&
    typeof record.key === "string" &&
    record.key.length >= 8 &&
    !!record.mandate &&
    typeof record.mandate === "object"
  );
}

export function readPendingCreation(
  store: KeyValueStore | null,
): PendingCreation | null {
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_CREATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPendingCreation(parsed)) return null;
    // A stale record whose fingerprint no longer matches its own mandate is
    // discarded rather than trusted.
    if (mandateFingerprint(parsed.mandate) !== parsed.fingerprint) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Return the request key for this exact mandate, reusing the stored one when
 * the mandate has not changed since the last attempt, otherwise minting a new
 * key and remembering it.
 */
export function requestKeyFor(
  store: KeyValueStore | null,
  mandate: MandateSnapshot,
): string {
  const fingerprint = mandateFingerprint(mandate);
  const pending = readPendingCreation(store);
  if (pending && pending.fingerprint === fingerprint) return pending.key;
  const key = newRequestKey();
  try {
    store?.setItem(
      PENDING_CREATION_STORAGE_KEY,
      JSON.stringify({ fingerprint, key, mandate } satisfies PendingCreation),
    );
  } catch {
    // Storage may be full or blocked; the key still works for this page load.
  }
  return key;
}

export function clearPendingCreation(store: KeyValueStore | null): void {
  try {
    store?.removeItem(PENDING_CREATION_STORAGE_KEY);
  } catch {
    // Nothing to do; the record simply lives until the session ends.
  }
}

export function browserSessionStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
