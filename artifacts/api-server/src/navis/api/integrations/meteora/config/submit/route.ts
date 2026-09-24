import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "@workspace/navis-core/server/http";

import { requireWalletQuota } from "@workspace/navis-core/lib/auth/operation-quota";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@workspace/navis-core/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@workspace/navis-core/lib/auth/server";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import { executionIntents, marketLaunches } from "@workspace/navis-core/lib/db/schema";
import { env } from "@workspace/navis-core/lib/env";
import {
  isMeteoraBroadcastAvailable,
  meteoraBroadcastUnavailableReason,
  type MeteoraBroadcastCapability,
} from "@workspace/navis-core/lib/integrations/meteora/broadcast-safety";

function meteoraBroadcastCapability(): MeteoraBroadcastCapability {
  return {
    executionMode: env.executionMode,
    cluster: env.cluster,
    devnetExecutionEnabled: env.enableDevnetExecution,
    solanaRpcConfigured: Boolean(env.solanaRpcUrl),
  };
}
import {
  classifyMeteoraSendError,
  deriveTransactionSignature,
  isMeteoraIntentReplayable,
} from "@workspace/navis-core/lib/integrations/meteora/submit-lifecycle";
import { finalizeMeteoraSubmit } from "@workspace/navis-core/lib/services/meteora-submit";
import { createServerMeteoraDbcClient } from "@workspace/navis-core/lib/integrations/meteora/server";

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
  // The broadcast gate stays ahead of all execution code. It is released for
  // devnet only, and only when the audited capability flags all hold.
  const capability = meteoraBroadcastCapability();
  if (!isMeteoraBroadcastAvailable(capability)) {
    return NextResponse.json(
      { error: meteoraBroadcastUnavailableReason(capability) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!executionSubmissionAvailable()) {
    return NextResponse.json(
      { error: "Meteora transaction submission is not enabled." },
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
      { error: "Authenticate a connected wallet before submitting." },
      { status: 401 },
    );
  }
  const quota = await requireWalletQuota(session, "meteora.config.submit");
  if (quota) return quota;
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
      if (!intent || intent.kind !== "meteora.config") {
        return { error: "Execution intent was not found.", status: 404 } as const;
      }
      if (intent.ownerWallet !== session.wallet) {
        return {
          error: "Execution intent belongs to another wallet.",
          status: 403,
        } as const;
      }
      if (isMeteoraIntentReplayable(intent.status)) {
        const [launch] = await transaction
          .select()
          .from(marketLaunches)
          .where(eq(marketLaunches.idempotencyKey, `meteora-intent:${intent.id}`))
          .limit(1);
        return { existing: launch } as const;
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
        await transaction
          .update(executionIntents)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(executionIntents.id, intent.id));
        return {
          error: "Execution intent blockhash has expired.",
          status: 410,
        } as const;
      }
      let transactionSignature: string;
      try {
        const verified = client.parseVerifiedSignedTransaction({
          serializedTransaction: parsed.data.serializedTransaction,
          expectedMessageSha256: intent.messageSha256,
          expectedPayer: intent.feePayer,
        });
        transactionSignature = deriveTransactionSignature(verified.transaction);
      } catch {
        return {
          error: "Signed transaction does not match the prepared execution intent.",
          status: 400,
        } as const;
      }
      const accounts = intent.accountsSummary as {
        accounts?: { config?: string; quoteMint?: string };
        quote?: { profileId?: string; source?: string; symbol?: string };
      };
      const quoteMint = accounts.accounts?.quoteMint;
      if (!quoteMint || !accounts.quote?.profileId) {
        return {
          error:
            "Execution intent has no approved quote profile recorded; prepare it again.",
          status: 409,
        } as const;
      }
      // Record the signature before anything is sent. A timeout after send can
      // then never lose the tracking record.
      await transaction
        .update(executionIntents)
        .set({ status: "submitting", transactionSignature, updatedAt: new Date() })
        .where(eq(executionIntents.id, intent.id));
      const [launch] = await transaction
        .insert(marketLaunches)
        .values({
          agentId: intent.agentId!,
          provider: "meteora",
          idempotencyKey: `meteora-intent:${intent.id}`,
          cluster: intent.cluster,
          status: "submitting",
          transactionSignature,
          quoteMint,
          payoutWallet: intent.ownerWallet,
          metadata: {
            kind: "meteora.createConfig",
            config: accounts.accounts?.config,
            quoteProfileId: accounts.quote.profileId,
            quoteSource: accounts.quote.source,
            quoteSymbol: accounts.quote.symbol,
            intentId: intent.id,
            messageSha256: intent.messageSha256,
          },
        })
        .returning();
      return { intent, launch, transactionSignature } as const;
    });

    if ("error" in prepared) {
      return NextResponse.json(
        { error: prepared.error },
        { status: prepared.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if ("existing" in prepared) {
      if (!prepared.existing) {
        return NextResponse.json(
          { error: "Execution intent was consumed without a launch record." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { launch: prepared.existing },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const submitted = await client.submitSignedConfigTransaction({
        serializedTransaction: parsed.data.serializedTransaction,
        expectedMessageSha256: prepared.intent.messageSha256,
        expectedPayer: prepared.intent.feePayer,
      });
      if (submitted.transactionSignature !== prepared.transactionSignature) {
        throw new Error("RPC returned a different signature than the recorded one.");
      }
      const launch = await finalizeMeteoraSubmit(database, {
        launchId: prepared.launch.id,
        intentId: prepared.intent.id,
        fromLaunchStatus: "submitting",
        launchStatus: "submitted",
        intentStatus: "submitted",
        metadata: prepared.launch.metadata as Record<string, unknown>,
      });
      return NextResponse.json(
        { launch },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const outcome = classifyMeteoraSendError(error);
      const rejected = outcome.kind === "rejected_before_broadcast";
      const launch = await finalizeMeteoraSubmit(database, {
        launchId: prepared.launch.id,
        intentId: prepared.intent.id,
        fromLaunchStatus: "submitting",
        launchStatus: rejected ? "broadcast_failed" : "unknown_pending",
        intentStatus: rejected ? "failed" : "unknown_pending",
        metadata: {
          ...(prepared.launch.metadata as Record<string, unknown>),
          send: { outcome: outcome.kind, reason: outcome.reason },
        },
      });
      return NextResponse.json(
        {
          launch,
          error: rejected
            ? "The RPC rejected the Meteora transaction before broadcast. The attempt was recorded."
            : "Meteora broadcast outcome is unknown; the signature was recorded and can be reconciled.",
        },
        { status: rejected ? 502 : 202, headers: { "Cache-Control": "no-store" } },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Meteora submission could not be processed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
