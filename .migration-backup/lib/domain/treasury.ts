import { z } from "zod";

import {
  assetIdentifierSchema,
  entityIdSchema,
  sha256Schema,
  solanaClusterSchema,
  solanaPublicKeySchema,
  timestampSchema,
} from "./common";

const rawAmountSchema = z.string().regex(/^\d+$/);

export const snapshotBalanceSchema = z.object({
  kind: z.enum(["native", "spl-token"]),
  mint: assetIdentifierSchema.optional(),
  tokenAccount: solanaPublicKeySchema.optional(),
  rawAmount: rawAmountSchema,
  decimals: z.number().int().min(0).max(18),
  slot: rawAmountSchema,
  program: solanaPublicKeySchema.optional(),
});

export const assetValuationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("priced"),
    mint: assetIdentifierSchema,
    valueUsdMicros: rawAmountSchema,
    source: z.string().trim().min(1).max(120),
    observedAt: timestampSchema,
  }),
  z.object({
    status: z.literal("unpriced"),
    mint: assetIdentifierSchema,
    reason: z.string().trim().min(3).max(240),
  }),
]);

export const portfolioSnapshotDocumentSchema = z.object({
  agentId: entityIdSchema,
  owner: solanaPublicKeySchema,
  cluster: solanaClusterSchema,
  slot: rawAmountSchema,
  source: z.enum(["solana_rpc", "demo_fixture"]),
  capturedAt: timestampSchema,
  balances: z.array(snapshotBalanceSchema).min(1),
  valuations: z.array(assetValuationSchema),
});

export const portfolioSnapshotSchema = portfolioSnapshotDocumentSchema.extend({
  id: entityIdSchema,
  treasuryAccountId: entityIdSchema,
  contentHash: sha256Schema,
  createdAt: timestampSchema,
});

export type AssetValuation = z.infer<typeof assetValuationSchema>;
export type PortfolioSnapshotDocument = z.infer<typeof portfolioSnapshotDocumentSchema>;
export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;
