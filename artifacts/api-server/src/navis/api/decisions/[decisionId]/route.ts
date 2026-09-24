import { NextResponse } from "@workspace/navis-core/server/http";

import { readSessionToken, SESSION_COOKIE_NAME } from "@workspace/navis-core/lib/auth/server";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import { env } from "@workspace/navis-core/lib/env";
import { loadDecisionRun } from "@workspace/navis-core/lib/services/run-decision";

export async function GET(
  request: Request,
  context: { params: Promise<{ decisionId: string }> },
) {
  const { decisionId } = await context.params;
  if (!env.databaseUrl) {
    // No database: only this process's own in-memory Atlas runs exist.
    const inMemory = await loadDecisionRun({ decisionId });
    if (inMemory) {
      return NextResponse.json(inMemory, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  }

  // Public Atlas records need no session; owner records need the owner's.
  const token = request.headers
    .get("cookie")
    ?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  const session = token ? await readSessionToken(token) : null;
  const persisted = await loadDecisionRun({
    decisionId,
    database: getDatabase(),
    ownerWallet: session?.wallet,
  });
  if (persisted) {
    return NextResponse.json(persisted, {
      headers: {
        "Cache-Control":
          persisted.persisted.visibility === "public"
            ? "no-store"
            : "private, no-store",
      },
    });
  }
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate a connected wallet to inspect this decision." },
      { status: 401 },
    );
  }
  return NextResponse.json({ error: "Decision not found." }, { status: 404 });
}
