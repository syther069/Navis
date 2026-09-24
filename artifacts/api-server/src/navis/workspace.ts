import { NextRequest } from "@workspace/navis-core/server/http";
import { env, getPublicCapabilities } from "@workspace/navis-core/lib/env";
import { readSessionToken, SESSION_COOKIE_NAME } from "@workspace/navis-core/lib/auth/server";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import { classifyDatabaseError } from "@workspace/navis-core/lib/db/errors";
import { agents, decisions, executionAttempts, marketLaunches } from "@workspace/navis-core/lib/db/schema";
import { listPersistentAgentsForOwner, getPersistentAgentForOwner } from "@workspace/navis-core/lib/services/agents";
import { listDecisions, listProofs, loadProof, listDecisionsForOwner } from "@workspace/navis-core/lib/services/decision-records";
import { loadDecisionRun } from "@workspace/navis-core/lib/services/run-decision";
import { getClawPumpIdentity } from "@workspace/navis-core/lib/services/clawpump-agents";
import { getLatestClawPumpVerification } from "@workspace/navis-core/lib/services/clawpump-verification";
import { createClawPumpClient } from "@workspace/navis-core/lib/integrations/clawpump/server";
import { getNavisMeteoraCurvePreviews } from "@workspace/navis-core/lib/integrations/meteora/config";
import { listMeteoraQuoteProfileAvailability } from "@workspace/navis-core/lib/integrations/meteora/quote-profiles";
import { isMeteoraBroadcastAvailable, meteoraBroadcastUnavailableReason } from "@workspace/navis-core/lib/integrations/meteora/broadcast-safety";
import { demoAgentBundle } from "@workspace/navis-core/fixtures/demo-agent";
import { demoProof } from "@workspace/navis-core/fixtures/demo-proof";
import { desc, eq } from "drizzle-orm";
import { loadClawPump, loadPreStocks, loadLaunchContext } from "./markets";

const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Cookie" };
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, (_, value) => typeof value === "bigint" ? value.toString() : value), { status, headers });
}

/** Stable, credential-free storage errors for the read-only page-data contract. */
export function workspaceStorageErrorResponse(error: unknown): Response | null {
  const classified = classifyDatabaseError(error);
  if (classified.code === "database_error") return null;
  return json(classified.toJSON(), classified.status);
}

export async function workspace(request: NextRequest): Promise<Response> {
  try {
    return await loadWorkspace(request);
  } catch (error) {
    const response = workspaceStorageErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

async function loadWorkspace(request: NextRequest): Promise<Response> {
  const path = new URL(request.url).searchParams.get("path") ?? "/";
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token, { reportUnavailable: true }) : null;
  const base = { capabilities: getPublicCapabilities(), session };
  const database = env.databaseUrl ? getDatabase() : null;
  const scope = { ownerWallet: session?.wallet };
  if (["/", "/agents/new", "/disclosures"].includes(path)) return json(base);
  if (path === "/settings") {
    const record = database && env.clawpumpApiKey ? await getLatestClawPumpVerification(database) : null;
    return json({ ...base, clawpump: { configured: Boolean(env.clawpumpApiKey), verification: record } });
  }
  if (path === "/agents") return json({ ...base, ownedAgents: session && database ? await listPersistentAgentsForOwner(session.wallet, database) : [] });
  if (["/agents/atlas", "/agents/atlas/decisions/demo-decision", "/proofs/demo-proof"].includes(path)) {
    return json({ ...base, demo: true, source: "demo_fixture", demoAgentBundle, demoProof });
  }
  if (path === "/decisions") return json({ ...base, stored: database ? await listDecisions(scope, database) : [] });
  if (path === "/proofs") return json({ ...base, stored: database ? await listProofs(scope, database) : [] });
  const decision = path.match(/^\/decisions\/([^/]+)$/);
  if (decision) {
    const run = await loadDecisionRun({ decisionId: decision[1], ...(database ? { database, ...scope } : {}) });
    return run ? json({ ...base, run }) : json({ error: "Decision not found." }, 404);
  }
  const proof = path.match(/^\/proofs\/([^/]+)$/);
  if (proof) {
    const stored = database ? await loadProof(proof[1], scope, database) : null;
    return stored ? json({ ...base, stored }) : json({ error: "Proof not found." }, 404);
  }
  const agent = path.match(/^\/agents\/([^/]+)$/);
  if (agent) {
    if (!session) return json({ error: "Wallet authentication required." }, 401);
    if (!database) return json({ error: "Persistence unavailable." }, 503);
    const bundle = await getPersistentAgentForOwner(agent[1], session.wallet, database);
    if (!bundle) return json({ error: "Agent not found." }, 404);
    const storedDecisions = await listDecisionsForOwner(session.wallet, database, 25, bundle.agent.id);
    const clawpumpIdentity = await getClawPumpIdentity({
      id: bundle.agent.id, name: bundle.agent.name, slug: bundle.agent.slug,
      integrationStatus: bundle.agent.integrationStatus,
      externalAgentId: bundle.agent.externalAgentId ?? null,
      externalWallet: bundle.agent.externalWallet ?? null, externalRequestId: null,
    }, env.clawpumpApiKey ? createClawPumpClient() : null);
    return json({ ...base, bundle, storedDecisions, clawpumpIdentity });
  }
  if (path === "/transactions") {
    // Do not turn the former server-rendered ledger into a public private-record API.
    const executions = database && session ? await database.select({
      id: executionAttempts.id, state: executionAttempts.state, active: executionAttempts.active,
      cluster: executionAttempts.cluster, transactionSignature: executionAttempts.transactionSignature,
      submittedAt: executionAttempts.submittedAt, confirmedAt: executionAttempts.confirmedAt,
      slot: executionAttempts.slot, feeLamports: executionAttempts.feeLamports,
      errorCode: executionAttempts.errorCode, safeError: executionAttempts.safeError,
      createdAt: executionAttempts.createdAt, decisionHash: decisions.decisionHash,
      proposal: decisions.proposal, agentMode: agents.mode,
    }).from(executionAttempts).innerJoin(decisions, eq(decisions.id, executionAttempts.decisionId))
      .innerJoin(agents, eq(agents.id, decisions.agentId)).where(eq(agents.ownerId, session.userId))
      .orderBy(desc(executionAttempts.createdAt)).limit(25) : [];
    const launches = database && session ? await database.select({
      id: marketLaunches.id, provider: marketLaunches.provider, status: marketLaunches.status,
      cluster: marketLaunches.cluster, providerRequestId: marketLaunches.providerRequestId,
      baseMint: marketLaunches.baseMint, poolAddress: marketLaunches.poolAddress,
      transactionSignature: marketLaunches.transactionSignature, metadata: marketLaunches.metadata,
      createdAt: marketLaunches.createdAt, updatedAt: marketLaunches.updatedAt,
      agentName: agents.name, agentSlug: agents.slug,
    }).from(marketLaunches).innerJoin(agents, eq(agents.id, marketLaunches.agentId))
      .where(eq(agents.ownerId, session.userId)).orderBy(desc(marketLaunches.createdAt)).limit(25) : [];
    return json({ ...base, executions, launches, persistenceReady: Boolean(database) });
  }
  if (path === "/markets/launch") {
    const [clawpump, prestocks, launchContext] = await Promise.all([loadClawPump(), loadPreStocks(), loadLaunchContext(request)]);
    const broadcast = { executionMode: env.executionMode, cluster: env.cluster, devnetExecutionEnabled: env.enableDevnetExecution, solanaRpcConfigured: Boolean(env.solanaRpcUrl) };
    return json({ ...base, clawpump, prestocks, launchContext,
      previews: getNavisMeteoraCurvePreviews(env.cluster),
      profiles: listMeteoraQuoteProfileAvailability(env.cluster),
      broadcastAvailable: isMeteoraBroadcastAvailable(broadcast),
      broadcastBlockedReason: meteoraBroadcastUnavailableReason(broadcast),
    });
  }
  return json({ error: "Page not found." }, 404);
}