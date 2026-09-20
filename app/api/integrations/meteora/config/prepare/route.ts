import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";

const requestSchema = z.object({
  config: z.string().trim().min(32).max(60),
  feeClaimer: z.string().trim().min(32).max(60).optional(),
  leftoverReceiver: z.string().trim().min(32).max(60).optional(),
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

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora request." },
      { status: 400 },
    );
  }

  try {
    const prepared =
      await createServerMeteoraDbcClient().prepareCreateConfigTransaction({
        config: parsed.data.config,
        payer: session.wallet,
        feeClaimer: parsed.data.feeClaimer,
        leftoverReceiver: parsed.data.leftoverReceiver,
      });

    return NextResponse.json(prepared, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meteora config transaction could not be prepared.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
