import { NextRequest, NextResponse } from "@workspace/navis-core/server/http";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@workspace/navis-core/lib/auth/request";
import { requireWalletQuota } from "@workspace/navis-core/lib/auth/operation-quota";
import { readSessionToken, SESSION_COOKIE_NAME } from "@workspace/navis-core/lib/auth/server";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import { agents, executionIntents } from "@workspace/navis-core/lib/db/schema";
import { env } from "@workspace/navis-core/lib/env";
import { meteoraPublicErrorMessage } from "@workspace/navis-core/lib/integrations/meteora/errors";
import {
  METEORA_QUOTE_PROFILE_IDS,
  MeteoraQuoteProfileError,
  getMeteoraQuoteProfile,
  resolveMeteoraQuoteProfile,
} from "@workspace/navis-core/lib/integrations/meteora/quote-profiles";
import { createServerMeteoraDbcClient } from "@workspace/navis-core/lib/integrations/meteora/server";
import { getPreStocksCatalogue } from "@workspace/navis-core/lib/integrations/prestocks/client";
import { and, eq } from "drizzle-orm";

const requestSchema = z.object({
  agentId: z.uuid(),
  config: z.string().trim().min(32).max(60),
  feeClaimer: z.string().trim().min(32).max(60).optional(),
  leftoverReceiver: z.string().trim().min(32).max(60).optional(),
  // Clients choose a server-approved profile id, never a raw quote mint.
  profileId: z.enum(METEORA_QUOTE_PROFILE_IDS),
  // Only meaningful for the PreStocks-quoted profile.
  quoteSymbol: z.string().trim().min(1).max(24).optional(),
});

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
          "Meteora transaction preparation requires devnet or mainnet execution mode with SOLANA_RPC_URL configured.",
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
          "Authenticate a connected wallet before preparing a Meteora transaction.",
      },
      { status: 401 },
    );
  }

  const quota = await requireWalletQuota(session, "meteora.config.prepare");
  if (quota) return quota;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora request." },
      { status: 400 },
    );
  }

  try {
    const database = getDatabase();
    const [agent] = await database
      .select({ id: agents.id, mode: agents.mode, cluster: agents.cluster })
      .from(agents)
      .where(
        and(eq(agents.id, parsed.data.agentId), eq(agents.ownerId, session.userId)),
      )
      .limit(1);
    if (!agent) {
      return NextResponse.json(
        { error: "Meteora preparation agent was not found for this wallet." },
        { status: 404 },
      );
    }
    if (agent.mode !== env.executionMode || agent.cluster !== env.cluster) {
      return NextResponse.json(
        { error: "Meteora preparation agent does not match the active environment." },
        { status: 409 },
      );
    }
    const needsCatalogue =
      getMeteoraQuoteProfile(parsed.data.profileId).quoteSource === "prestocks";
    const catalogue = needsCatalogue
      ? await getPreStocksCatalogue().catch(() => null)
      : null;
    const quote = resolveMeteoraQuoteProfile({
      profileId: parsed.data.profileId,
      cluster: env.cluster,
      quoteSymbol: parsed.data.quoteSymbol,
      prestocksCatalogue: catalogue?.assets ?? null,
    });
    const prepared =
      await createServerMeteoraDbcClient().prepareCreateConfigTransaction({
        config: parsed.data.config,
        payer: session.wallet,
        feeClaimer: parsed.data.feeClaimer,
        leftoverReceiver: parsed.data.leftoverReceiver,
        quote,
      });
    const [intent] = await database
      .insert(executionIntents)
      .values({
        kind: "meteora.config",
        agentId: agent.id,
        ownerWallet: session.wallet,
        cluster: env.cluster,
        feePayer: prepared.feePayer,
        messageSha256: prepared.messageSha256,
        requiredSigners: prepared.requiredSigners,
        accountsSummary: {
          accounts: prepared.accounts,
          review: prepared.review,
          quote: prepared.quote,
        },
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
    return NextResponse.json(
      {
        error: meteoraPublicErrorMessage(
          error,
          "Meteora config transaction could not be prepared.",
        ),
      },
      {
        status: error instanceof MeteoraQuoteProfileError ? error.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
