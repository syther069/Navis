const MAX_CLIENTS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;
const attempts = new Map<string, { times: number[]; expiresAt: number }>();
let nextSweepAt = 0;

/** Best-effort client identifier: first forwarded address, else "local". */
export function clientIdentifier(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export function allowMutationRequest(
  request: Request,
  limit = 20,
  windowMs = 60_000,
  scope = "mutation",
) {
  const key = `${scope}:${clientIdentifier(request)}`;
  const now = Date.now();
  if (now >= nextSweepAt) {
    for (const [client, entry] of attempts) {
      if (entry.expiresAt <= now) attempts.delete(client);
    }
    nextSweepAt = now + SWEEP_INTERVAL_MS;
  }
  const entry = attempts.get(key);
  // Never evict an active limiter to admit a new identity: fail closed at
  // capacity, preserving existing clients' limits until the next sweep.
  if (!entry && attempts.size >= MAX_CLIENTS) return false;
  const recent = (entry?.times ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  attempts.set(key, { times: recent, expiresAt: now + windowMs });
  return true;
}
