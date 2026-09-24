import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "@workspace/navis-core/server/http";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@workspace/navis-core/lib/auth/request";
import { requireWalletQuota } from "@workspace/navis-core/lib/auth/operation-quota";
import { readSessionToken, SESSION_COOKIE_NAME } from "@workspace/navis-core/lib/auth/server";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import {
  classifyDatabaseError,
  DatabaseError,
  logDatabaseError,
} from "@workspace/navis-core/lib/db/errors";
import { demoAgentBundle } from "@workspace/navis-core/fixtures/demo-agent";
import { env } from "@workspace/navis-core/lib/env";
import {
  createPersistentAgentIdempotent,
  type CreatePersistentAgentInput,
  listPersistentAgentsForOwner,
  prepareAgentCreation,
} from "@workspace/navis-core/lib/services/agents";

const requestSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    objective: z.string().trim().min(20).max(600),
    maxTradeBps: z.number().int().min(1).max(10_000),
    maxPositionBps: z.number().int().min(1).max(10_000),
    minReserveBps: z.number().int().min(0).max(10_000),
    maxSlippageBps: z.number().int().min(1).max(2_000),
    linkClawPump: z.boolean().default(false),
    clientRequestId: z.string().trim().min(8).max(128).optional(),
  })
  .refine((value) => value.maxTradeBps <= value.maxPositionBps, {
    message: "Maximum trade cannot exceed maximum position.",
  });

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  return `${base || "agent"}-${randomUUID().slice(0, 8)}`;
}

function databaseFailure(scope: string, error: unknown) {
  const classified = classifyDatabaseError(error);
  logDatabaseError(scope, classified);
  return NextResponse.json(classified.toJSON(), {
    status: classified.status,
    headers: { "Cache-Control": "no-store" },
  });
}

function storageNotConfigured() {
  return NextResponse.json(new DatabaseError("database_not_configured").toJSON(), {
    status: 503,
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate a connected wallet to inspect persistent agents." },
      { status: 401 },
    );
  }
  if (!env.databaseUrl) return storageNotConfigured();

  try {
    const agents = await listPersistentAgentsForOwner(session.wallet, getDatabase());
    return NextResponse.json(
      { agents },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return databaseFailure("agents.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate a connected wallet before creating an agent." },
      { status: 401 },
    );
  }
  const quota = await requireWalletQuota(session, "agents.create");
  if (quota) return quota;
  if (!env.databaseUrl) return storageNotConfigured();
  if (env.executionMode !== "demo") {
    return NextResponse.json(
      { error: "This form uses demo assets and cannot create a live-mode agent." },
      { status: 409 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid agent request." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.linkClawPump) {
    // Linking is a separate owner action on the saved agent (POST
    // /api/agents/{slug}/clawpump-link) so a provider failure can never
    // interfere with local creation.
    return NextResponse.json(
      {
        error:
          "Create the local draft first, then link it to ClawPump from the agent page.",
      },
      { status: 409 },
    );
  }
  const assets = [...demoAgentBundle.assets];
  const mints = assets.map((asset) => asset.mint);
  const database = getDatabase();
  const candidate: CreatePersistentAgentInput = {
    slug: slugify(input.name),
    name: input.name,
    ownerWallet: session.wallet,
    mode: "demo",
    cluster: "devnet",
    clientRequestId: input.clientRequestId,
    assets,
    strategy: {
      objective: input.objective,
      horizon: "monthly",
      cadence: { kind: "manual" },
      universe: mints,
      signals: ["Deterministic demo relative-strength fixture"],
      allowedActions: ["BUY", "SELL", "HOLD", "REBALANCE"],
      riskPolicyVersion: 1,
    },
    riskPolicy: {
      constraints: [
        { type: "allowed_mints", mints },
        { type: "max_trade_bps", value: input.maxTradeBps },
        { type: "max_position_bps", value: input.maxPositionBps },
        { type: "min_reserve_bps", value: input.minReserveBps },
        { type: "max_slippage_bps", value: input.maxSlippageBps },
        { type: "max_daily_turnover_bps", value: 2_500 },
        { type: "cooldown_seconds", value: 3_600 },
        { type: "max_data_age_seconds", value: 300 },
        { type: "min_liquidity_usd_micros", value: "1000000000" },
        { type: "allowed_modes", modes: ["demo"] },
      ],
    },
  };

  // Mandate validation runs before any SQL. Only its message is safe to
  // return; everything thrown after this point is treated as storage.
  try {
    prepareAgentCreation(candidate);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid agent mandate.")
        : error instanceof Error
          ? error.message
          : "Agent creation failed.";
    return NextResponse.json(
      { error: message, code: "invalid_mandate" },
      { status: 400 },
    );
  }

  try {
    const { bundle, replayed } = await createPersistentAgentIdempotent(
      candidate,
      database,
    );

    const link = { status: "not_requested" } as const;

    return NextResponse.json(
      {
        agent: {
          id: bundle.agent.id,
          slug: bundle.agent.slug,
          name: bundle.agent.name,
          status: bundle.agent.status,
          strategyHash: bundle.strategy.hash,
          riskPolicyHash: bundle.riskPolicy.hash,
        },
        link,
        replayed,
      },
      { status: replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Never the raw message: Drizzle query errors carry SQL and parameters.
    return databaseFailure("agents.create", error);
  }
}
