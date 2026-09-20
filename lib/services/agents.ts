import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";

import * as schema from "../db/schema";
import {
  agentSchema,
  assetSchema,
  executionModeSchema,
  riskPolicyDocumentSchema,
  riskPolicyVersionSchema,
  solanaClusterSchema,
  solanaPublicKeySchema,
  strategyDocumentSchema,
  strategyVersionSchema,
  type Agent,
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

function parseAgentRow(row: typeof schema.agents.$inferSelect): Agent {
  return agentSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    mode: row.mode,
    cluster: row.cluster,
    ownerWallet: row.ownerWallet ?? undefined,
    activeStrategyVersion: row.activeStrategyVersion ?? undefined,
    activeRiskPolicyVersion: row.activeRiskPolicyVersion ?? undefined,
    integrationStatus: row.integrationStatus,
    externalAgentId: row.externalAgentId ?? undefined,
    externalWallet: row.externalWallet ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function listPersistentAgentsForOwner(
  ownerWallet: string,
  database?: NavisDatabase,
): Promise<readonly Agent[]> {
  const wallet = solanaPublicKeySchema.parse(ownerWallet);
  const db = database ?? (await import("../db/client")).getDatabase();
  const rows = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.ownerWallet, wallet))
    .orderBy(desc(schema.agents.createdAt));

  return rows.map(parseAgentRow);
}

export async function getPersistentAgentForOwner(
  slug: string,
  ownerWallet: string,
  database?: NavisDatabase,
): Promise<AgentBundle | null> {
  const parsedSlug = createAgentInputSchema.shape.slug.parse(slug);
  const wallet = solanaPublicKeySchema.parse(ownerWallet);
  const db = database ?? (await import("../db/client")).getDatabase();
  const [agentRow] = await db
    .select()
    .from(schema.agents)
    .where(
      and(eq(schema.agents.slug, parsedSlug), eq(schema.agents.ownerWallet, wallet)),
    )
    .limit(1);
  if (!agentRow) return null;

  const strategyVersion = agentRow.activeStrategyVersion ?? 1;
  const riskPolicyVersion = agentRow.activeRiskPolicyVersion ?? 1;
  const [strategyRows, riskPolicyRows, assetRows] = await Promise.all([
    db
      .select()
      .from(schema.strategyVersions)
      .where(
        and(
          eq(schema.strategyVersions.agentId, agentRow.id),
          eq(schema.strategyVersions.version, strategyVersion),
        ),
      )
      .limit(1),
    db
      .select()
      .from(schema.riskPolicyVersions)
      .where(
        and(
          eq(schema.riskPolicyVersions.agentId, agentRow.id),
          eq(schema.riskPolicyVersions.version, riskPolicyVersion),
        ),
      )
      .limit(1),
    db
      .select({ asset: schema.assets })
      .from(schema.agentAssetPermissions)
      .innerJoin(
        schema.assets,
        eq(schema.assets.id, schema.agentAssetPermissions.assetId),
      )
      .where(eq(schema.agentAssetPermissions.agentId, agentRow.id)),
  ]);
  const strategyRow = strategyRows[0];
  const riskPolicyRow = riskPolicyRows[0];
  if (!strategyRow || !riskPolicyRow) {
    throw new Error("Persistent agent has incomplete mandate versions");
  }

  return {
    agent: parseAgentRow(agentRow),
    strategy: strategyVersionSchema.parse({
      ...strategyRow,
      createdAt: strategyRow.createdAt.toISOString(),
    }),
    riskPolicy: riskPolicyVersionSchema.parse({
      ...riskPolicyRow,
      createdAt: riskPolicyRow.createdAt.toISOString(),
    }),
    assets: assetRows.map(({ asset }) =>
      assetSchema.parse({
        ...asset,
        issuer: asset.issuer ?? undefined,
        sourceTimestamp: asset.sourceTimestamp?.toISOString(),
      }),
    ),
  };
}

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
      agent: parseAgentRow(agentRow),
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
