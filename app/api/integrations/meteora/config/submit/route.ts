import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";

const requestSchema = z.object({
  agentId: z.uuid(),
  config: z.string().trim().min(32).max(60),
  serializedTransaction: z.string().trim().min(120).max(30_000),
  messageSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

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

  if (!executionSubmissionAvailable()) {
    return NextResponse.json(
      {
        error:
          "Meteora transaction submission requires devnet or mainnet execution mode with SOLANA_RPC_URL configured.",
      },
      { status: 409 },
    );
  }

  if (!env.databaseUrl) {
    return NextResponse.json(
      { error: "Persistent storage is required before submission." },
      { status: 503 },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      {
        error:
          "Authenticate a connected wallet before submitting a Meteora transaction.",
      },
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
  const idempotencyKey = `meteora-config:${parsed.data.messageSha256}`;

  try {
    const [agent] = await database
      .select({
        id: agents.id,
        mode: agents.mode,
        cluster: agents.cluster,
        ownerId: agents.ownerId,
      })
      .from(agents)
      .where(
        and(eq(agents.id, parsed.data.agentId), eq(agents.ownerId, session.userId)),
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json(
        { error: "Meteora submission agent was not found for this wallet." },
        { status: 404 },
      );
    }
    if (agent.mode !== env.executionMode || agent.cluster !== env.cluster) {
      return NextResponse.json(
        {
          error: "Meteora submission agent does not match the active mode and cluster.",
        },
        { status: 409 },
      );
    }

    const [existing] = await database
      .select()
      .from(marketLaunches)
      .where(eq(marketLaunches.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existing) {
      return NextResponse.json(
        {
          launch: {
            id: existing.id,
            status: existing.status,
            transactionSignature: existing.transactionSignature,
            config: existing.metadata,
          },
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const submitted =
      await createServerMeteoraDbcClient().submitSignedConfigTransaction({
        serializedTransaction: parsed.data.serializedTransaction,
        expectedMessageSha256: parsed.data.messageSha256,
        expectedPayer: session.wallet,
      });

    const [launch] = await database
      .insert(marketLaunches)
      .values({
        agentId: agent.id,
        provider: "meteora",
        idempotencyKey,
        cluster: env.cluster,
        status: "submitted",
        quoteMint: "So11111111111111111111111111111111111111112",
        poolAddress: null,
        baseMint: null,
        payoutWallet: session.wallet,
        transactionSignature: submitted.transactionSignature,
        metadata: {
          kind: submitted.kind,
          config: parsed.data.config,
          feePayer: submitted.feePayer,
          messageSha256: submitted.messageSha256,
          signatureCount: submitted.signatureCount,
          submittedAt: submitted.submittedAt,
        },
      })
      .returning();

    return NextResponse.json(
      {
        launch: {
          id: launch?.id,
          status: launch?.status,
          transactionSignature: launch?.transactionSignature,
          config: parsed.data.config,
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
            : "Meteora config transaction could not be submitted.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
