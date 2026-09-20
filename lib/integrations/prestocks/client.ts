import "server-only";

import { env } from "@/lib/env";
import {
  prestocksCatalogueSchema,
  type PreStocksAsset,
} from "@/lib/integrations/prestocks/schemas";

export type PreStocksCatalogue = Readonly<{
  assets: PreStocksAsset[];
  sourceUrl: string;
  capturedAt: string;
}>;

export async function getPreStocksCatalogue(
  fetcher: typeof fetch = fetch,
): Promise<PreStocksCatalogue> {
  const response = await fetcher(env.prestocksApiUrl, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
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
