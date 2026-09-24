import { createHmac } from "node:crypto";

import { and, eq, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";

type NavisDatabase = NodePgDatabase<typeof schema>;

export type SharedRateLimit = Readonly<{
  /** Endpoint name; each scope has its own counters. */
  scope: string;
  /** Raw client identifier (an address). It is stored only as a keyed hash. */
  client: string;
  limit: number;
  windowMs: number;
  /** Secret for the keyed hash so stored rows cannot be mapped back to addresses. */
  secret?: string | null;
  now?: number;
}>;

export type SharedRateLimitResult = Readonly<{
  allowed: boolean;
  hits: number;
  limit: number;
  /** Seconds until the current window ends. */
  retryAfterSeconds: number;
}>;

export function hashClient(scope: string, client: string, secret?: string | null) {
  return createHmac("sha256", secret || "navis-rate-limit")
    .update(`${scope}:${client}`)
    .digest("hex");
}

/**
 * Fixed-window counter shared by every instance through the database. One
 * upsert per request increments the window row and returns the new count;
 * windows older than two periods are pruned opportunistically. Nothing about
 * the caller is stored except a keyed hash.
 */
export async function consumeSharedRateLimit(
  database: NavisDatabase,
  input: SharedRateLimit,
): Promise<SharedRateLimitResult> {
  const now = input.now ?? Date.now();
  const windowStartMs = Math.floor(now / input.windowMs) * input.windowMs;
  const windowStart = new Date(windowStartMs);
  const clientHash = hashClient(input.scope, input.client, input.secret);

  const [row] = await database
    .insert(schema.rateLimitWindows)
    .values({ scope: input.scope, clientHash, windowStart, hits: 1 })
    .onConflictDoUpdate({
      target: [
        schema.rateLimitWindows.scope,
        schema.rateLimitWindows.clientHash,
        schema.rateLimitWindows.windowStart,
      ],
      set: {
        hits: sql`${schema.rateLimitWindows.hits} + 1`,
        updatedAt: new Date(now),
      },
    })
    .returning({ hits: schema.rateLimitWindows.hits });
  const hits = row?.hits ?? input.limit + 1;

  // Prune stale windows for this scope; cheap thanks to the (scope, window) index.
  await database
    .delete(schema.rateLimitWindows)
    .where(
      and(
        eq(schema.rateLimitWindows.scope, input.scope),
        lt(
          schema.rateLimitWindows.windowStart,
          new Date(windowStartMs - 2 * input.windowMs),
        ),
      ),
    );

  return {
    allowed: hits <= input.limit,
    hits,
    limit: input.limit,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowStartMs + input.windowMs - now) / 1000),
    ),
  };
}
