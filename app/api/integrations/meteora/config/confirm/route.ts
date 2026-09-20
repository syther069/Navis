import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { createSolanaRpcClient } from "@/lib/integrations/solana/server";

const requestSchema = z.object({
  launchId: z.uuid(),
});

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }

  if (!env.databaseUrl) {
    return NextResponse.json(
      { error: "Persistent storage is required before confirmation." },
      { status: 503 },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate a connected wallet before confirming a Meteora launch." },
      { status: 401 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora confirmation." },
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
        { error: "Meteora launch was not found for this wallet." },
        { status: 404 },
      );
    }
    if (!launch.transactionSignature) {
      return NextResponse.json(
        { error: "Meteora launch has no transaction signature to confirm." },
        { status: 409 },
      );
    }
    if (launch.cluster !== env.cluster) {
      return NextResponse.json(
        { error: "Meteora launch cluster does not match the active cluster." },
        { status: 409 },
      );
    }

    const client = createSolanaRpcClient();
    const signature = await client.getSignatureStatus(launch.transactionSignature);
    const metadata = metadataRecord(launch.metadata);

    if (!signature.status) {
      const [updated] = await database
        .update(marketLaunches)
        .set({
          status: "unknown_pending",
          metadata: {
            ...metadata,
            confirmation: {
              state: "signature_not_found",
              contextSlot: signature.contextSlot.toString(),
              checkedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(marketLaunches.id, launch.id))
        .returning();
      return NextResponse.json(
        { launch: updated, confirmation: "unknown_pending" },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (signature.status.err !== null) {
      const [updated] = await database
        .update(marketLaunches)
        .set({
          status: "failed",
          metadata: {
            ...metadata,
            confirmation: {
              state: "onchain_error",
              error: signature.status.err,
              slot: signature.status.slot,
              checkedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(marketLaunches.id, launch.id))
        .returning();
      return NextResponse.json(
        { launch: updated, confirmation: "failed" },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (
      signature.status.confirmationStatus !== "confirmed" &&
      signature.status.confirmationStatus !== "finalized"
    ) {
      const [updated] = await database
        .update(marketLaunches)
        .set({
          status: "unknown_pending",
          metadata: {
            ...metadata,
            confirmation: {
              state: "not_yet_confirmed",
              confirmationStatus: signature.status.confirmationStatus ?? "unknown",
              slot: signature.status.slot,
              checkedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(marketLaunches.id, launch.id))
        .returning();
      return NextResponse.json(
        { launch: updated, confirmation: "unknown_pending" },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    const transaction = await client.getTransactionEvidence(
      launch.transactionSignature,
    );
    const confirmedAt = transaction?.blockTime
      ? new Date(transaction.blockTime * 1_000).toISOString()
      : new Date().toISOString();
    const [updated] = await database
      .update(marketLaunches)
      .set({
        status: "confirmed",
        metadata: {
          ...metadata,
          confirmation: {
            state: "confirmed",
            confirmationStatus: signature.status.confirmationStatus,
            slot: transaction?.slot ?? signature.status.slot,
            feeLamports: transaction?.meta?.fee ?? null,
            confirmedAt,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(marketLaunches.id, launch.id))
      .returning();

    return NextResponse.json(
      { launch: updated, confirmation: "confirmed" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meteora launch could not be confirmed.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
