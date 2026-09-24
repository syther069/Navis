import "@workspace/navis-core/server/only";

import { env } from "@workspace/navis-core/lib/env";
import {
  prestocksCatalogueSchema,
  type PreStocksAsset,
} from "@workspace/navis-core/lib/integrations/prestocks/schemas";

export type PreStocksCatalogue = Readonly<{
  assets: PreStocksAsset[];
  sourceUrl: string;
  /** Successful fetch time, not a provider price observation timestamp (unavailable). */
  capturedAt: string;
}>;

export async function getPreStocksCatalogue(
  fetcher: typeof fetch = fetch,
): Promise<PreStocksCatalogue> {
  const response = await fetcher(env.prestocksApiUrl, {
    headers: { Accept: "application/json" },
    // Never re-stamp a stale Next.js cache entry as fresh research data.
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`PreStocks catalogue returned HTTP ${response.status}.`);
  }

  const payload = prestocksCatalogueSchema.parse(await response.json());

  return {
    assets: payload,
    sourceUrl: env.prestocksApiUrl,
    capturedAt: new Date().toISOString(),
  };
}
