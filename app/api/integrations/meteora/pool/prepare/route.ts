import { and, eq, inArray, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents, executionIntents, marketLaunches } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";

const requestSchema = z.object({
  launchId: z.uuid(),
  baseMint: z.string().trim().min(32).max(60),
  name: z.string().trim().min(2).max(32),
  symbol: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/),
  uri: z.url().max(300),
});

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isUniqueViolation(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  );
}

function executionPreparationAvailable() {
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

  if (!executionPreparationAvailable()) {
    return NextResponse.json(
      {
        error:
          "Meteora pool preparation requires devnet or mainnet execution mode with SOLANA_RPC_URL configured.",
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
      { error: "Authenticate a connected wallet before preparing a Meteora pool." },
      { status: 401 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora pool request." },
      { status: 400 },
    );
  }

  const database = getDatabase();

  try {
    const [launch] = await database
      .select({
        id: marketLaunches.id,
        agentId: marketLaunches.agentId,
        status: marketLaunches.status,
        cluster: marketLaunches.cluster,
        baseMint: marketLaunches.baseMint,
        poolAddress: marketLaunches.poolAddress,
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
        { error: "Confirm the Meteora config transaction before creating a pool." },
        { status: 409 },
      );
    }
    if (launch.baseMint || launch.poolAddress) {
      return NextResponse.json(
        { error: "This Meteora launch already has pool evidence." },
        { status: 409 },
      );
    }

    const metadata = metadataRecord(launch.metadata);
    const config = metadata.config;
    if (typeof config !== "string") {
      return NextResponse.json(
        { error: "Meteora launch is missing confirmed config metadata." },
        { status: 409 },
      );
    }

    await database
      .update(executionIntents)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(
          eq(executionIntents.launchId, launch.id),
          inArray(executionIntents.status, ["prepared", "simulating", "simulated"]),
          lt(executionIntents.expiresAt, new Date()),
        ),
      );

    const prepared = await createServerMeteoraDbcClient().prepareCreatePoolTransaction({
      config,
      baseMint: parsed.data.baseMint,
      payer: session.wallet,
      poolCreator: session.wallet,
      name: parsed.data.name,
      symbol: parsed.data.symbol,
      uri: parsed.data.uri,
    });
    const [intent] = await database
      .insert(executionIntents)
      .values({
        kind: "meteora.pool",
        agentId: launch.agentId,
        launchId: launch.id,
        ownerWallet: session.wallet,
        cluster: env.cluster,
        feePayer: prepared.feePayer,
        messageSha256: prepared.messageSha256,
        requiredSigners: prepared.requiredSigners,
        accountsSummary: { accounts: prepared.accounts, review: prepared.review },
        instructionSummary: prepared.review,
        blockhash: prepared.recentBlockhash,
        lastValidBlockHeight: prepared.lastValidBlockHeight,
        expiresAt: new Date(Date.now() + 90_000),
        status: "prepared",
      })
      .returning({ id: executionIntents.id });

    return NextResponse.json(
      { ...prepared, intentId: intent?.id },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        {
          error:
            "This launch already has an active pool execution intent. Complete it or wait for it to expire.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meteora pool transaction could not be prepared.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
