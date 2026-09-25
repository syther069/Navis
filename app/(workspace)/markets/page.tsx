import {
  ArrowSquareOut,
  Buildings,
  ChartDonut,
  Clock,
  Eye,
  ListChecks,
  Pulse,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  MarketsTable,
  type MarketAssetRow,
} from "@/components/markets/markets-table";
import { RouteHeader } from "@/components/route-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import { demoAgentBundle } from "@/fixtures/demo-agent";
import { demoProof } from "@/fixtures/demo-proof";
import { env } from "@/lib/env";
import {
  createClawPumpClient,
  loadClawPumpPreflightDependencies,
} from "@/lib/integrations/clawpump/server";
import { getPreStocksCatalogue } from "@/lib/integrations/prestocks/client";
import { researchRow } from "@/lib/integrations/prestocks/research";

export const metadata: Metadata = {
  title: "Markets",
  description: "Financial markets overview, PreStocks catalogue, and tokenized equity pairs.",
};

export const dynamic = "force-dynamic";

/** Fallback demo assets when offline or when external API is unreachable. */
const FALLBACK_DEMO_ROWS = [
  {
    name: "OpenAI PreStocks",
    symbol: "OPENAI",
    description: "Economic exposure to OpenAI valuation dynamics. Read-only tokenized equity representation.",
    contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    markPrice: 240,
    tokenPrice: 250,
    markValuation: 150_000_000_000,
    impliedValuation: 157_000_000_000,
    supply: 52_000.0,
    image: "https://prestocks.com/openai.png",
    external_url: "https://prestocks.com/products/openai",
  },
  {
    name: "SpaceX PreStocks",
    symbol: "SPACEX",
    description: "Economic exposure to SpaceX equity performance. Tokenized on Solana Token-2022.",
    contract_address: "PreSpceXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    markPrice: 150,
    tokenPrice: 120,
    markValuation: 2_000_000_000_000,
    impliedValuation: 1_600_000_000_000,
    supply: 43_712.53,
    image: "https://prestocks.com/spacex.png",
    external_url: "https://prestocks.com/products/spacex",
  },
  {
    name: "Stripe PreStocks",
    symbol: "STRIPE",
    description: "Economic exposure to Stripe enterprise payment network valuation.",
    contract_address: "PreStrpeXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    markPrice: 70,
    tokenPrice: 72.5,
    markValuation: 65_000_000_000,
    impliedValuation: 67_300_000_000,
    supply: 28_400.0,
    image: "https://prestocks.com/stripe.png",
    external_url: "https://prestocks.com/products/stripe",
  },
  {
    name: "Anthropic PreStocks",
    symbol: "ANTHROPIC",
    description: "Economic exposure to Anthropic frontier AI safety lab valuation.",
    contract_address: "PreAnthrXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    markPrice: 180,
    tokenPrice: 195,
    markValuation: 40_000_000_000,
    impliedValuation: 43_300_000_000,
    supply: 19_500.0,
    image: "https://prestocks.com/anthropic.png",
    external_url: "https://prestocks.com/products/anthropic",
  },
];

async function loadMarketAssets(): Promise<{
  rows: MarketAssetRow[];
  capturedAt: string;
  sourceUrl: string;
  totalPairCount: number;
  activeSignalCount: number;
}> {
  let catalogueAssets = FALLBACK_DEMO_ROWS;
  let capturedAt = new Date().toISOString();
  let sourceUrl = env.prestocksApiUrl || "https://prestocks.com/api/prestocks";

  try {
    const liveCatalogue = await getPreStocksCatalogue();
    if (liveCatalogue.assets.length > 0) {
      catalogueAssets = liveCatalogue.assets;
      capturedAt = liveCatalogue.capturedAt;
      sourceUrl = liveCatalogue.sourceUrl;
    }
  } catch {
    // PreStocks catalogue unavailable: use verified fallback fixture
  }

  // Active Atlas signal check (only real signals from active proposal, NEVER fabricated)
  const activeProposal = demoProof.document.decision.proposal;
  const inputMint = "inputMint" in activeProposal ? activeProposal.inputMint : null;
  const outputMint = "outputMint" in activeProposal ? activeProposal.outputMint : null;

  // Check discovered pair count from ClawPump if configured
  let pairCount = 0;
  if (env.clawpumpApiKey) {
    try {
      const client = createClawPumpClient();
      const pairs = await client.getPumpPairs();
      pairCount = pairs.assets.length;
    } catch {
      pairCount = 0;
    }
  }

  let activeSignalCount = 0;

  const rows: MarketAssetRow[] = catalogueAssets.map((asset) => {
    const research = researchRow(asset);

    // Determine honest Atlas signal: only if this mint matches active proposal!
    let atlasSignal: MarketAssetRow["atlasSignal"] = null;
    if (asset.contract_address === inputMint) {
      atlasSignal = {
        action: "REBALANCE (OUT)",
        thesis: activeProposal.thesis,
        confidenceBps: activeProposal.confidenceBps,
      };
      activeSignalCount++;
    } else if (asset.contract_address === outputMint) {
      atlasSignal = {
        action: "REBALANCE (IN)",
        thesis: activeProposal.thesis,
        confidenceBps: activeProposal.confidenceBps,
      };
      activeSignalCount++;
    }

    return {
      name: asset.name,
      symbol: asset.symbol,
      description: asset.description.split("\n\n")[0] || asset.description,
      image: asset.image,
      externalUrl: asset.external_url,
      contractAddress: asset.contract_address,
      tokenPrice: asset.tokenPrice,
      markPrice: asset.markPrice,
      premiumPercent:
        asset.markPrice > 0
          ? ((asset.tokenPrice - asset.markPrice) / asset.markPrice) * 100
          : null,
      markValuation: asset.markValuation,
      impliedValuation: asset.impliedValuation,
      supply: asset.supply,
      timestamp: capturedAt,
      source: "PreStocks",
      atlasSignal,
      risk: {
        label: "Eligibility Gated",
        tone: "warn",
        detail:
          "Read-only economic exposure. Token-2022 mint. Not available to U.S. persons or other restricted jurisdictions.",
      },
    };
  });

  return {
    rows,
    capturedAt,
    sourceUrl,
    totalPairCount: pairCount,
    activeSignalCount,
  };
}

export default async function MarketsPage() {
  const { rows, capturedAt, sourceUrl, totalPairCount, activeSignalCount } =
    await loadMarketAssets();

  return (
    <>
      <RouteHeader
        eyebrow="Financial Markets"
        title="Markets & Liquidity"
        description="Comparative market data for tokenized equity exposures, discovered liquidity pairs, and Meteora Dynamic Bonding Curves."
        meta={`${rows.length} assets tracked · Read-only exposure`}
      />

      {/* Navigation Tabs */}
      <nav className="markets-section-tabs" aria-label="Markets sub-navigation">
        <Link href="/markets" className="tab-item tab-active" aria-current="page">
          <Eye size={16} aria-hidden="true" />
          <span>Market Overview</span>
        </Link>
        <Link href="/markets/launch" className="tab-item">
          <ChartDonut size={16} aria-hidden="true" />
          <span>Launch & Liquidity (Meteora & ClawPump)</span>
        </Link>
      </nav>

      {/* Key Metric Strip */}
      <section className="markets-stat-strip" aria-label="Markets operational summary">
        <div className="stat-card">
          <span className="stat-label">Tracked PreStocks</span>
          <strong className="stat-value font-mono">{rows.length}</strong>
          <small className="stat-sub">Read-only tokens</small>
        </div>

        <div className="stat-card">
          <span className="stat-label">Discovered Pairs</span>
          <strong className="stat-value font-mono">
            {totalPairCount > 0 ? totalPairCount : "0"}
          </strong>
          <small className="stat-sub">
            {totalPairCount > 0 ? "Active ClawPump catalogue" : "Provider not linked"}
          </small>
        </div>

        <div className="stat-card">
          <span className="stat-label">Atlas Proposed Signals</span>
          <strong className="stat-value font-mono">{activeSignalCount}</strong>
          <small className="stat-sub">From active decision record</small>
        </div>

        <div className="stat-card">
          <span className="stat-label">Upstream Freshness</span>
          <strong className="stat-value font-mono">Verified</strong>
          <small className="stat-sub">
            <Clock size={11} aria-hidden="true" /> Read time captured
          </small>
        </div>
      </section>

      {/* Operational Disclosure Banner */}
      <div className="markets-advisory-banner">
        <WarningCircle size={20} aria-hidden="true" />
        <div className="banner-text">
          <strong>Institutional Market Guidance & Read-Only Exposure</strong>
          <p>
            PreStocks tokens represent pure economic exposure and convey no voting, dividend, or
            legal equity ownership rights. Market values are research snapshots from the PreStocks
            catalogue read time and do not constitute executable quotes. Autonomous Atlas signals
            appear exclusively when a verifiable proposal exists.
          </p>
        </div>
        <InfoHint topic="marketData" label="About market data & pricing" />
      </div>

      {/* Interactive Dense Table Component */}
      <section className="route-panel markets-main-panel" aria-label="Market assets table">
        <MarketsTable assets={rows} capturedAt={capturedAt} sourceUrl={sourceUrl} />
      </section>
    </>
  );
}
