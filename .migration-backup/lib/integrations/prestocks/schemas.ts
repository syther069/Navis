import { z } from "zod";

export const prestocksAssetSchema = z.object({
  name: z.string().trim().min(1),
  symbol: z.string().trim().min(1).max(24),
  description: z.string().trim().min(1),
  image: z.url(),
  external_url: z.url(),
  contract_address: z
    .string()
    .trim()
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Expected a Solana mint address."),
  markPrice: z.number().nonnegative(),
  markValuation: z.number().nonnegative(),
  tokenPrice: z.number().nonnegative(),
  impliedValuation: z.number().nonnegative(),
  supply: z.number().nonnegative(),
});

export const prestocksCatalogueSchema = z.array(prestocksAssetSchema).min(1);

export type PreStocksAsset = z.infer<typeof prestocksAssetSchema>;
