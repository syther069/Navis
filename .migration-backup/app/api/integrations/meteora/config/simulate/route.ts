import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { requireWalletQuota } from "@/lib/auth/operation-quota";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { executionIntents } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { meteoraPublicErrorMessage } from "@/lib/integrations/meteora/errors";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";

const requestSchema = z.object({
  intentId: z.uuid(),
  serializedTransaction: z.string().trim().min(120).max(30_000),
});

function executionSimulationAvailable() {
  if (env.executionMode === "devnet") {
    return env.enableDevnetExecution && Boolean(env.solanaRpcUrl);
  }
  if (env.executionMode === "mainnet") {
    return env.enableMainnetExecution && Boolean(env.solanaRpcUrl);
  }
  return false;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }

  if (!executionSimulationAvailable()) {
    return NextResponse.json(
      {
        error:
          "Meteora transaction simulation requires devnet or mainnet execution mode with SOLANA_RPC_URL configured.",
      },
      { status: 409 },
    );
  }
  if (!env.databaseUrl) {
    return NextResponse.json(
      { error: "Meteora execution requires a configured database." },
      { status: 503 },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      {
        error:
          "Authenticate a connected wallet before simulating a Meteora transaction.",
      },
      { status: 401 },
    );
  }

  const quota = await requireWalletQuota(session, "meteora.config.simulate");
  if (quota) return quota;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora simulation." },
      { status: 400 },
    );
  }

  try {
    const database = getDatabase();
    const [intent] = await database
      .select()
      .from(executionIntents)
      .where(
        and(
          eq(executionIntents.id, parsed.data.intentId),
          eq(executionIntents.kind, "meteora.config"),
        ),
      )
      .limit(1);
    if (!intent) {
      return NextResponse.json(
        { error: "Execution intent was not found." },
        { status: 404 },
      );
    }
    if (intent.ownerWallet !== session.wallet) {
      return NextResponse.json(
        { error: "Execution intent belongs to another wallet." },
        { status: 403 },
      );
    }
    if (intent.expiresAt <= new Date()) {
      await database
        .update(executionIntents)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            eq(executionIntents.id, intent.id),
            inArray(executionIntents.status, ["prepared", "simulated"]),
          ),
        );
      return NextResponse.json(
        { error: "Execution intent has expired." },
        { status: 410 },
      );
    }
    const [claimed] = await database
      .update(executionIntents)
      .set({ status: "simulating", updatedAt: new Date() })
      .where(
        and(
          eq(executionIntents.id, intent.id),
          inArray(executionIntents.status, ["prepared", "simulated"]),
        ),
      )
      .returning();
    if (!claimed) {
      return NextResponse.json(
        { error: "Execution intent cannot be simulated in its current state." },
        { status: 409 },
      );
    }
    let simulation;
    try {
      simulation = await createServerMeteoraDbcClient().simulateSignedConfigTransaction(
        {
          serializedTransaction: parsed.data.serializedTransaction,
          expectedMessageSha256: intent.messageSha256,
          expectedPayer: intent.feePayer,
        },
      );
    } catch (error) {
      await database
        .update(executionIntents)
        .set({ status: "prepared", updatedAt: new Date() })
        .where(
          and(
            eq(executionIntents.id, intent.id),
            eq(executionIntents.status, "simulating"),
          ),
        );
      throw error;
    }
    const [updated] = await database
      .update(executionIntents)
      .set({ simulation, status: "simulated", updatedAt: new Date() })
      .where(
        and(
          eq(executionIntents.id, intent.id),
          eq(executionIntents.status, "simulating"),
        ),
      )
      .returning();
    if (!updated) {
      return NextResponse.json(
        { error: "Execution intent state changed during simulation." },
        { status: 409 },
      );
    }

    return NextResponse.json(simulation, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: meteoraPublicErrorMessage(
          error,
          "Meteora config transaction could not be simulated.",
        ),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
