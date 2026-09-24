import "@workspace/navis-core/server/only";

import { env } from "@workspace/navis-core/lib/env";

import { MeteoraDbcClient } from "./client";

export function createServerMeteoraDbcClient() {
  if (!env.solanaRpcUrl) {
    throw new Error("Solana RPC is not configured for Meteora reads.");
  }
  return new MeteoraDbcClient({
    cluster: env.cluster,
    endpoint: env.solanaRpcUrl,
    commitment: "confirmed",
  });
}
