import { NextResponse } from "next/server";

import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { loadDecisionRun } from "@/lib/services/run-decision";

export async function GET(
  _request: Request,
  context: { params: Promise<{ decisionId: string }> },
) {
  const { decisionId } = await context.params;
  const inMemory = await loadDecisionRun({ decisionId });
  if (inMemory) {
    return NextResponse.json(inMemory, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!env.databaseUrl) {
    return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  }

  const token = _request.headers
    .get("cookie")
    ?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate a connected wallet to inspect this decision." },
      { status: 401 },
    );
  }
  const persisted = await loadDecisionRun({
    decisionId,
    database: getDatabase(),
    ownerWallet: session.wallet,
  });
  if (persisted) {
    return NextResponse.json(persisted, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return NextResponse.json({ error: "Decision not found." }, { status: 404 });
}
