import { NextRequest } from '@workspace/navis-core/server/http';
import { eq } from "drizzle-orm";
import { env } from "@workspace/navis-core/lib/env";
import { readSessionToken, SESSION_COOKIE_NAME } from "@workspace/navis-core/lib/auth/server";
import { getDatabase } from "@workspace/navis-core/lib/db/client";
import { agents } from "@workspace/navis-core/lib/db/schema";
import {
  buildPairCatalogueView,
  readTokenPrograms,
  type PairCatalogueView,
} from "@workspace/navis-core/lib/integrations/clawpump/pairs";
import {
  createClawPumpClient,
  loadClawPumpPreflightDependencies,
} from "@workspace/navis-core/lib/integrations/clawpump/server";
import { deriveClawPumpStates } from "@workspace/navis-core/lib/integrations/clawpump/state";
import {
  getClawPumpIdentity,
  type ClawPumpIdentityView,
} from "@workspace/navis-core/lib/services/clawpump-agents";
import {
  ensureClawPumpVerification,
  type ClawPumpVerificationRecord,
} from "@workspace/navis-core/lib/services/clawpump-verification";
import {
  getLatestLaunchPreflightForOwner,
  getStoredClawPumpLaunchForOwner,
  type LaunchPreflightResult,
} from "@workspace/navis-core/lib/services/launch-preflight";
import { getNavisMeteoraCurvePreviews } from "@workspace/navis-core/lib/integrations/meteora/config";
import {
  isMeteoraBroadcastAvailable,
  meteoraBroadcastUnavailableReason,
} from "@workspace/navis-core/lib/integrations/meteora/broadcast-safety";
import { listMeteoraQuoteProfileAvailability } from "@workspace/navis-core/lib/integrations/meteora/quote-profiles";
import { getPreStocksCatalogue } from "@workspace/navis-core/lib/integrations/prestocks/client";
import {
  orderByPremiumSignal,
  researchRow,
} from "@workspace/navis-core/lib/integrations/prestocks/research";
type PairState =
  | { status: "not_configured" }
  | { status: "unavailable"; message: string }
  | { status: "available"; catalogue: PairCatalogueView; prestocksSource: string };

type ClawPumpState = Readonly<{
  configured: boolean;
  verification: ClawPumpVerificationRecord | null;
  pairs: PairState;
}>;

/** Reuse a stored verification younger than this before calling the provider again. */
const VERIFICATION_MAX_AGE_MS = 10 * 60 * 1_000;

export async function loadClawPump(): Promise<ClawPumpState> {
  if (!env.clawpumpApiKey) {
    return {
      configured: false,
      verification: null,
      pairs: { status: "not_configured" },
    };
  }
  const client = createClawPumpClient();
  const database = env.databaseUrl ? getDatabase() : null;

  const [verification, pairs] = await Promise.all([
    ensureClawPumpVerification({
      client,
      database,
      maxAgeMs: VERIFICATION_MAX_AGE_MS,
    }).catch(() => null),
    loadPairs(client),
  ]);
  return { configured: true, verification, pairs };
}

async function loadPairs(
  client: ReturnType<typeof createClawPumpClient>,
): Promise<PairState> {
  try {
    const [pairs, dependencies] = await Promise.all([
      client.getPumpPairs(),
      loadClawPumpPreflightDependencies(),
    ]);
    const tokenPrograms = await readTokenPrograms(
      pairs.assets.map((asset) => asset.mint),
      dependencies.mainnetRpc,
    );
    return {
      status: "available",
      catalogue: buildPairCatalogueView({
        pairs,
        prestocks: dependencies.prestocksMints,
        tokenPrograms,
        tokenProgramSource: dependencies.mainnetRpcSource,
      }),
      prestocksSource: dependencies.prestocksSource,
    };
  } catch {
    return {
      status: "unavailable",
      message:
        "ClawPump pair discovery failed. No provider response details or credentials are exposed.",
    };
  }
}

type PreStocksState =
  | { status: "available"; data: Awaited<ReturnType<typeof getPreStocksCatalogue>> }
  | { status: "unavailable"; message: string };

export async function loadPreStocks(): Promise<PreStocksState> {
  try {
    return { status: "available", data: await getPreStocksCatalogue() };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    return {
      status: "unavailable",
      message:
        detail && !detail.toLowerCase().includes("fetch failed")
          ? detail
          : "PreStocks catalogue is temporarily unavailable.",
    };
  }
}

type LaunchContext = Readonly<{
  wallet: string | null;
  userId: string | null;
  clawpumpAgents: readonly { id: string; name: string; externalAgentId: string }[];
  identities: readonly ClawPumpIdentityView[];
  unlinkedAgents: readonly { slug: string; name: string }[];
  latestPreflight: LaunchPreflightResult | null;
  latestPreflightOutcome: "quoted" | "rejected" | null;
  storedLaunch: {
    transactionSignature: string | null;
    verifiedOnchain: boolean;
  } | null;
  meteoraAgents: readonly { id: string; name: string; mode: string; cluster: string }[];
}>;

const EMPTY_CONTEXT: LaunchContext = {
  wallet: null,
  userId: null,
  clawpumpAgents: [],
  identities: [],
  unlinkedAgents: [],
  latestPreflight: null,
  latestPreflightOutcome: null,
  storedLaunch: null,
  meteoraAgents: [],
};

/** Live identity refreshes per page load; the client also caps concurrency. */
const IDENTITY_REFRESH_LIMIT = 5;

export async function loadLaunchContext(request: NextRequest): Promise<LaunchContext> {
  if (!env.databaseUrl || !env.sessionSecret) return EMPTY_CONTEXT;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) return EMPTY_CONTEXT;

  const database = getDatabase();
  const ownedAgents = await database
    .select({
      id: agents.id,
      slug: agents.slug,
      name: agents.name,
      mode: agents.mode,
      cluster: agents.cluster,
      integrationStatus: agents.integrationStatus,
      externalAgentId: agents.externalAgentId,
      externalWallet: agents.externalWallet,
      externalRequestId: agents.externalRequestId,
      isPublicDemo: agents.isPublicDemo,
    })
    .from(agents)
    .where(eq(agents.ownerId, session.userId));

  const linked = ownedAgents.filter(
    (agent) => agent.integrationStatus === "linked" && agent.externalAgentId,
  );
  const client = env.clawpumpApiKey ? createClawPumpClient() : null;
  const identities = await Promise.all(
    linked
      .slice(0, IDENTITY_REFRESH_LIMIT)
      .map((agent) => getClawPumpIdentity(agent, client)),
  );
  const [latest, storedLaunch] = await Promise.all([
    getLatestLaunchPreflightForOwner(database, session.userId).catch(() => null),
    getStoredClawPumpLaunchForOwner(database, session.userId).catch(() => null),
  ]);

  return {
    wallet: session.wallet,
    userId: session.userId,
    clawpumpAgents: linked.map((agent) => ({
      id: agent.id,
      name: agent.name,
      externalAgentId: agent.externalAgentId!,
    })),
    identities,
    unlinkedAgents: ownedAgents
      .filter((agent) => agent.integrationStatus !== "linked" && !agent.isPublicDemo)
      .map((agent) => ({ slug: agent.slug, name: agent.name })),
    latestPreflight: latest?.result ?? null,
    latestPreflightOutcome: latest?.outcome ?? null,
    storedLaunch,
    meteoraAgents: ownedAgents
      .filter(
        (agent) => agent.mode === env.executionMode && agent.cluster === env.cluster,
      )
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        mode: agent.mode,
        cluster: agent.cluster,
      })),
  };
}

