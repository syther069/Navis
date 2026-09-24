import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";

type NavisDatabase = NodePgDatabase<typeof schema>;

/**
 * Move a launch and its intent out of the submitting state after the send
 * call returns, atomically and only if nothing else moved them first.
 *
 * Why: the signature is recorded before the send, so the confirm route can
 * already have reconciled the launch to confirmed or failed by the time the
 * send call comes back. A plain update would drag it back to submitted or
 * unknown_pending. The compare-and-set makes the reconciler's result win and
 * returns whatever the row currently says.
 */
export async function finalizeMeteoraSubmit(
  database: NavisDatabase,
  input: {
    launchId: string;
    intentId: string;
    fromLaunchStatus: string;
    launchStatus: string;
    intentStatus: "submitted" | "unknown_pending" | "failed";
    metadata: Record<string, unknown>;
  },
) {
  return database.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(schema.marketLaunches)
      .set({
        status: input.launchStatus,
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.marketLaunches.id, input.launchId),
          eq(schema.marketLaunches.status, input.fromLaunchStatus),
        ),
      )
      .returning();
    if (!updated) {
      // Reconciliation already settled this launch; report its current state.
      const [current] = await transaction
        .select()
        .from(schema.marketLaunches)
        .where(eq(schema.marketLaunches.id, input.launchId))
        .limit(1);
      return current ?? null;
    }
    await transaction
      .update(schema.executionIntents)
      .set({ status: input.intentStatus, updatedAt: new Date() })
      .where(
        and(
          eq(schema.executionIntents.id, input.intentId),
          eq(schema.executionIntents.status, "submitting"),
        ),
      );
    return updated;
  });
}
