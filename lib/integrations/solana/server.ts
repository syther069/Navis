import "server-only";

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
