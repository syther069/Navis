import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { env } from "@/lib/env";
import { createClawPumpClient } from "@/lib/integrations/clawpump/server";
import { createPersistentAgent } from "@/lib/services/agents";
import { linkClawPumpAgent } from "@/lib/services/clawpump-agents";

const requestSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    objective: z.string().trim().min(20).max(600),
    maxTradeBps: z.number().int().min(1).max(10_000),
    maxPositionBps: z.number().int().min(1).max(10_000),
    minReserveBps: z.number().int().min(0).max(10_000),
    maxSlippageBps: z.number().int().min(1).max(2_000),
    linkClawPump: z.boolean().default(false),
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
  if (!env.databaseUrl) {
    return NextResponse.json(
      { error: "Persistent storage is not configured." },
      { status: 503 },
    );
  }
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
  const assets = [...demoAgentBundle.assets];
  const mints = assets.map((asset) => asset.mint);
  const database = getDatabase();

  try {
    const bundle = await createPersistentAgent(
      {
        slug: slugify(input.name),
        name: input.name,
        ownerWallet: session.wallet,
        mode: "demo",
        cluster: "devnet",
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
      },
      database,
    );

    let link:
      | { status: "not_requested" }
      | { status: "linked"; externalAgentId: string; wallet: string; requestId: string }
      | { status: "failed"; error: string } = { status: "not_requested" };

    if (input.linkClawPump) {
      if (!env.clawpumpApiKey) {
        link = { status: "failed", error: "ClawPump is not configured." };
      } else {
        try {
          const linked = await linkClawPumpAgent(
            bundle.agent.id,
            createClawPumpClient(),
            database,
          );
          link = {
            status: "linked",
            externalAgentId: linked.externalAgentId,
            wallet: linked.externalWallet,
            requestId: linked.requestId,
          };
        } catch (error) {
          link = {
            status: "failed",
            error:
              error instanceof Error ? error.message : "ClawPump agent linking failed.",
          };
        }
      }
    }

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
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent creation failed." },
      { status: 400 },
    );
  }
}
