const attempts = new Map<string, number[]>();

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
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
}
