import "@workspace/navis-core/server/only";

import { env } from "../../env";
import { getPreStocksCatalogue } from "../prestocks/client";
import { createMainnetReadRpcClient } from "../solana/server";
import { ClawPumpClient } from "./client";
import { indexPreStocksMints, type PreStocksMintIndex } from "./pairs";

export function createClawPumpClient() {
  if (!env.clawpumpApiKey) throw new Error("CLAWPUMP_API_KEY is not configured");
  return new ClawPumpClient({ apiKey: env.clawpumpApiKey });
}

/**
 * PreStocks mints used to recognise tokenized-stock quote assets. An
 * unavailable catalogue yields an empty index, which only makes the
 * classification stricter (nothing is confirmed as a stock).
 */
export async function loadPreStocksMintIndex(): Promise<{
  index: PreStocksMintIndex;
  source: string;
}> {
  try {
    const catalogue = await getPreStocksCatalogue();
    return {
      index: indexPreStocksMints(catalogue.assets),
      source: `PreStocks catalogue read at ${catalogue.capturedAt}`,
    };
  } catch {
    return { index: new Map(), source: "PreStocks catalogue unavailable" };
  }
}

/** Shared dependencies for pair annotation and the launch preflight. */
export async function loadClawPumpPreflightDependencies() {
  const [prestocks, mainnet] = await Promise.all([
    loadPreStocksMintIndex(),
    Promise.resolve(createMainnetReadRpcClient()),
  ]);
  return {
    prestocksMints: prestocks.index,
    prestocksSource: prestocks.source,
    mainnetRpc: mainnet.client,
    mainnetRpcSource: mainnet.source,
    appCluster: env.cluster,
    mainnetExecutionEnabled:
      env.executionMode === "mainnet" && env.enableMainnetExecution,
  };
}
