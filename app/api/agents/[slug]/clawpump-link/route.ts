import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { requireWalletQuota } from "@/lib/auth/operation-quota";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import {
  ClawPumpError,
  describeClawPumpError,
} from "@/lib/integrations/clawpump/client";
import { createClawPumpClient } from "@/lib/integrations/clawpump/server";
import { getPersistentAgentForOwner } from "@/lib/services/agents";
import {
  ClawPumpLinkRefused,
  getClawPumpIdentity,
  linkClawPumpAgent,
} from "@/lib/services/clawpump-agents";

const linkRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("create") }).strict(),
  z
    .object({
      mode: z.literal("attach"),
      externalAgentId: z.string().trim().min(1).max(160),
    })
    .strict(),
]);

const REFUSAL_STATUS: Record<ClawPumpLinkRefused["reason"], number> = {
  not_owned: 404,
  public_demo: 403,
  already_linked: 409,
  external_in_use: 409,
  external_not_owned_by_key: 403,
  external_wallet_mismatch: 403,
  no_strategy: 409,
  unconfirmed_create: 409,
};

async function resolveOwner(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return token ? await readSessionToken(token) : null;
}

/** Navis agent -> ClawPump identity -> wallet -> token chain, refreshed live. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const session = await resolveOwner(request);
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate the wallet first." },
      { status: 401 },
    );
  }
  const quota = await requireWalletQuota(session, "clawpump.identity");
  if (quota) return quota;
  if (!env.databaseUrl) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }
  const { slug } = await context.params;
  const bundle = await getPersistentAgentForOwner(slug, session.wallet, getDatabase());
  if (!bundle) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const identity = await getClawPumpIdentity(
    {
      id: bundle.agent.id,
      name: bundle.agent.name,
      slug: bundle.agent.slug,
      integrationStatus: bundle.agent.integrationStatus,
      externalAgentId: bundle.agent.externalAgentId ?? null,
      externalWallet: bundle.agent.externalWallet ?? null,
      externalRequestId: null,
    },
    env.clawpumpApiKey ? createClawPumpClient() : null,
  );
  return NextResponse.json(identity, { headers: { "Cache-Control": "no-store" } });
}

/** Owner-authenticated link of one persistent agent to a ClawPump identity. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }
  const session = await resolveOwner(request);
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate the wallet first." },
      { status: 401 },
    );
  }
  const quota = await requireWalletQuota(session, "clawpump.link");
  if (quota) return quota;
  if (!env.clawpumpApiKey) {
    return NextResponse.json(
      {
        error:
          "ClawPump is not configured. Set CLAWPUMP_API_KEY (a cpk_ Partner key) on the server.",
      },
      { status: 503 },
    );
  }
  if (!env.databaseUrl) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  }

  const parsed = linkRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid link request." }, { status: 400 });
  }

  const { slug } = await context.params;
  const database = getDatabase();
  const bundle = await getPersistentAgentForOwner(slug, session.wallet, database);
  if (!bundle) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  try {
    const link = await linkClawPumpAgent(bundle.agent.id, parsed.data, {
      userId: session.userId,
      userWallet: session.wallet,
      client: createClawPumpClient(),
      database,
    });
    return NextResponse.json(
      { status: "linked", link },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ClawPumpLinkRefused) {
      return NextResponse.json(
        { error: error.message, reason: error.reason },
        { status: REFUSAL_STATUS[error.reason] },
      );
    }
    if (error instanceof ClawPumpError) {
      return NextResponse.json(
        { error: describeClawPumpError(error), requestId: error.requestId },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "ClawPump link failed." }, { status: 500 });
  }
}
