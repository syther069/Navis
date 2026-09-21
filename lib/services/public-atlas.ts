import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { demoAgentBundle } from "../../fixtures/demo-agent";
import type { AgentBundle } from "../db/repositories/types";
import * as schema from "../db/schema";
import type { RiskPolicyDocument, StrategyDocument } from "../domain";
import {
  PRESTOCKS_CLUSTER,
  type PreStocksUniverse,
} from "../integrations/prestocks/research";
import { hashCanonical } from "../proofs/canonical";

type NavisDatabase = NodePgDatabase<typeof schema>;

/** Slug of the one system-owned public demo agent. */
export const PUBLIC_ATLAS_SLUG = demoAgentBundle.agent.slug;

export type PublicAtlasAgentRow = Readonly<{
  id: string;
  slug: string;
  name: string;
  mode: "demo";
}>;

function publicAgentSelection() {
  return {
    id: schema.agents.id,
    slug: schema.agents.slug,
    name: schema.agents.name,
    mode: schema.agents.mode,
  };
}

async function findPublicAtlasAgent(db: NavisDatabase) {
  const [row] = await db
    .select(publicAgentSelection())
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.slug, PUBLIC_ATLAS_SLUG),
        eq(schema.agents.isPublicDemo, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Returns the public Atlas agent row, creating it from the fixture on first
 * use. The row has no owner, is demo mode and can never be selected through
 * an owner-scoped query. Creation is idempotent under concurrency: the partial
 * unique index admits one public row per slug, and a losing writer simply
 * reads the row the winner committed.
 */
export async function ensurePublicAtlasAgent(
  db: NavisDatabase,
): Promise<PublicAtlasAgentRow> {
  const existing = await findPublicAtlasAgent(db);
  if (existing) return existing as PublicAtlasAgentRow;

  const fixture = demoAgentBundle;
  await db.transaction(async (transaction) => {
    const inserted = await transaction
      .insert(schema.agents)
      .values({
        ownerId: null,
        ownerWallet: null,
        slug: fixture.agent.slug,
        name: fixture.agent.name,
        status: "active",
        mode: "demo",
        cluster: fixture.agent.cluster,
        activeStrategyVersion: 1,
        activeRiskPolicyVersion: 1,
        integrationStatus: "not_configured",
        isPublicDemo: true,
      })
      .onConflictDoNothing({
        target: [schema.agents.slug],
        where: sql`${schema.agents.isPublicDemo} = true`,
      })
      .returning({ id: schema.agents.id });
    const created = inserted[0];
    if (!created) return; // another instance won the race

    await transaction.insert(schema.strategyVersions).values({
      agentId: created.id,
      version: 1,
      document: fixture.strategy.document,
      hash: fixture.strategy.hash,
    });
    await transaction.insert(schema.riskPolicyVersions).values({
      agentId: created.id,
      version: 1,
      document: fixture.riskPolicy.document,
      hash: fixture.riskPolicy.hash,
    });
    for (const asset of fixture.assets) {
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
        .returning({ id: schema.assets.id });
      if (!assetRow) throw new Error(`Asset persistence failed for ${asset.mint}`);
      await transaction.insert(schema.agentAssetPermissions).values({
        agentId: created.id,
        assetId: assetRow.id,
        allowedActions: ["BUY", "SELL", "HOLD"],
      });
    }
  });

  const row = await findPublicAtlasAgent(db);
  if (!row) throw new Error("Public Atlas agent could not be created.");
  return row as PublicAtlasAgentRow;
}

type VersionTable = typeof schema.strategyVersions | typeof schema.riskPolicyVersions;

type VersionRow = Readonly<{ id: string; version: number; createdAt: Date }>;

/**
 * Finds the version row holding exactly this document (by hash) for the
 * agent, inserting the next version number only when the hash is new. The
 * agent row is locked while a new version is allocated so two first-time
 * runs cannot pick the same number.
 */
async function ensureMandateVersion(
  db: NavisDatabase,
  table: VersionTable,
  agentId: string,
  document: StrategyDocument | RiskPolicyDocument,
  hash: string,
): Promise<VersionRow> {
  const select = () =>
    db
      .select({ id: table.id, version: table.version, createdAt: table.createdAt })
      .from(table)
      .where(and(eq(table.agentId, agentId), eq(table.hash, hash)))
      .limit(1);
  const [existing] = await select();
  if (existing) return existing;

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${schema.agents.id} from ${schema.agents} where ${schema.agents.id} = ${agentId} for update`,
    );
    const [raced] = await transaction
      .select({ id: table.id, version: table.version, createdAt: table.createdAt })
      .from(table)
      .where(and(eq(table.agentId, agentId), eq(table.hash, hash)))
      .limit(1);
    if (raced) return raced;
    const [latest] = await transaction
      .select({ version: sql<number>`coalesce(max(${table.version}), 0)` })
      .from(table)
      .where(eq(table.agentId, agentId));
    const version = Number(latest?.version ?? 0) + 1;
    const [created] = await transaction
      .insert(table)
      .values({ agentId, version, document: document as never, hash })
      .returning({ id: table.id, version: table.version, createdAt: table.createdAt });
    if (!created) throw new Error("Mandate version persistence returned no record.");
    return created;
  });
}

/** Atlas risk policy with its allowlist replaced by the PreStocks universe. */
function prestocksRiskPolicy(universe: PreStocksUniverse): RiskPolicyDocument {
  return {
    ...demoAgentBundle.riskPolicy.document,
    constraints: demoAgentBundle.riskPolicy.document.constraints.map((constraint) =>
      constraint.type === "allowed_mints"
        ? { ...constraint, mints: [...universe.allowedMints] }
        : constraint,
    ),
  };
}

/**
 * The Atlas bundle backed by database rows, ready for the persisted writer.
 * The fixture is the only source of the documents; the request never changes
 * them. For a PreStocks universe the derived policy is resolved first because
 * the derived strategy document names the policy version it pairs with, and
 * the receipt verifier checks that pairing.
 */
export async function resolvePublicAtlasBundle(
  db: NavisDatabase,
  prestocks: PreStocksUniverse | null,
): Promise<AgentBundle> {
  const fixture = demoAgentBundle;
  const agent = await ensurePublicAtlasAgent(db);

  const riskPolicyDocument = prestocks
    ? prestocksRiskPolicy(prestocks)
    : fixture.riskPolicy.document;
  const riskPolicyHash = hashCanonical(riskPolicyDocument);
  const riskPolicyRow = await ensureMandateVersion(
    db,
    schema.riskPolicyVersions,
    agent.id,
    riskPolicyDocument,
    riskPolicyHash,
  );

  const strategyDocument: StrategyDocument = prestocks
    ? {
        ...fixture.strategy.document,
        universe: [...prestocks.allowedMints],
        riskPolicyVersion: riskPolicyRow.version,
      }
    : fixture.strategy.document;
  const strategyHash = hashCanonical(strategyDocument);
  const strategyRow = await ensureMandateVersion(
    db,
    schema.strategyVersions,
    agent.id,
    strategyDocument,
    strategyHash,
  );

  return {
    agent: {
      ...fixture.agent,
      id: agent.id,
      cluster: prestocks ? PRESTOCKS_CLUSTER : fixture.agent.cluster,
      activeStrategyVersion: strategyRow.version,
      activeRiskPolicyVersion: riskPolicyRow.version,
    },
    strategy: {
      id: strategyRow.id,
      agentId: agent.id,
      version: strategyRow.version,
      document: strategyDocument,
      hash: strategyHash,
      createdAt: strategyRow.createdAt.toISOString(),
    },
    riskPolicy: {
      id: riskPolicyRow.id,
      agentId: agent.id,
      version: riskPolicyRow.version,
      document: riskPolicyDocument,
      hash: riskPolicyHash,
      createdAt: riskPolicyRow.createdAt.toISOString(),
    },
    assets: prestocks ? prestocks.assets : fixture.assets,
  };
}

/** Stored decision id for a public Atlas run request key, when already run. */
export async function findPublicAtlasDecisionByRequestKey(
  db: NavisDatabase,
  clientRequestId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.decisions.id })
    .from(schema.decisions)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.decisions.agentId))
    .where(
      and(
        eq(schema.agents.isPublicDemo, true),
        eq(schema.agents.slug, PUBLIC_ATLAS_SLUG),
        eq(schema.decisions.clientRequestId, clientRequestId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
