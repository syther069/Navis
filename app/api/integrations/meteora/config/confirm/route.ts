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

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return json({ error: "Untrusted request origin." }, 403);
  }

  if (!env.databaseUrl) {
    return json({ error: "Persistent storage is required before confirmation." }, 503);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return json(
      { error: "Authenticate a connected wallet before confirming a Meteora launch." },
      401,
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora confirmation." },
      400,
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
      return json({ error: "Meteora launch was not found for this wallet." }, 404);
    }
    if (!launch.transactionSignature) {
      return json(
        { error: "Meteora launch has no transaction signature to confirm." },
        409,
      );
    }
    if (launch.cluster !== env.cluster) {
      return json(
        { error: "Meteora launch cluster does not match the active cluster." },
        409,
      );
    }

    const metadata = metadataRecord(launch.metadata);
    if (launch.status === "confirmed" || launch.status === "failed") {
      return json(
        {
          launch,
          confirmation: launch.status,
        },
        200,
      );
    }
    if (
      !["submitted", "unknown_pending"].includes(launch.status) ||
      metadata.pool !== undefined
    ) {
      return json(
        {
          error:
            "This confirmation endpoint only checks a pending Meteora config transaction.",
        },
        409,
      );
    }

    async function persistConfirmation(
      status: "unknown_pending" | "failed" | "confirmed",
      confirmation: Record<string, unknown>,
      responseStatus: number,
    ) {
      const [updated] = await database
        .update(marketLaunches)
        .set({
          status,
          metadata: { ...metadata, confirmation },
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(marketLaunches.id, launch.id),
            eq(marketLaunches.status, launch.status),
          ),
        )
        .returning();

      if (!updated) {
        return json(
          { error: "Meteora launch state changed during confirmation; retry safely." },
          409,
        );
      }
      return json({ launch: updated, confirmation: status }, responseStatus);
    }

    const client = createSolanaRpcClient();
    const signature = await client.getSignatureStatus(launch.transactionSignature);

    if (!signature.status) {
      return persistConfirmation(
        "unknown_pending",
        {
          state: "signature_not_found",
          contextSlot: signature.contextSlot.toString(),
          checkedAt: new Date().toISOString(),
        },
        202,
      );
    }

    if (signature.status.err !== null) {
      return persistConfirmation(
        "failed",
        {
          state: "onchain_error",
          slot: signature.status.slot,
          checkedAt: new Date().toISOString(),
        },
        200,
      );
    }

    if (
      signature.status.confirmationStatus !== "confirmed" &&
      signature.status.confirmationStatus !== "finalized"
    ) {
      return persistConfirmation(
        "unknown_pending",
        {
          state: "not_yet_confirmed",
          confirmationStatus: signature.status.confirmationStatus ?? "unknown",
          slot: signature.status.slot,
          checkedAt: new Date().toISOString(),
        },
        202,
      );
    }

    const transaction = await client.getTransactionEvidence(
      launch.transactionSignature,
    );
    if (!transaction?.meta || transaction.blockTime === null) {
      return persistConfirmation(
        "unknown_pending",
        {
          state: "confirmed_transaction_evidence_unavailable",
          checkedAt: new Date().toISOString(),
        },
        202,
      );
    }
    if (transaction.meta.err !== null) {
      return persistConfirmation(
        "failed",
        {
          state: "confirmed_transaction_error",
          slot: transaction.slot,
          checkedAt: new Date().toISOString(),
        },
        200,
      );
    }
    if (
      transaction.slot !== signature.status.slot ||
      BigInt(signature.status.slot) > signature.contextSlot
    ) {
      return persistConfirmation(
        "unknown_pending",
        {
          state: "inconsistent_chain_evidence",
          signatureSlot: signature.status.slot,
          transactionSlot: transaction.slot,
          contextSlot: signature.contextSlot.toString(),
          checkedAt: new Date().toISOString(),
        },
        202,
      );
    }

    const confirmedAtDate = new Date(transaction.blockTime * 1_000);
    if (!Number.isFinite(confirmedAtDate.getTime())) {
      return persistConfirmation(
        "unknown_pending",
        {
          state: "invalid_block_time_evidence",
          checkedAt: new Date().toISOString(),
        },
        202,
      );
    }

    return persistConfirmation(
      "confirmed",
      {
        state: "confirmed",
        confirmationStatus: signature.status.confirmationStatus,
        slot: transaction.slot,
        feeLamports: transaction.meta.fee,
        confirmedAt: confirmedAtDate.toISOString(),
      },
      200,
    );
  } catch {
    return json(
      { error: "Meteora confirmation evidence is temporarily unavailable." },
      502,
    );
  }
}
