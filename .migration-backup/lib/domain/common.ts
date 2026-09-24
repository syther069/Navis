import { z } from "zod";

export const executionModeSchema = z.enum(["demo", "devnet", "mainnet"]);
export const solanaClusterSchema = z.enum(["devnet", "mainnet-beta"]);

export const solanaPublicKeySchema = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Must be a base58 Solana public key");

export const demoMintSchema = z.string().regex(/^demo_mint_[a-z0-9_]+$/);
export const assetIdentifierSchema = z.union([solanaPublicKeySchema, demoMintSchema]);

const stableEntityIdSchema = z
  .string()
  .min(3)
  .max(96)
  .regex(/^[a-z][a-z0-9_-]+$/, "Must be a stable lowercase identifier");

export const entityIdSchema = z.union([z.uuid(), stableEntityIdSchema]);

export const sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Must be a lowercase SHA-256 digest");

export const versionSchema = z.number().int().positive();
export const timestampSchema = z.string().datetime({ offset: true });

export type ExecutionMode = z.infer<typeof executionModeSchema>;
export type SolanaCluster = z.infer<typeof solanaClusterSchema>;
