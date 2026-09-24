// Client-side request key for idempotent agent creation.
//
// The key is written to localStorage together with a fingerprint of the
// mandate it belongs to. localStorage, not sessionStorage, because the record
// must outlive a closed tab or browser: if the owner comes back after an
// unconfirmed save, reviewing the same mandate again reuses the key and the
// server replays the first agent instead of creating a second one. A changed
// mandate produces a new key, so a key can never be sent with different
// content. The fingerprint covers exactly the fields the server binds the key
// to (name, objective and the risk limits) plus the wallet the save belongs
// to, because server idempotency is owner-scoped: another wallet sending the
// same key would create a new agent, not replay. The ClawPump link flag is
// stored only so the form can be restored after a reload.
//
// If localStorage is blocked or full, the record lives in module memory so
// that retries within the same page load still share one key; only
// reload and reopen safety is lost in that case.

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
  wallet: string;
  mandate: MandateSnapshot;
}>;

export const PENDING_CREATION_STORAGE_KEY = "navis:agent-creation:pending";

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function mandateFingerprint(wallet: string, mandate: MandateSnapshot): string {
  return JSON.stringify({
    wallet,
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
    typeof record.wallet === "string" &&
    record.wallet.length > 0 &&
    !!record.mandate &&
    typeof record.mandate === "object"
  );
}

/**
 * Read the pending record for this wallet. A record written for another
 * wallet in the same tab is never returned (and never restored into the form).
 */
export function readPendingCreation(
  store: KeyValueStore | null,
  wallet: string,
): PendingCreation | null {
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_CREATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPendingCreation(parsed)) return null;
    if (parsed.wallet !== wallet) return null;
    // A stale record whose fingerprint no longer matches its own content is
    // discarded rather than trusted.
    if (mandateFingerprint(parsed.wallet, parsed.mandate) !== parsed.fingerprint) {
      return null;
    }
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
  wallet: string,
  mandate: MandateSnapshot,
): string {
  const fingerprint = mandateFingerprint(wallet, mandate);
  const pending = readPendingCreation(store, wallet);
  if (pending && pending.fingerprint === fingerprint) return pending.key;
  const key = newRequestKey();
  try {
    store?.setItem(
      PENDING_CREATION_STORAGE_KEY,
      JSON.stringify({ fingerprint, key, wallet, mandate } satisfies PendingCreation),
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

// Same-page fallback used when localStorage throws or is missing.
const memory = new Map<string, string>();

/**
 * localStorage when it works, otherwise an in-memory store for this page
 * load. Every read and write is guarded, so a Storage object that throws can
 * never break rendering. Never returns null in a browser.
 */
export function browserStorage(): KeyValueStore {
  return {
    getItem(key) {
      try {
        if (typeof window !== "undefined") {
          const value = window.localStorage.getItem(key);
          if (value !== null) return value;
        }
      } catch {
        // fall through to memory
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      } catch {
        // memory copy already holds it
      }
    },
    removeItem(key) {
      memory.delete(key);
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(key);
      } catch {
        // nothing more to do
      }
    },
  };
}
