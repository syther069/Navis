import { eq } from "drizzle-orm";
import { Buildings, Coins, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { ClawPumpIdentityChain } from "@/components/markets/clawpump-identity-chain";
import { ClawPumpStateTrack } from "@/components/markets/clawpump-state-track";
import { ClawPumpVerificationCard } from "@/components/markets/clawpump-verification-card";
import {
  LaunchPreflightForm,
  type PreflightPairOption,
} from "@/components/markets/launch-preflight-form";
import { MeteoraCurvePanel } from "@/components/markets/meteora-curve-panel";
import {
  PreStocksCatalogue,
  PreStocksUnavailable,
} from "@/components/markets/prestocks/prestocks-catalogue";
import { PreStocksResearchView } from "@/components/markets/prestocks/prestocks-research";
import { SponsorPanelState } from "@/components/markets/sponsor-panel-state";
import { RouteHeader } from "@/components/route-primitives";
import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { env } from "@/lib/env";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import {
  buildPairCatalogueView,
  readTokenPrograms,
  type PairCatalogueView,
} from "@/lib/integrations/clawpump/pairs";
import {
  createClawPumpClient,
  loadClawPumpPreflightDependencies,
} from "@/lib/integrations/clawpump/server";
import { deriveClawPumpStates } from "@/lib/integrations/clawpump/state";
import {
  getClawPumpIdentity,
  type ClawPumpIdentityView,
} from "@/lib/services/clawpump-agents";
import {
  ensureClawPumpVerification,
  type ClawPumpVerificationRecord,
} from "@/lib/services/clawpump-verification";
import {
  getLatestLaunchPreflightForOwner,
  getStoredClawPumpLaunchForOwner,
  type LaunchPreflightResult,
} from "@/lib/services/launch-preflight";
import { getNavisMeteoraCurvePreviews } from "@/lib/integrations/meteora/config";
import { listMeteoraQuoteProfileAvailability } from "@/lib/integrations/meteora/quote-profiles";
import { getPreStocksCatalogue } from "@/lib/integrations/prestocks/client";
import {
  orderByPremiumSignal,
  researchRow,
} from "@/lib/integrations/prestocks/research";

export const metadata: Metadata = { title: "Market launch" };
export const dynamic = "force-dynamic";

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

async function loadClawPump(): Promise<ClawPumpState> {
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

async function loadPreStocks(): Promise<PreStocksState> {
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

async function loadLaunchContext(): Promise<LaunchContext> {
  if (!env.databaseUrl || !env.sessionSecret) return EMPTY_CONTEXT;

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
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

const CLAWPUMP_NOT_CONFIGURED =
  "Provider not configured. Set CLAWPUMP_API_KEY, a cpk_ Partner key from clawpump.tech/developers, server-side only. Without it no real request can be made, no pair can be listed and no preflight can run.";

function toPairOption(pair: PairCatalogueView["pairs"][number]): PreflightPairOption {
  return {
    mint: pair.mint,
    symbol: pair.symbol,
    name: pair.name,
    decimals: pair.decimals,
    classification: pair.classification,
    tokenProgram:
      pair.tokenProgram.status === "verified"
        ? pair.tokenProgram.program
        : "unverified",
    eligible: pair.eligibleForStockPreflight,
  };
}

async function ClawPumpSection({
  clawpumpPromise,
  contextPromise,
}: {
  clawpumpPromise: Promise<ClawPumpState>;
  contextPromise: Promise<LaunchContext>;
}) {
  const [clawpump, launchContext] = await Promise.all([
    clawpumpPromise,
    contextPromise,
  ]);

  if (!clawpump.configured) {
    return (
      <SponsorPanelState
        provider="ClawPump"
        icon={Coins}
        status="not_configured"
        title="Provider not configured."
        description={CLAWPUMP_NOT_CONFIGURED}
        headingId="clawpump-state-title"
      />
    );
  }

  const catalogue =
    clawpump.pairs.status === "available" ? clawpump.pairs.catalogue : null;
  const states = deriveClawPumpStates({
    configured: true,
    verified: clawpump.verification?.result === "connected",
    linkedAgentCount: launchContext.clawpumpAgents.length,
    stockPairCount: catalogue?.stockPairs.length ?? 0,
    latestPreflight: launchContext.latestPreflightOutcome
      ? { outcome: launchContext.latestPreflightOutcome }
      : null,
    launch: launchContext.storedLaunch,
  });

  return (
    <>
      <div className="route-grid">
        <section
          className="route-panel"
          aria-labelledby="clawpump-state-title"
          data-testid="clawpump-section"
        >
          <div className="panel-heading">
            <Coins aria-hidden="true" size={20} />
            <div>
              <span>ClawPump</span>
              <h2 id="clawpump-state-title">Provider integration state</h2>
            </div>
          </div>
          <ClawPumpStateTrack
            current={states.current}
            connection={states.connection}
            steps={states.steps}
          />
          <div className="clawpump-identities">
            <span className="route-eyebrow">Linked agents</span>
            {launchContext.identities.length > 0 ? (
              launchContext.identities.map((identity) => (
                <ClawPumpIdentityChain
                  key={identity.localAgentId}
                  identity={identity}
                />
              ))
            ) : launchContext.wallet ? (
              <p className="route-copy">
                No agent of this wallet is linked to a ClawPump identity.{" "}
                {launchContext.unlinkedAgents.length > 0 ? (
                  <>
                    Link one from its agent page:{" "}
                    {launchContext.unlinkedAgents.map((agent, index) => (
                      <span key={agent.slug}>
                        {index > 0 ? ", " : ""}
                        <Link href={`/agents/${agent.slug}`}>{agent.name}</Link>
                      </span>
                    ))}
                    .
                  </>
                ) : (
                  <>
                    <Link href="/agents/new">Create an agent</Link> first. Atlas is
                    never linked.
                  </>
                )}
              </p>
            ) : (
              <p className="route-copy">
                Authenticate a wallet to see and link its agents. Atlas is never linked.
              </p>
            )}
          </div>
        </section>
        <ClawPumpVerificationCard
          record={clawpump.verification}
          authenticated={Boolean(launchContext.wallet)}
        />
      </div>

      {clawpump.pairs.status === "unavailable" ? (
        <SponsorPanelState
          provider="ClawPump"
          icon={Coins}
          status="error"
          title="Pair discovery is temporarily unavailable."
          description={`${clawpump.pairs.message} Retry after the provider recovers; Navis does not cache or invent pairs.`}
          headingId="clawpump-pairs-title"
        />
      ) : null}

      {catalogue && catalogue.pairs.length === 0 ? (
        <SponsorPanelState
          provider="ClawPump"
          icon={Coins}
          status="empty"
          title="The provider returned no creation pairs."
          description={`Request ${catalogue.meta.requestId} at ${catalogue.meta.timestamp} succeeded but listed zero pairs, so no launch can be prepared.`}
          headingId="clawpump-pairs-title"
        />
      ) : null}

      {catalogue && catalogue.pairs.length > 0 ? (
        <>
          <section
            className="route-panel pair-catalogue"
            aria-labelledby="clawpump-pairs-title"
          >
            <div className="panel-heading">
              <Coins aria-hidden="true" size={20} />
              <div>
                <span>Provider catalogue</span>
                <h2 id="clawpump-pairs-title">Stock-paired creation pairs</h2>
              </div>
              <StatusBadge tone={catalogue.stockPairs.length > 0 ? "pass" : "neutral"}>
                {catalogue.stockPairs.length} stock pair
                {catalogue.stockPairs.length === 1 ? "" : "s"}
              </StatusBadge>
            </div>
            <SourceStamp
              source="ClawPump /pump-pairs"
              timestamp={catalogue.meta.timestamp}
            />
            <p className="route-copy">
              Request {catalogue.meta.requestId}. These are {catalogue.venue}; a Meteora
              DBC pool needs the launched base mint, so none is linked before a launch.
              Cluster: mainnet-beta by provider contract. Token programs read from{" "}
              {catalogue.tokenProgramSource}; stock classification from{" "}
              {clawpump.pairs.status === "available"
                ? clawpump.pairs.prestocksSource
                : ""}{" "}
              and from on-chain Token-2022 metadata whose URI host and update authority
              match a recognised tokenized-stock issuer (Backed xStocks, Backpack
              Securities). Symbols alone classify nothing. Creator fee range{" "}
              {catalogue.creatorFeeBps.min / 100}%–
              {catalogue.creatorFeeBps.max / 100}%; default{" "}
              {catalogue.creatorFeeBps.default / 100}%.
            </p>
            {catalogue.stockPairs.length === 0 ? (
              <p className="form-note" data-testid="clawpump-no-stock-pair">
                No qualifying stock pair: none of the listed quote assets is confirmed
                as a tokenized stock. The wrapped SOL pair and any stablecoin pair are
                not presented as stock pairs.
              </p>
            ) : null}
            <div className="pair-list">
              {catalogue.pairs.map((asset) => (
                <article
                  className="pair-card"
                  key={asset.mint}
                  data-classification={asset.classification}
                >
                  <div>
                    <strong>{asset.symbol}</strong>
                    <span>{asset.name}</span>
                    <span>{asset.classificationSource}</span>
                  </div>
                  <AddressValue value={asset.mint} label={`${asset.symbol} mint`} />
                  <span>
                    {asset.decimals} decimals ·{" "}
                    {asset.tokenProgram.status === "verified"
                      ? asset.tokenProgram.program
                      : "token program unverified"}{" "}
                    · {asset.cluster}
                    {asset.prestocks ? ` · PreStocks ${asset.prestocks.symbol}` : ""}
                    {asset.onchainMetadata
                      ? ` · on-chain "${asset.onchainMetadata.name}" (${asset.onchainMetadata.symbol})`
                      : ""}
                  </span>
                  <StatusBadge
                    tone={
                      asset.classification === "tokenized_stock"
                        ? "pass"
                        : asset.classification === "unclassified"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {asset.classification === "tokenized_stock"
                      ? "Tokenized stock"
                      : asset.classification === "wrapped_sol"
                        ? "Wrapped SOL pair"
                        : asset.classification === "stablecoin"
                          ? "Stablecoin"
                          : "Unconfirmed"}
                  </StatusBadge>
                </article>
              ))}
            </div>
          </section>
          <LaunchPreflightForm
            pairs={catalogue.pairs.map(toPairOption)}
            creatorFeeBps={catalogue.creatorFeeBps}
            agents={launchContext.clawpumpAgents}
            authenticatedWallet={launchContext.wallet}
            latest={launchContext.latestPreflight}
          />
        </>
      ) : null}
    </>
  );
}

async function MeteoraSection({
  prestocksPromise,
  contextPromise,
}: {
  prestocksPromise: Promise<PreStocksState>;
  contextPromise: Promise<LaunchContext>;
}) {
  const previews = getNavisMeteoraCurvePreviews(env.cluster);
  if (previews.length === 0) {
    return (
      <SponsorPanelState
        provider="Meteora DBC"
        icon={ShieldCheck}
        status="empty"
        title="No approved quote profile exists for this cluster."
        description={`Navis has no server-approved Meteora DBC quote profile for ${env.cluster}, so no curve preview, config preparation or pool monitor is offered here.`}
        headingId="meteora-state-title"
      />
    );
  }

  const [prestocks, launchContext] = await Promise.all([
    prestocksPromise,
    contextPromise,
  ]);
  const prestocksSymbols =
    prestocks.status === "available"
      ? prestocks.data.assets
          .filter((asset) => Boolean(asset.contract_address))
          .map((asset) => ({ symbol: asset.symbol, name: asset.name }))
      : [];
  const executionEnabled =
    (env.executionMode === "devnet" &&
      env.enableDevnetExecution &&
      Boolean(env.solanaRpcUrl)) ||
    (env.executionMode === "mainnet" &&
      env.enableMainnetExecution &&
      Boolean(env.solanaRpcUrl));

  return (
    <MeteoraCurvePanel
      previews={previews}
      profiles={listMeteoraQuoteProfileAvailability(env.cluster)}
      prestocksSymbols={prestocksSymbols}
      rpcConfigured={Boolean(env.solanaRpcUrl)}
      executionEnabled={executionEnabled}
      agents={launchContext.meteoraAgents}
    />
  );
}

async function PreStocksSection({
  prestocksPromise,
}: {
  prestocksPromise: Promise<PreStocksState>;
}) {
  const prestocks = await prestocksPromise;
  if (prestocks.status === "unavailable") {
    return <PreStocksUnavailable message={prestocks.message} />;
  }
  if (prestocks.data.assets.length === 0) {
    return (
      <SponsorPanelState
        provider="PreStocks catalogue"
        icon={Buildings}
        status="empty"
        title="The catalogue returned no assets."
        description={`The PreStocks read at ${prestocks.data.capturedAt} succeeded but listed zero assets. Navis will not substitute tickers or placeholder mints.`}
        headingId="prestocks-state-title"
      />
    );
  }
  return (
    <>
      <PreStocksCatalogue catalogue={prestocks.data} />
      <section className="route-panel prestocks-panel" aria-label="PreStocks research">
        <PreStocksResearchView
          research={orderByPremiumSignal(prestocks.data.assets.map(researchRow))}
          capturedAt={prestocks.data.capturedAt}
          sourceUrl={prestocks.data.sourceUrl}
        />
        <p className="route-copy">
          The Atlas demo run on <Link href="/agents/atlas">/agents/atlas</Link> can use
          this catalogue as its asset universe: the allowlist becomes these contract
          addresses, freshness is this read time, and the proposal rotates the richest
          premium into the deepest discount. The run result shows the allocation impact
          per asset. No PreStocks execution path exists.
        </p>
      </section>
    </>
  );
}

export default function MarketLaunchPage() {
  // Each sponsor surface resolves independently so a slow or failing provider
  // shows its own loading and error state instead of blanking the whole page.
  const clawpumpPromise = loadClawPump();
  const prestocksPromise = loadPreStocks();
  const contextPromise = loadLaunchContext();

  return (
    <>
      <RouteHeader
        eyebrow="Sponsor surfaces"
        title="Market launch preflight"
        description="Review pair discovery, payment, payout, and fee consequences before any launch authorization. ClawPump, Meteora DBC and PreStocks each report their own loading, empty or unavailable state."
        meta={env.clawpumpApiKey ? "ClawPump key present" : "ClawPump not configured"}
      />
      <Suspense
        fallback={
          <SponsorPanelState
            provider="ClawPump"
            icon={Coins}
            status="loading"
            title="Verifying provider and fetching creation pairs"
            description="Running a real authenticated read-only request and requesting the live pair catalogue from ClawPump."
            headingId="clawpump-state-title"
          />
        }
      >
        <ClawPumpSection
          clawpumpPromise={clawpumpPromise}
          contextPromise={contextPromise}
        />
      </Suspense>
      <Suspense
        fallback={
          <SponsorPanelState
            provider="Meteora DBC"
            icon={ShieldCheck}
            status="loading"
            title="Resolving bonding curve profile"
            description="Loading the server-approved quote profiles and the PreStocks symbols the config preparer can reference."
            headingId="meteora-state-title"
          />
        }
      >
        <MeteoraSection
          prestocksPromise={prestocksPromise}
          contextPromise={contextPromise}
        />
      </Suspense>
      <Suspense
        fallback={
          <SponsorPanelState
            provider="PreStocks catalogue"
            icon={Buildings}
            status="loading"
            title="Reading the PreStocks catalogue"
            description="Fetching the read-only economic-exposure token list from the provider."
            headingId="prestocks-state-title"
          />
        }
      >
        <PreStocksSection prestocksPromise={prestocksPromise} />
      </Suspense>
    </>
  );
}
