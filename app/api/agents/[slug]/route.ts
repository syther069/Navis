import { NextRequest, NextResponse } from "next/server";

import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import {
  classifyDatabaseError,
  DatabaseError,
  logDatabaseError,
} from "@/lib/db/errors";
import { env } from "@/lib/env";
import { getPersistentAgentForOwner } from "@/lib/services/agents";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) {
    return NextResponse.json(
      { error: "Authenticate a connected wallet to inspect persistent agents." },
      { status: 401 },
    );
  }
  if (!env.databaseUrl) {
    return NextResponse.json(new DatabaseError("database_not_configured").toJSON(), {
      status: 503,
    });
  }

  try {
    const { slug } = await context.params;
    const bundle = await getPersistentAgentForOwner(
      slug,
      session.wallet,
      getDatabase(),
    );
    if (!bundle) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    return NextResponse.json(
      { agent: bundle },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const classified = classifyDatabaseError(error);
    if (classified.code === "database_error" && !(error instanceof DatabaseError)) {
      // Malformed slug or wallet: nothing to look up.
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    logDatabaseError("agents.read", classified);
    return NextResponse.json(classified.toJSON(), {
      status: classified.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
