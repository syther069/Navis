import { eq } from "drizzle-orm";
import { Coins } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { LaunchPreflightForm } from "@/components/markets/launch-preflight-form";
import { MeteoraCurvePanel } from "@/components/markets/meteora-curve-panel";
import {
  PreStocksCatalogue,
  PreStocksUnavailable,
} from "@/components/markets/prestocks/prestocks-catalogue";
import { RouteHeader } from "@/components/route-primitives";
import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import { env } from "@/lib/env";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { createClawPumpClient } from "@/lib/integrations/clawpump/server";
import { getNavisMeteoraCurvePreview } from "@/lib/integrations/meteora/config";
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

async function loadLaunchContext() {
  if (!env.databaseUrl || !env.sessionSecret) {
    return { wallet: null, clawpumpAgents: [], meteoraAgents: [] } as const;
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) return { wallet: null, clawpumpAgents: [], meteoraAgents: [] } as const;

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

  return { wallet: session.wallet, clawpumpAgents, meteoraAgents } as const;
}

export default async function MarketLaunchPage() {
  const [pairs, launchContext, prestocks] = await Promise.all([
    loadPairs(),
    loadLaunchContext(),
    loadPreStocks(),
  ]);
  const available = pairs.status === "available";
  const meteoraPreview = getNavisMeteoraCurvePreview(env.cluster);
  const meteoraTransactionBuilderEnabled =
    (env.executionMode === "devnet" &&
      env.enableDevnetExecution &&
      Boolean(env.solanaRpcUrl)) ||
    (env.executionMode === "mainnet" &&
      env.enableMainnetExecution &&
      Boolean(env.solanaRpcUrl));

  return (
    <>
      <RouteHeader
        eyebrow="ClawPump launch"
        title="Market launch preflight"
        description="Review pair discovery, payment, payout, and fee consequences before any launch authorization."
        meta={available ? `${pairs.data.assets.length} live pairs` : "Unavailable"}
      />
      <div className="route-grid">
        {available ? (
          <LaunchPreflightForm
            pairs={pairs.data.assets}
            creatorFeeBps={pairs.data.creatorFeeBps}
            agents={launchContext.clawpumpAgents}
            authenticatedWallet={launchContext.wallet}
          />
        ) : (
          <section className="route-panel">
            <div className="panel-heading">
              <Coins aria-hidden="true" size={20} />
              <div>
                <span>Preflight</span>
                <h2>No launch configured</h2>
              </div>
            </div>
            <p className="route-copy">
              Live pair discovery, an authenticated wallet, and a linked agent are
              required before Navis can request exact payment terms.
            </p>
            <button className="primary-button" type="button" disabled>
              Run preflight
            </button>
          </section>
        )}
        <aside className="route-panel route-panel-muted">
          <span className="route-eyebrow">Pair source</span>
          {available ? (
            <>
              <h2>Live catalogue received.</h2>
              <SourceStamp
                source="ClawPump /pump-pairs"
                timestamp={pairs.data.meta.timestamp}
              />
              <p>
                Request {pairs.data.meta.requestId}. Creator fee range{" "}
                {pairs.data.creatorFeeBps.min / 100}%–
                {pairs.data.creatorFeeBps.max / 100}%; default{" "}
                {pairs.data.creatorFeeBps.default / 100}%.
              </p>
            </>
          ) : (
            <>
              <h2>
                {pairs.status === "not_configured"
                  ? "Provider access is not configured."
                  : "Pair discovery is temporarily unavailable."}
              </h2>
              <p>
                {pairs.status === "unavailable"
                  ? pairs.message
                  : "Set the server-only ClawPump key to fetch exact mints, decimals, fee limits, and request evidence. No placeholder pair can be selected."}
              </p>
            </>
          )}
        </aside>
      </div>
      {available ? (
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
      ) : null}
      <MeteoraCurvePanel
        preview={meteoraPreview}
        rpcConfigured={Boolean(env.solanaRpcUrl)}
        executionEnabled={meteoraTransactionBuilderEnabled}
        agents={launchContext.meteoraAgents}
      />
      {prestocks.status === "available" ? (
        <PreStocksCatalogue catalogue={prestocks.data} />
      ) : (
        <PreStocksUnavailable message={prestocks.message} />
      )}
    </>
  );
}
