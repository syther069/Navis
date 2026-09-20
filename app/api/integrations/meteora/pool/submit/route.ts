import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  isMeteoraBroadcastAvailable,
  METEORA_BROADCAST_UNAVAILABLE_REASON,
} from "@/lib/integrations/meteora/broadcast-safety";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";

const requestSchema = z.object({
  launchId: z.uuid(),
  baseMint: z.string().trim().min(32).max(60),
  poolAddress: z.string().trim().min(32).max(60),
  serializedTransaction: z.string().trim().min(120).max(30_000),
  messageSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
      {
        error:
          "Meteora pool submission requires devnet or mainnet execution mode with SOLANA_RPC_URL configured.",
      },
      { status: 409 },
    );
  }

  if (!env.databaseUrl) {
    return NextResponse.json(
      { error: "Persistent storage is required before pool submission." },
      { status: 503 },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate a connected wallet before submitting a Meteora pool." },
      { status: 401 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora pool submission." },
      { status: 400 },
    );
  }

  const database = getDatabase();

  try {
    const [launch] = await database
      .select({
        id: marketLaunches.id,
        status: marketLaunches.status,
        cluster: marketLaunches.cluster,
        baseMint: marketLaunches.baseMint,
        poolAddress: marketLaunches.poolAddress,
        transactionSignature: marketLaunches.transactionSignature,
        metadata: marketLaunches.metadata,
      })
      .from(marketLaunches)
      .innerJoin(agents, eq(agents.id, marketLaunches.agentId))
      .where(
        and(
          eq(marketLaunches.id, parsed.data.launchId),
          eq(marketLaunches.provider, "meteora"),
          eq(agents.ownerId, session.userId),
        ),
      )
      .limit(1);

    if (!launch) {
      return NextResponse.json(
        { error: "Meteora config launch was not found for this wallet." },
        { status: 404 },
      );
    }
    if (launch.cluster !== env.cluster) {
      return NextResponse.json(
        { error: "Meteora launch cluster does not match the active cluster." },
        { status: 409 },
      );
    }
    if (launch.status !== "confirmed") {
      return NextResponse.json(
        { error: "Confirm the Meteora config transaction before submitting a pool." },
        { status: 409 },
      );
    }
    if (launch.baseMint || launch.poolAddress) {
      return NextResponse.json(
        { error: "This Meteora launch already has pool evidence." },
        { status: 409 },
      );
    }

    const submitted = await createServerMeteoraDbcClient().submitSignedPoolTransaction({
      serializedTransaction: parsed.data.serializedTransaction,
      expectedMessageSha256: parsed.data.messageSha256,
      expectedPayer: session.wallet,
    });
    const metadata = metadataRecord(launch.metadata);

    const [updated] = await database
      .update(marketLaunches)
      .set({
        status: "pool_submitted",
        baseMint: parsed.data.baseMint,
        poolAddress: parsed.data.poolAddress,
        transactionSignature: submitted.transactionSignature,
        metadata: {
          ...metadata,
          configTransactionSignature: launch.transactionSignature,
          pool: {
            kind: submitted.kind,
            baseMint: parsed.data.baseMint,
            poolAddress: parsed.data.poolAddress,
            feePayer: submitted.feePayer,
            messageSha256: submitted.messageSha256,
            signatureCount: submitted.signatureCount,
            submittedAt: submitted.submittedAt,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(marketLaunches.id, launch.id))
      .returning();

    return NextResponse.json(
      {
        launch: {
          id: updated?.id,
          status: updated?.status,
          transactionSignature: updated?.transactionSignature,
          baseMint: updated?.baseMint,
          poolAddress: updated?.poolAddress,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meteora pool transaction could not be submitted.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
