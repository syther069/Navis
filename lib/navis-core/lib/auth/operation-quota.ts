import { NextResponse } from "@workspace/navis-core/server/http";

import { getDatabase } from "../db/client";
import { env } from "../env";
import { allowMutationRequest, clientIdentifier } from "./rate-limit";
import { consumeSharedRateLimit } from "./shared-rate-limit";

/**
 * Application policy, not thresholds prescribed by a standard: each wallet
 * gets 120 operations per scope / 10 minutes, with a 30/minute process burst
 * guard. Public RPC reads get 120/client/minute (60/minute process burst).
 * These deliberately generous limits accommodate judge retries and replays.
 * DB-configured deployments share counters across instances and fail closed.
 * Without a DB, both windows are explicitly bounded, process-local best effort;
 * restarts/multiple instances weaken that protection. No configured-DB fallback.
 *
 * OWASP REST Security recommends 429 for rate limiting; RFC 6585 says 429
 * responses MUST NOT be cached and permits Retry-After.
 */
async function consumeOperationQuota(
  scope: string,
  client: string,
  publicRpc: boolean,
) {
  const windowMs = publicRpc ? 60_000 : 600_000;
  // Never pass caller-controlled headers to the wallet burst limiter.
  const identity = new Request("http://quota.internal", {
    headers: { "x-real-ip": client },
  });
  const refuse = (seconds: number) =>
    NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.max(1, Math.ceil(seconds))),
        },
      },
    );
  if (!allowMutationRequest(identity, publicRpc ? 60 : 30, 60_000, `${scope}.burst`)) {
    return refuse(60);
  }
  if (!env.databaseUrl) {
    return allowMutationRequest(identity, 120, windowMs, `${scope}.local`)
      ? null
      : refuse(windowMs / 1000);
  }
  try {
    const result = await consumeSharedRateLimit(getDatabase(), {
      scope,
      client,
      limit: 120,
      windowMs,
      secret: env.sessionSecret,
    });
    return result.allowed ? null : refuse(result.retryAfterSeconds);
  } catch {
    return NextResponse.json(
      { error: "Request quota is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/** Call only after authenticating; identity must be the verified session wallet. */
export function requireWalletQuota(session: { wallet: string }, scope: string) {
  return consumeOperationQuota(`wallet.${scope}`, session.wallet, false);
}

/** Best-effort address identity; deployment must overwrite forwarded headers. */
export function requirePublicRpcQuota(request: Request, scope: string) {
  return consumeOperationQuota(`rpc.${scope}`, clientIdentifier(request), true);
}
