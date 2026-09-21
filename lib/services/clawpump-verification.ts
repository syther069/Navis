import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";

import * as schema from "../db/schema";
import {
  CLAWPUMP_NETWORK,
  type ClawPumpAvailability,
  type ClawPumpClient,
} from "../integrations/clawpump/client";

type NavisDatabase = NodePgDatabase<typeof schema>;

export const CLAWPUMP_VERIFICATION_OPERATION = "provider_verification";

/**
 * Sanitised verification record. Stored as external_calls.metadata and shown
 * on the Markets page, Settings and /api/health. No key material, no raw
 * bodies: only public identifiers and validated summary fields.
 */
export const clawPumpVerificationRecordSchema = z.object({
  provider: z.literal("clawpump"),
  operation: z.literal(CLAWPUMP_VERIFICATION_OPERATION),
  /** Wall-clock time Navis recorded the attempt. */
  checkedAt: z.string(),
  /** Provider meta.timestamp from the actual response when one exists. */
  providerTimestamp: z.string().nullable(),
  endpoint: z.enum(["/agents", "/skills"]),
  httpStatus: z.number().int().nullable(),
  /** Which documented response contract validated, or null on failure. */
  responseType: z.enum(["agents", "skills"]).nullable(),
  requestId: z.string().nullable(),
  /** Public identifiers from the response; agent ids are opaque provider ids. */
  agentIds: z.array(z.string()),
  agentCount: z.number().int().nonnegative(),
  /** GET /agents outcome; "forbidden" means the key is not linked to an account yet. */
  agentAccess: z.enum(["granted", "forbidden", "unknown"]).default("unknown"),
  agentAccessError: z.string().nullable().default(null),
  network: z.literal(CLAWPUMP_NETWORK),
  /** The API reports no cluster; the network comes from the provider documentation. */
  networkSource: z.literal("provider_documentation"),
  result: z.enum(["connected", "unauthorised", "unreachable"]),
  safeError: z.string().nullable(),
  latencyMs: z.number().int().nonnegative(),
  /** False when no database was available; the record was returned but not stored. */
  stored: z.boolean(),
});

export type ClawPumpVerificationRecord = z.infer<
  typeof clawPumpVerificationRecordSchema
>;

export function buildVerificationRecord(input: {
  availability: ClawPumpAvailability;
  latencyMs: number;
  checkedAt: Date;
  stored: boolean;
}): ClawPumpVerificationRecord {
  const { availability } = input;
  if (availability.status === "connected") {
    return clawPumpVerificationRecordSchema.parse({
      provider: "clawpump",
      operation: CLAWPUMP_VERIFICATION_OPERATION,
      checkedAt: input.checkedAt.toISOString(),
      providerTimestamp: availability.timestamp,
      endpoint: availability.endpoint,
      httpStatus: availability.httpStatus,
      responseType: availability.endpoint === "/agents" ? "agents" : "skills",
      requestId: availability.requestId,
      agentIds: [...availability.agentIds],
      agentCount: availability.agentCount,
      agentAccess: availability.agentAccess,
      agentAccessError: availability.agentAccessError,
      network: CLAWPUMP_NETWORK,
      networkSource: "provider_documentation",
      result: "connected",
      safeError: null,
      latencyMs: input.latencyMs,
      stored: input.stored,
    });
  }
  return clawPumpVerificationRecordSchema.parse({
    provider: "clawpump",
    operation: CLAWPUMP_VERIFICATION_OPERATION,
    checkedAt: input.checkedAt.toISOString(),
    providerTimestamp: null,
    endpoint: availability.endpoint,
    httpStatus: availability.httpStatus ?? null,
    responseType: null,
    requestId: availability.requestId ?? null,
    agentIds: [],
    agentCount: 0,
    agentAccess: "unknown",
    agentAccessError: null,
    network: CLAWPUMP_NETWORK,
    networkSource: "provider_documentation",
    result: availability.status,
    safeError: availability.safeError,
    latencyMs: input.latencyMs,
    stored: input.stored,
  });
}

/**
 * Run one verification against a documented read-only endpoint and persist
 * the sanitised outcome. Only a validated real response produces a
 * `connected` row; fixtures never reach this function.
 */
export async function runClawPumpVerification(context: {
  client: Pick<ClawPumpClient, "probeAvailability">;
  database: NavisDatabase | null;
  now?: () => Date;
}): Promise<ClawPumpVerificationRecord> {
  const startedAt = performance.now();
  const checkedAt = (context.now ?? (() => new Date()))();
  const availability = await context.client.probeAvailability();
  const latencyMs = Math.round(performance.now() - startedAt);

  const record = buildVerificationRecord({
    availability,
    latencyMs,
    checkedAt,
    stored: context.database !== null,
  });

  if (context.database) {
    await context.database.insert(schema.externalCalls).values({
      provider: "clawpump",
      requestId: record.requestId,
      operation: CLAWPUMP_VERIFICATION_OPERATION,
      status: record.result === "connected" ? "succeeded" : "failed",
      latencyMs,
      safeError: record.safeError,
      metadata: record,
    });
  }
  return record;
}

export async function getLatestClawPumpVerification(
  database: NavisDatabase,
): Promise<ClawPumpVerificationRecord | null> {
  const [row] = await database
    .select({ metadata: schema.externalCalls.metadata })
    .from(schema.externalCalls)
    .where(
      and(
        eq(schema.externalCalls.provider, "clawpump"),
        eq(schema.externalCalls.operation, CLAWPUMP_VERIFICATION_OPERATION),
      ),
    )
    .orderBy(desc(schema.externalCalls.createdAt))
    .limit(1);
  if (!row) return null;
  const parsed = clawPumpVerificationRecordSchema.safeParse(row.metadata);
  return parsed.success ? parsed.data : null;
}

/**
 * Page-load helper: reuse a recent stored verification, otherwise run a new
 * one. `maxAgeMs` bounds how often an anonymous page view can trigger an
 * upstream call and a database write.
 */
export async function ensureClawPumpVerification(context: {
  client: Pick<ClawPumpClient, "probeAvailability">;
  database: NavisDatabase | null;
  maxAgeMs: number;
  now?: () => Date;
}): Promise<ClawPumpVerificationRecord> {
  const now = (context.now ?? (() => new Date()))();
  if (context.database) {
    const latest = await getLatestClawPumpVerification(context.database);
    if (latest && now.getTime() - Date.parse(latest.checkedAt) < context.maxAgeMs) {
      return latest;
    }
  }
  return runClawPumpVerification({ ...context, now: () => now });
}
