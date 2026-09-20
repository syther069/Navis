import { NextResponse } from "next/server";
import { z } from "zod";

import { hasTrustedMutationOrigin } from "@/lib/auth/request";
import { allowMutationRequest } from "@/lib/auth/rate-limit";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { env } from "@/lib/env";
import {
  PersistentDecisionRunsNotEnabledError,
  runDecision,
} from "@/lib/services/run-decision";
import { demoAgentBundle } from "@/fixtures/demo-agent";

const requestSchema = z.object({
  agentSlug: z.string().min(2).max(48),
  scenario: z.enum(["balanced", "oversized"]),
});

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  }
  if (!allowMutationRequest(request)) {
    return NextResponse.json(
      { error: "Too many decision requests. Try again shortly." },
      { status: 429 },
    );
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "agentSlug and a valid scenario are required." },
      { status: 400 },
    );
  }

  try {
    if (!env.databaseUrl) {
      if (parsed.data.agentSlug !== "atlas") {
        return NextResponse.json({ error: "Agent not found." }, { status: 404 });
      }
      const result = await runDecision({
        bundle: demoAgentBundle,
        scenario: parsed.data.scenario,
      });
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const token = request.headers
      .get("cookie")
      ?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
    const session = token ? await readSessionToken(token) : null;
    if (!session) {
      return NextResponse.json(
        { error: "Authenticate a connected wallet to run this agent." },
        { status: 401 },
      );
    }
    throw new PersistentDecisionRunsNotEnabledError();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The decision run could not finish.",
      },
      {
        status: error instanceof PersistentDecisionRunsNotEnabledError ? 409 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
