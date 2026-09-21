// Client-side request key for one public Atlas run submission.
//
// Each click on "Run decision" is meant to produce a new decision, so a key is
// minted per submission. The key is kept in sessionStorage with the run's
// fingerprint (agent, scenario, universe) until the server confirms the run:
// if the request fails or the tab reloads before the answer arrives, the next
// submit of the same run reuses the key and the server returns the stored
// record instead of a twin. A confirmed run clears the key, and a different
// scenario or universe never reuses one.

import { browserSessionStorage, newRequestKey } from "@/components/agent/request-key";

export type RunRequest = Readonly<{
  agentSlug: string;
  scenario: string;
  universe: string;
}>;

export type PendingRun = Readonly<{ fingerprint: string; key: string }>;

export const PENDING_RUN_STORAGE_KEY = "navis:decision-run:pending";

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function runFingerprint(request: RunRequest): string {
  return JSON.stringify({
    agentSlug: request.agentSlug,
    scenario: request.scenario,
    universe: request.universe,
  });
}

export function readPendingRun(store: KeyValueStore | null): PendingRun | null {
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_RUN_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.fingerprint !== "string" || typeof record.key !== "string") {
      return null;
    }
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(record.key)) return null;
    return { fingerprint: record.fingerprint, key: record.key };
  } catch {
    return null;
  }
}

/** Key for this exact run: the unconfirmed one if it matches, else a new one. */
export function runRequestKeyFor(
  store: KeyValueStore | null,
  request: RunRequest,
): string {
  const fingerprint = runFingerprint(request);
  const pending = readPendingRun(store);
  if (pending && pending.fingerprint === fingerprint) return pending.key;
  const key = newRequestKey();
  try {
    store?.setItem(
      PENDING_RUN_STORAGE_KEY,
      JSON.stringify({ fingerprint, key } satisfies PendingRun),
    );
  } catch {
    // Storage may be blocked; the key still works for this page load.
  }
  return key;
}

export function clearPendingRun(store: KeyValueStore | null): void {
  try {
    store?.removeItem(PENDING_RUN_STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

export { browserSessionStorage };
