import { eq } from "drizzle-orm";
import { Buildings, Coins, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { LaunchPreflightForm } from "@/components/markets/launch-preflight-form";
import { MeteoraCurvePanel } from "@/components/markets/meteora-curve-panel";
import {
  PreStocksCatalogue,
  PreStocksUnavailable,
} from "@/components/markets/prestocks/prestocks-catalogue";
import { SponsorPanelState } from "@/components/markets/sponsor-panel-state";
import { RouteHeader } from "@/components/route-primitives";
import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { env } from "@/lib/env";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { createClawPumpClient } from "@/lib/integrations/clawpump/server";
import { getNavisMeteoraCurvePreviews } from "@/lib/integrations/meteora/config";
import { listMeteoraQuoteProfileAvailability } from "@/lib/integrations/meteora/quote-profiles";
import { getPreStocksCatalogue } from "@/lib/integrations/prestocks/client";

export const metadata: Metadata = { title: "Market launch" };
export const dynamic = "force-dynamic";

type PairState =
  | { status: "not_configured" }
  | { status: "unavailable"; message: string }
  | {
      status: "available";
      data: Awaited<
        ReturnType<ReturnType<typeof createClawPumpClient>["getPumpPairs"]>
      >;
    };

async function loadPairs(): Promise<PairState> {
  if (!env.clawpumpApiKey) return { status: "not_configured" };
  try {
    return { status: "available", data: await createClawPumpClient().getPumpPairs() };
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
  clawpumpAgents: readonly { id: string; name: string }[];
  meteoraAgents: readonly { id: string; name: string; mode: string; cluster: string }[];
}>;

async function loadLaunchContext(): Promise<LaunchContext> {
  if (!env.databaseUrl || !env.sessionSecret) {
    return { wallet: null, clawpumpAgents: [], meteoraAgents: [] };
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) return { wallet: null, clawpumpAgents: [], meteoraAgents: [] };

  const ownedAgents = await getDatabase()
    .select({
      id: agents.id,
      name: agents.name,
      mode: agents.mode,
      cluster: agents.cluster,
      integrationStatus: agents.integrationStatus,
    })
    .from(agents)
    .where(eq(agents.ownerId, session.userId));

  const clawpumpAgents = ownedAgents
    .filter((agent) => agent.integrationStatus === "linked")
    .map((agent) => ({ id: agent.id, name: agent.name }));
  const meteoraAgents = ownedAgents
    .filter(
      (agent) => agent.mode === env.executionMode && agent.cluster === env.cluster,
    )
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      mode: agent.mode,
      cluster: agent.cluster,
    }));

  return { wallet: session.wallet, clawpumpAgents, meteoraAgents };
}

const CLAWPUMP_NOT_CONFIGURED =
  "Set the server-only ClawPump key to fetch exact mints, decimals, fee limits, and request evidence. No placeholder pair can be selected and no preflight can run.";

async function ClawPumpSection({
  pairsPromise,
  contextPromise,
}: {
  pairsPromise: Promise<PairState>;
  contextPromise: Promise<LaunchContext>;
}) {
  const [pairs, launchContext] = await Promise.all([pairsPromise, contextPromise]);

  if (pairs.status === "not_configured") {
    return (
      <SponsorPanelState
        provider="ClawPump"
        icon={Coins}
        status="not_configured"
        title="Provider access is not configured."
        description={CLAWPUMP_NOT_CONFIGURED}
        headingId="clawpump-state-title"
      />
    );
  }

  if (pairs.status === "unavailable") {
    return (
      <SponsorPanelState
        provider="ClawPump"
        icon={Coins}
        status="error"
        title="Pair discovery is temporarily unavailable."
        description={`${pairs.message} Retry after the provider recovers; Navis does not cache or invent pairs.`}
        headingId="clawpump-state-title"
      />
    );
  }

  if (pairs.data.assets.length === 0) {
    return (
      <SponsorPanelState
        provider="ClawPump"
        icon={Coins}
        status="empty"
        title="The provider returned no creation pairs."
        description={`Request ${pairs.data.meta.requestId} at ${pairs.data.meta.timestamp} succeeded but listed zero pairs, so no launch can be prepared.`}
        headingId="clawpump-state-title"
      />
    );
  }

  return (
    <>
      <div className="route-grid">
        <LaunchPreflightForm
          pairs={pairs.data.assets}
          creatorFeeBps={pairs.data.creatorFeeBps}
          agents={launchContext.clawpumpAgents}
          authenticatedWallet={launchContext.wallet}
        />
        <aside className="route-panel route-panel-muted">
          <span className="route-eyebrow">Pair source</span>
          <h2>Live catalogue received.</h2>
          <SourceStamp
            source="ClawPump /pump-pairs"
            timestamp={pairs.data.meta.timestamp}
          />
          <p>
            Request {pairs.data.meta.requestId}. Creator fee range{" "}
            {pairs.data.creatorFeeBps.min / 100}%–{pairs.data.creatorFeeBps.max / 100}
            %; default {pairs.data.creatorFeeBps.default / 100}%.
          </p>
        </aside>
      </div>
      <section
        className="route-panel pair-catalogue"
        aria-labelledby="pair-catalogue-title"
      >
        <div className="panel-heading">
          <Coins aria-hidden="true" size={20} />
          <div>
            <span>Provider catalogue</span>
            <h2 id="pair-catalogue-title">ClawPump-supported creation pairs</h2>
          </div>
        </div>
        <div className="pair-list">
          {pairs.data.assets.map((asset) => (
            <article className="pair-card" key={asset.mint}>
              <div>
                <strong>{asset.symbol}</strong>
                <span>{asset.name}</span>
              </div>
              <AddressValue value={asset.mint} label={`${asset.symbol} mint`} />
              <span>{asset.decimals} decimals</span>
              <StatusBadge tone="active">Provider listed</StatusBadge>
            </article>
          ))}
        </div>
      </section>
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
  return <PreStocksCatalogue catalogue={prestocks.data} />;
}

export default function MarketLaunchPage() {
  // Each sponsor surface resolves independently so a slow or failing provider
  // shows its own loading and error state instead of blanking the whole page.
  const pairsPromise = loadPairs();
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
            title="Fetching creation pairs"
            description="Requesting the live pair catalogue and creator fee limits from ClawPump."
            headingId="clawpump-state-title"
          />
        }
      >
        <ClawPumpSection pairsPromise={pairsPromise} contextPromise={contextPromise} />
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
