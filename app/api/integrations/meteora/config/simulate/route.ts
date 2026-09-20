import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { createServerMeteoraDbcClient } from "@/lib/integrations/meteora/server";

const requestSchema = z.object({
  serializedTransaction: z.string().trim().min(120).max(30_000),
  messageSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

function executionSimulationAvailable() {
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

  if (!executionSimulationAvailable()) {
    return NextResponse.json(
      {
        error:
          "Meteora transaction simulation requires devnet or mainnet execution mode with SOLANA_RPC_URL configured.",
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
          "Authenticate a connected wallet before simulating a Meteora transaction.",
      },
      { status: 401 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Meteora simulation." },
      { status: 400 },
    );
  }

  try {
    const simulation =
      await createServerMeteoraDbcClient().simulateSignedConfigTransaction({
        serializedTransaction: parsed.data.serializedTransaction,
        expectedMessageSha256: parsed.data.messageSha256,
        expectedPayer: session.wallet,
      });

    return NextResponse.json(simulation, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meteora config transaction could not be simulated.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
