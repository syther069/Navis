import {
  IntegrationStatusBadge,
  type IntegrationStatus,
} from "@/components/shared/integration-status-badge";
import {
  Coins,
  Cpu,
  Database,
  Eye,
  Fingerprint,
  Link as LinkIcon,
  ShieldCheck,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";

export type IntegrationItem = {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  description: string;
  executionBoundary: string;
  evidenceSource: string;
  icon: typeof Coins;
};

export const REAL_INTEGRATIONS: readonly IntegrationItem[] = [
  {
    id: "wallet-standard",
    name: "Solana Wallet Standard",
    category: "Authorization",
    status: "LIVE",
    description:
      "Universal wallet connector supporting Phantom, Solflare, and Standard-compatible wallets. Provides non-custodial cryptographic transaction signing.",
    executionBoundary: "NAVIS never stores, accesses, or generates private keys.",
    evidenceSource: "Browser Wallet Adapter ed25519 signatures",
    icon: Wallet,
  },
  {
    id: "proof-verifier",
    name: "Cryptographic Proof Verifier",
    category: "Evidence",
    status: "LIVE",
    description:
      "Client-side SHA-256 canonical receipt hashing. Recomputes document hashes directly in your browser without trusting NAVIS server reports.",
    evidenceSource: "Local browser Web Crypto API / SHA-256",
    executionBoundary: "Independent proof of internal document consistency.",
    icon: Fingerprint,
  },
  {
    id: "solana-rpc",
    name: "Solana RPC Network",
    category: "Chain Settlement",
    status: "DEVNET",
    description:
      "Direct JSON-RPC connection to Solana cluster for slot height querying, balance reconciliation, and transaction simulation before signing.",
    executionBoundary: "Devnet cluster enabled; mainnet execution is strictly gated.",
    evidenceSource: "Solana Core RPC getLatestBlockhash & simulateTransaction",
    icon: Database,
  },
  {
    id: "meteora",
    name: "Meteora DBC & DLMM SDK",
    category: "Liquidity Protocols",
    status: "PREPARATION ONLY",
    description:
      "Dynamic Bonding Curve (DBC) and DLMM SDK integration to prepare liquidity pool configurations, price quotes, and swap instructions.",
    executionBoundary: "Prepares transaction payloads only; cannot broadcast without user wallet signature.",
    evidenceSource: "Official Meteora TypeScript SDK v1",
    icon: Coins,
  },
  {
    id: "prestocks",
    name: "PreStocks Equity Catalogue",
    category: "Market Data",
    status: "READ-ONLY",
    description:
      "Research and price discovery catalogue for tokenized equities (Demo EQA, EQB, EQC). Provides asset profiles, contract addresses, and reference values.",
    executionBoundary: "Strictly read-only catalogue. NAVIS does not issue equities.",
    evidenceSource: "PreStocks REST API /api/prestocks",
    icon: Eye,
  },
  {
    id: "clawpump",
    name: "ClawPump Partner API",
    category: "Agent Services",
    status: "CONNECTED",
    description:
      "Partner integration for agent registration, creator wallet allocation, and token launch pair metadata through clawpump.tech/api/v1.",
    executionBoundary: "Agent creator wallets are distinct from connected user wallets.",
    evidenceSource: "Verified Partner API key (cpk_ token prefix)",
    icon: LinkIcon,
  },
  {
    id: "atlas-ai",
    name: "Atlas Decision Engine (AI)",
    category: "Agent Intelligence",
    status: "SIMULATION",
    description:
      "Analytical mandate evaluator. Evaluates portfolio balance snapshots and investment thesis to propose rebalance trades.",
    executionBoundary: "Zero execution privileges. Proposes only; policy engine must approve.",
    evidenceSource: "Deterministic Demo Fixture & OpenAI API adapter",
    icon: Cpu,
  },
  {
    id: "pyth",
    name: "Pyth Network Oracles",
    category: "Oracle Feeds",
    status: "PLANNED",
    description:
      "Direct onchain Pyth oracle price account ingestion for sub-second real-world asset price feeds and confidence intervals.",
    executionBoundary: "Not currently active. Current quotes use PreStocks catalogue and snapshot feeds.",
    evidenceSource: "Roadmap: Pyth Solana receiver program",
    icon: ShieldCheck,
  },
] as const;

export function IntegrationsGrid() {
  return (
    <div className="integrations-container" aria-label="Real integrations and status">
      <div className="integrations-grid">
        {REAL_INTEGRATIONS.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.id}
              className={`route-panel integration-card integration-card-${item.status
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              <header className="integration-card-header">
                <div className="integration-icon-wrap" aria-hidden="true">
                  <Icon size={20} />
                </div>
                <div className="integration-title-group">
                  <span className="route-eyebrow">{item.category}</span>
                  <h3 className="integration-name">{item.name}</h3>
                </div>
                <IntegrationStatusBadge status={item.status} />
              </header>

              <p className="integration-desc">{item.description}</p>

              <div className="integration-boundary-box">
                <span className="boundary-label">Execution Boundary:</span>
                <span className="boundary-text">{item.executionBoundary}</span>
              </div>

              <footer className="integration-card-footer">
                <span className="source-label">Source / Implementation:</span>
                <code className="source-code">{item.evidenceSource}</code>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
