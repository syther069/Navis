import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { executionIntents, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  isMeteoraBroadcastAvailable,
  METEORA_BROADCAST_UNAVAILABLE_REASON,
} from "@/lib/integrations/meteora/broadcast-safety";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";

const requestSchema = z.object({
  intentId: z.uuid(),
  serializedTransaction: z.string().trim().min(120).max(30_000),
});

function simulationSucceeded(value: unknown) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { error?: unknown }).error === null
  );
}

function executionSubmissionAvailable() {
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
  if (!isMeteoraBroadcastAvailable()) {
    return NextResponse.json(
      { error: METEORA_BROADCAST_UNAVAILABLE_REASON },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!executionSubmissionAvailable()) {
    return NextResponse.json(
      { error: "Meteora pool submission is not enabled." },
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
      { error: "Authenticate before submitting." },
      { status: 401 },
    );
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora submission." },
      { status: 400 },
    );
  }

  const database = getDatabase();
  const client = createServerMeteoraDbcClient();
  try {
    const prepared = await database.transaction(async (transaction) => {
      const [intent] = await transaction
        .select()
        .from(executionIntents)
        .where(eq(executionIntents.id, parsed.data.intentId))
        .limit(1)
        .for("update");
      if (!intent || intent.kind !== "meteora.pool") {
        return { error: "Execution intent was not found.", status: 404 } as const;
      }
      if (intent.ownerWallet !== session.wallet) {
        return {
          error: "Execution intent belongs to another wallet.",
          status: 403,
        } as const;
      }
      if (intent.status === "submitted" || intent.status === "consumed") {
        return {
          existing: {
            id: intent.launchId,
            status: "pool_submitted",
            transactionSignature: intent.transactionSignature,
          },
        } as const;
      }
      if (intent.expiresAt <= new Date()) {
        await transaction
          .update(executionIntents)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(executionIntents.id, intent.id));
        return { error: "Execution intent has expired.", status: 410 } as const;
      }
      if (intent.cluster !== env.cluster) {
        return {
          error: "Execution intent cluster does not match.",
          status: 409,
        } as const;
      }
      if (intent.status !== "simulated" || !simulationSucceeded(intent.simulation)) {
        return {
          error: "Execution intent requires a successful simulation.",
          status: 409,
        } as const;
      }
      const currentHeight = await client.connection.getBlockHeight("confirmed");
      if (currentHeight > intent.lastValidBlockHeight) {
        return {
          error: "Execution intent blockhash has expired.",
          status: 410,
        } as const;
      }
      try {
        client.parseVerifiedSignedTransaction({
          serializedTransaction: parsed.data.serializedTransaction,
          expectedMessageSha256: intent.messageSha256,
          expectedPayer: intent.feePayer,
        });
      } catch {
        return {
          error: "Signed transaction does not match the prepared execution intent.",
          status: 400,
        } as const;
      }
      const accounts = intent.accountsSummary as {
        accounts?: { baseMint?: string; poolAddress?: string };
      };
      const [currentLaunch] = await transaction
        .select()
        .from(marketLaunches)
        .where(eq(marketLaunches.id, intent.launchId!))
        .limit(1)
        .for("update");
      if (!currentLaunch) {
        return { error: "Meteora launch was not found.", status: 404 } as const;
      }
      const metadata =
        currentLaunch.metadata &&
        typeof currentLaunch.metadata === "object" &&
        !Array.isArray(currentLaunch.metadata)
          ? currentLaunch.metadata
          : {};
      if (
        currentLaunch.status !== "confirmed" ||
        currentLaunch.baseMint ||
        currentLaunch.poolAddress ||
        "pool" in metadata
      ) {
        return {
          error: "This Meteora launch is no longer eligible for pool submission.",
          status: 409,
        } as const;
      }
      await transaction
        .update(executionIntents)
        .set({ status: "broadcasting", updatedAt: new Date() })
        .where(eq(executionIntents.id, intent.id));
      const [launch] = await transaction
        .update(marketLaunches)
        .set({
          status: "pool_broadcasting",
          baseMint: accounts.accounts?.baseMint,
          poolAddress: accounts.accounts?.poolAddress,
          metadata: {
            ...metadata,
            configTransactionSignature: currentLaunch.transactionSignature,
            pool: {
              intentId: intent.id,
              messageSha256: intent.messageSha256,
              status: "broadcasting",
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(marketLaunches.id, intent.launchId!))
        .returning();
      return { intent, launch } as const;
    });
    if ("error" in prepared) {
      return NextResponse.json(
        { error: prepared.error },
        { status: prepared.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if ("existing" in prepared) {
      return NextResponse.json(
        { launch: prepared.existing },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!prepared.launch) {
      return NextResponse.json(
        { error: "Meteora launch was not found." },
        { status: 404 },
      );
    }
    try {
      const submitted = await client.submitSignedPoolTransaction({
        serializedTransaction: parsed.data.serializedTransaction,
        expectedMessageSha256: prepared.intent.messageSha256,
        expectedPayer: prepared.intent.feePayer,
      });
      const preparedMetadata =
        prepared.launch.metadata &&
        typeof prepared.launch.metadata === "object" &&
        !Array.isArray(prepared.launch.metadata)
          ? prepared.launch.metadata
          : {};
      const preparedPool =
        "pool" in preparedMetadata &&
        preparedMetadata.pool &&
        typeof preparedMetadata.pool === "object" &&
        !Array.isArray(preparedMetadata.pool)
          ? preparedMetadata.pool
          : {};
      const [launch] = await database
        .update(marketLaunches)
        .set({
          status: "pool_submitted",
          transactionSignature: submitted.transactionSignature,
          metadata: {
            ...preparedMetadata,
            pool: {
              ...preparedPool,
              status: "submitted",
              transactionSignature: submitted.transactionSignature,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(marketLaunches.id, prepared.launch.id))
        .returning();
      await database
        .update(executionIntents)
        .set({
          status: "submitted",
          transactionSignature: submitted.transactionSignature,
          updatedAt: new Date(),
        })
        .where(eq(executionIntents.id, prepared.intent.id));
      return NextResponse.json(
        { launch },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      await database
        .update(marketLaunches)
        .set({ status: "broadcast_failed", updatedAt: new Date() })
        .where(eq(marketLaunches.id, prepared.launch.id));
      await database
        .update(executionIntents)
        .set({
          status: "failed",
          simulation: { error: "Broadcast failed." },
          updatedAt: new Date(),
        })
        .where(eq(executionIntents.id, prepared.intent.id));
      return NextResponse.json(
        { error: "Meteora broadcast failed. The attempt was recorded." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Meteora pool submission could not be processed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
