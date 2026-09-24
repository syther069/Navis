import "@workspace/navis-core/server/only";

import { env } from "../../env";
import type { SolanaRpcConfig } from "./config";
import { SolanaRpcClient } from "./rpc";

export function getSolanaRpcConfig(): SolanaRpcConfig {
  return Object.freeze({
    cluster: env.cluster,
    endpoint: env.solanaRpcUrl,
    commitment: "finalized",
    timeoutMs: 5_000,
  });
}

export function createSolanaRpcClient() {
  return new SolanaRpcClient(getSolanaRpcConfig());
}

/**
 * Solana Labs public mainnet endpoint, used only for read-only account
 * lookups (mint owners, balances) when the configured cluster is not mainnet.
 * It is rate limited; callers batch reads and treat failures as unverified.
 */
export const PUBLIC_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

/**
 * Read-only mainnet client for provider checks that are mainnet by contract
 * (ClawPump pairs and quotes). Uses the configured RPC when it already points
 * at mainnet, otherwise the public endpoint. Reports where the reads came from
 * so the UI can say so.
 */
export function createMainnetReadRpcClient(): {
  client: SolanaRpcClient;
  source: string;
} {
  if (env.cluster === "mainnet-beta" && env.solanaRpcUrl) {
    return {
      client: new SolanaRpcClient({
        cluster: "mainnet-beta",
        endpoint: env.solanaRpcUrl,
        commitment: "confirmed",
        timeoutMs: 5_000,
      }),
      source: "configured mainnet RPC (SOLANA_RPC_URL)",
    };
  }
  return {
    client: new SolanaRpcClient({
      cluster: "mainnet-beta",
      endpoint: PUBLIC_MAINNET_RPC_URL,
      commitment: "confirmed",
      timeoutMs: 5_000,
    }),
    source: `public mainnet RPC (${PUBLIC_MAINNET_RPC_URL}), read-only`,
  };
}
