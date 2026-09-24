import "@workspace/navis-core/server/only";

import { env } from "@workspace/navis-core/lib/env";

function safeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Origin the browser actually used to reach this server, derived from the
 * proxy-aware host headers. Only https is trusted for forwarded hosts.
 */
export function requestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
      return safeOrigin(`${proto === "http" ? "http" : "https"}://${host}`);
    }
    return null;
  }
  return safeOrigin(request.url);
}

/**
 * A mutation is trusted when the browser's Origin matches either the
 * configured application URL or the origin the request itself arrived on
 * (the same-origin rule). Requests without an Origin header are rejected.
 */
export function hasTrustedMutationOrigin(request: Request) {
  const origin = safeOrigin(request.headers.get("origin"));
  if (!origin) return false;

  const configured = safeOrigin(env.appUrl);
  if (configured && origin === configured) return true;

  const own = requestOrigin(request);
  return own !== null && origin === own;
}
