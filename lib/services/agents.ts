import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";

import * as schema from "../db/schema";
import {
  agentSchema,
  assetSchema,
  executionModeSchema,
  riskPolicyDocumentSchema,
  solanaClusterSchema,
  solanaPublicKeySchema,
  strategyDocumentSchema,
  type Asset,
} from "../domain";
import type { AgentBundle } from "../db/repositories/types";
import { hashCanonical } from "../proofs/canonical";

const createAgentInputSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(60),
  ownerWallet: solanaPublicKeySchema,
  mode: executionModeSchema,
  cluster: solanaClusterSchema,
  strategy: strategyDocumentSchema,
  riskPolicy: riskPolicyDocumentSchema,
  assets: z.array(assetSchema).min(1).max(32),
});

export type CreatePersistentAgentInput = z.input<typeof createAgentInputSchema>;
type NavisDatabase = NodePgDatabase<typeof schema>;

export type PreparedAgentCreation = Readonly<{
  input: z.output<typeof createAgentInputSchema>;
  strategyHash: string;
  riskPolicyHash: string;
}>;

function sameMembers(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((member) => right.includes(member));
}

export function prepareAgentCreation(
  candidate: CreatePersistentAgentInput,
): PreparedAgentCreation {
  const input = createAgentInputSchema.parse(candidate);

  if (input.mode === "devnet" && input.cluster !== "devnet") {
    throw new Error("Devnet agents require the devnet cluster");
  }
  if (input.mode === "mainnet" && input.cluster !== "mainnet-beta") {
    throw new Error("Mainnet agents require the mainnet-beta cluster");
  }

  const assetsByMint = new Map(input.assets.map((asset) => [asset.mint, asset]));
  if (assetsByMint.size !== input.assets.length) {
    throw new Error("Agent assets must have unique mint identifiers");
  }
  if (input.strategy.universe.some((mint) => !assetsByMint.has(mint))) {
    throw new Error("Strategy universe contains an asset absent from the bundle");
  }
  if (input.assets.some((asset) => asset.cluster !== input.cluster)) {
    throw new Error("Every asset must use the agent cluster");
  }
  if (
    input.mode === "demo" &&
    input.strategy.universe.some((mint) => !mint.startsWith("demo_mint_"))
  ) {
    throw new Error("Demo agents may only use explicit demo_mint_* assets");
  }
  if (
    input.mode !== "demo" &&
    input.strategy.universe.some((mint) => mint.startsWith("demo_mint_"))
  ) {
    throw new Error("Onchain agents cannot use demo asset identifiers");
  }

  const allowlist = input.riskPolicy.constraints.find(
    (constraint) => constraint.type === "allowed_mints",
  );
  if (!allowlist || !sameMembers(allowlist.mints, input.strategy.universe)) {
    throw new Error("Strategy universe and risk-policy allowlist must match exactly");
  }

  return Object.freeze({
    input,
    strategyHash: hashCanonical(input.strategy),
    riskPolicyHash: hashCanonical(input.riskPolicy),
  });
}

export async function createPersistentAgent(
  candidate: CreatePersistentAgentInput,
  database?: NavisDatabase,
): Promise<AgentBundle> {
  const prepared = prepareAgentCreation(candidate);
  const db = database ?? (await import("../db/client")).getDatabase();

  return db.transaction(async (transaction) => {
    await transaction
      .insert(schema.users)
      .values({ wallet: prepared.input.ownerWallet })
      .onConflictDoNothing({ target: schema.users.wallet });

    const [owner] = await transaction
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.wallet, prepared.input.ownerWallet))
      .limit(1);
    if (!owner) throw new Error("Unable to resolve the authenticated owner");

    const [agentRow] = await transaction
      .insert(schema.agents)
      .values({
        ownerId: owner.id,
        ownerWallet: prepared.input.ownerWallet,
        slug: prepared.input.slug,
        name: prepared.input.name,
        status: "draft",
        mode: prepared.input.mode,
        cluster: prepared.input.cluster,
        activeStrategyVersion: 1,
        activeRiskPolicyVersion: 1,
        integrationStatus: "not_configured",
      })
      .returning();
    if (!agentRow) throw new Error("Agent creation returned no record");

    const persistedAssets: Asset[] = [];
    for (const asset of prepared.input.assets) {
      const [assetRow] = await transaction
        .insert(schema.assets)
        .values({
          mint: asset.mint,
          isDemo: asset.isDemo,
          cluster: asset.cluster,
          symbol: asset.symbol,
          name: asset.name,
          decimals: asset.decimals,
          issuer: asset.issuer,
          source: asset.source,
          sourceTimestamp: asset.sourceTimestamp
            ? new Date(asset.sourceTimestamp)
            : undefined,
          verificationState: asset.verificationState,
        })
        .onConflictDoUpdate({
          target: [schema.assets.cluster, schema.assets.mint],
          set: { updatedAt: new Date() },
        })
        .returning();
      if (!assetRow) throw new Error(`Asset persistence failed for ${asset.mint}`);

      const allowedActions = prepared.input.strategy.allowedActions.filter(
        (action): action is "BUY" | "SELL" | "HOLD" => action !== "REBALANCE",
      );
      if (allowedActions.length === 0) {
        throw new Error("At least one asset-level action is required");
      }
      await transaction.insert(schema.agentAssetPermissions).values({
        agentId: agentRow.id,
        assetId: assetRow.id,
        allowedActions,
      });
      persistedAssets.push(
        assetSchema.parse({
          ...asset,
          id: assetRow.id,
          sourceTimestamp: assetRow.sourceTimestamp?.toISOString(),
        }),
      );
    }

    const [strategyRow] = await transaction
      .insert(schema.strategyVersions)
      .values({
        agentId: agentRow.id,
        version: 1,
        hash: prepared.strategyHash,
        document: prepared.input.strategy,
      })
      .returning();
    const [riskPolicyRow] = await transaction
      .insert(schema.riskPolicyVersions)
      .values({
        agentId: agentRow.id,
        version: 1,
        hash: prepared.riskPolicyHash,
        document: prepared.input.riskPolicy,
      })
      .returning();
    if (!strategyRow || !riskPolicyRow) {
      throw new Error("Version persistence returned an incomplete record set");
    }

    return {
      agent: agentSchema.parse({
        id: agentRow.id,
        slug: agentRow.slug,
        name: agentRow.name,
        status: agentRow.status,
        mode: agentRow.mode,
        cluster: agentRow.cluster,
        ownerWallet: agentRow.ownerWallet ?? undefined,
        activeStrategyVersion: agentRow.activeStrategyVersion ?? undefined,
        activeRiskPolicyVersion: agentRow.activeRiskPolicyVersion ?? undefined,
        integrationStatus: agentRow.integrationStatus,
        createdAt: agentRow.createdAt.toISOString(),
        updatedAt: agentRow.updatedAt.toISOString(),
      }),
      strategy: {
        id: strategyRow.id,
        agentId: strategyRow.agentId,
        version: strategyRow.version,
        hash: strategyRow.hash,
        document: strategyRow.document,
        createdAt: strategyRow.createdAt.toISOString(),
      },
      riskPolicy: {
        id: riskPolicyRow.id,
        agentId: riskPolicyRow.agentId,
        version: riskPolicyRow.version,
        hash: riskPolicyRow.hash,
        document: riskPolicyRow.document,
        createdAt: riskPolicyRow.createdAt.toISOString(),
      },
      assets: persistedAssets,
    };
  });
}
