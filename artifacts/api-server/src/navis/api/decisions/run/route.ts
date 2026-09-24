import { logger } from "@workspace/navis-core/server/logger";
import { NextResponse } from "@workspace/navis-core/server/http";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@workspace/navis-core/lib/auth/request";
import { requireWalletQuota } from "@workspace/navis-core/lib/auth/operation-quota";
import { allowMutationRequest, clientIdentifier } from "@workspace/navis-core/lib/auth/rate-limit";
import { consumeSharedRateLimit } from "@workspace/navis-core/lib/auth/shared-rate-limit";
import { readSessionToken, SESSION_COOKIE_NAME } from "@workspace/navis-core/lib/auth/server";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import {
  classifyDatabaseError,
  DatabaseError,
  logDatabaseError,
} from "@workspace/navis-core/lib/db/errors";
import { env } from "@workspace/navis-core/lib/env";
import { getPersistentAgentForOwner } from "@workspace/navis-core/lib/services/agents";
import { PUBLIC_ATLAS_SLUG } from "@workspace/navis-core/lib/services/public-atlas";
import {
  DecisionNotStoredError,
  PersistentDecisionRunsNotEnabledError,
  runDecision,
  runPublicAtlasDecision,
} from "@workspace/navis-core/lib/services/run-decision";
import { demoAgentBundle } from "@workspace/navis-core/fixtures/demo-agent";

/** Upper bound for one run: catalogue read, provider, one write transaction. */
export const maxDuration = 30;

/** Largest accepted request body; the real payload is well under 200 bytes. */
const MAX_BODY_BYTES = 2_048;

/** Public runs per client per minute, shared across every instance. */
const PUBLIC_RUN_LIMIT = 12;
const PUBLIC_RUN_WINDOW_MS = 60_000;

const requestSchema = z
  .object({
    agentSlug: z.string().min(2).max(48),
    scenario: z.enum(["balanced", "oversized"]),
    // PreStocks is the default universe; the service falls back to the fixture
    // with a visible note when the catalogue is unreachable or fails validation.
    universe: z.enum(["prestocks", "fixture"]).default("prestocks"),
    // Browser-generated key for one submission; a retry reuses it and gets the
    // stored run back instead of a twin.
    requestKey: z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,128}$/)
      .optional(),
  })
  .strict();

const NOT_STORED_MESSAGE =
  "The decision could not be stored. Nothing was saved; please run it again.";

function json(body: unknown, status: number, cacheControl = "no-store") {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": cacheControl },
  });
}

async function readBody(request: Request): Promise<unknown | typeof TOO_LARGE> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return TOO_LARGE;
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return TOO_LARGE;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
const TOO_LARGE = Symbol("too-large");

/**
 * Maps a failure to a response that never carries driver text, SQL, hosts or
 * constraint names. Known application errors keep their own message.
 */
function failureResponse(error: unknown, stored: boolean) {
  if (error instanceof PersistentDecisionRunsNotEnabledError) {
    return json({ error: error.message }, 409);
  }
  if (error instanceof DecisionNotStoredError) {
    const classified = classifyDatabaseError(error.cause);
    logDatabaseError("decisions.run", classified);
    return json(
      { error: NOT_STORED_MESSAGE, code: classified.code, stored: false },
      classified.code === "database_error" ? 500 : classified.status,
    );
  }
  if (error instanceof DatabaseError) {
    logDatabaseError("decisions.run", error);
    return json({ ...error.toJSON(), stored: false }, error.status);
  }
  const classified = classifyDatabaseError(error);
  logDatabaseError("decisions.run", classified);
  if (classified.code !== "database_error") {
    return json({ ...classified.toJSON(), stored: false }, classified.status);
  }
  logger.error({ detail: error instanceof Error ? error.name : typeof error, }, "[navis:decisions.run] unexpected failure:");
  return json(
    {
      error: stored ? NOT_STORED_MESSAGE : "The decision run could not finish.",
      stored: false,
    },
    500,
  );
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return json({ error: "Untrusted request origin." }, 403);
  }
  if (!allowMutationRequest(request)) {
    return json({ error: "Too many decision requests. Try again shortly." }, 429);
  }
  const body = await readBody(request);
  if (body === TOO_LARGE) {
    return json({ error: "Request body is too large." }, 413);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "agentSlug and a valid scenario are required." }, 400);
  }

  try {
    // The Atlas fixture is the public demo: no wallet session, never executes.
    // With a database every run is stored as a public record; without one it
    // runs in memory and says so.
    if (parsed.data.agentSlug === PUBLIC_ATLAS_SLUG) {
      if (!env.databaseUrl) {
        const result = await runDecision({
          bundle: demoAgentBundle,
          scenario: parsed.data.scenario,
          universe: parsed.data.universe,
        });
        return json(result, 200);
      }
      const database = getDatabase();
      const shared = await consumeSharedRateLimit(database, {
        scope: "decisions.run.public",
        client: clientIdentifier(request),
        limit: PUBLIC_RUN_LIMIT,
        windowMs: PUBLIC_RUN_WINDOW_MS,
        secret: env.sessionSecret,
      });
      if (!shared.allowed) {
        return NextResponse.json(
          { error: "Too many decision requests. Try again shortly." },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "Retry-After": String(shared.retryAfterSeconds),
            },
          },
        );
      }
      const result = await runPublicAtlasDecision({
        scenario: parsed.data.scenario,
        universe: parsed.data.universe,
        clientRequestId: parsed.data.requestKey,
        database,
      });
      return json(result, 200);
    }
    if (!env.databaseUrl) {
      return json({ error: "Agent not found." }, 404);
    }

    const token = request.headers
      .get("cookie")
      ?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
    const session = token ? await readSessionToken(token) : null;
    if (!session) {
      return json({ error: "Authenticate a connected wallet to run this agent." }, 401);
    }
    const quota = await requireWalletQuota(session, "decisions.run");
    if (quota) return quota;
    const database = getDatabase();
    const bundle = await getPersistentAgentForOwner(
      parsed.data.agentSlug,
      session.wallet,
      database,
    );
    if (!bundle) {
      return json({ error: "Agent not found." }, 404);
    }
    // Demo-mode persisted agents store the full run. Devnet and mainnet
    // agents still refuse until they have real snapshots and market data.
    const result = await runDecision({
      bundle,
      scenario: parsed.data.scenario,
      universe: parsed.data.universe,
      database,
    });
    return json(result, 200, "private, no-store");
  } catch (error) {
    return failureResponse(error, Boolean(env.databaseUrl));
  }
}
