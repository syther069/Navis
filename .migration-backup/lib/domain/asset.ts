import { z } from "zod";

import {
  assetIdentifierSchema,
  entityIdSchema,
  solanaClusterSchema,
  timestampSchema,
} from "./common";

export const assetVerificationStateSchema = z.enum([
  "unverified",
  "provider_verified",
  "onchain_verified",
  "blocked",
]);

export const assetSchema = z
  .object({
    id: entityIdSchema,
    mint: assetIdentifierSchema,
    isDemo: z.boolean(),
    cluster: solanaClusterSchema,
    symbol: z
      .string()
      .trim()
      .min(1)
      .max(12)
      .regex(/^[A-Z0-9.-]+$/),
    name: z.string().trim().min(1).max(80),
    decimals: z.number().int().min(0).max(18),
    issuer: z.string().trim().min(1).max(120).optional(),
    source: z.string().trim().min(1).max(120),
    sourceTimestamp: timestampSchema.optional(),
    verificationState: assetVerificationStateSchema,
  })
  .superRefine((asset, context) => {
    const hasDemoMint = asset.mint.startsWith("demo_mint_");
    if (asset.isDemo !== hasDemoMint) {
      context.addIssue({
        code: "custom",
        message:
          "Demo assets require explicit demo_mint_* identifiers; live assets require Solana public keys",
        path: ["mint"],
      });
    }
  });

export const agentAssetPermissionSchema = z
  .object({
    agentId: entityIdSchema,
    assetId: entityIdSchema,
    allowedActions: z.array(z.enum(["BUY", "SELL", "HOLD"])).min(1),
    maxExposureBpsOverride: z.number().int().min(1).max(10_000).optional(),
  })
  .refine(
    (value) => new Set(value.allowedActions).size === value.allowedActions.length,
    {
      message: "Allowed actions must be unique",
      path: ["allowedActions"],
    },
  );

export type Asset = z.infer<typeof assetSchema>;
export type AgentAssetPermission = z.infer<typeof agentAssetPermissionSchema>;
