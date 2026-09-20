import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";

import * as schema from "../db/schema";
import {
  assetValuationSchema,
  entityIdSchema,
  portfolioSnapshotSchema,
  type AssetValuation,
  type PortfolioSnapshot,
  type PortfolioSnapshotDocument,
} from "../domain";
import type { TreasuryBalanceRead } from "../integrations/solana/treasury";
import { hashCanonical } from "../proofs/canonical";

type NavisDatabase = NodePgDatabase<typeof schema>;

const snapshotInputSchema = z.object({
  agentId: entityIdSchema,
  custodyType: z.enum(["connected_wallet", "external_agent", "watch_only"]),
  valuations: z.array(assetValuationSchema),
});

export type CreatePortfolioSnapshotInput = Readonly<{
  agentId: string;
  custodyType: "connected_wallet" | "external_agent" | "watch_only";
  balanceRead: TreasuryBalanceRead;
  valuations: readonly AssetValuation[];
}>;

export type PreparedPortfolioSnapshot = Readonly<{
  custodyType: CreatePortfolioSnapshotInput["custodyType"];
  document: PortfolioSnapshotDocument;
  contentHash: string;
}>;

export function preparePortfolioSnapshot(
  candidate: CreatePortfolioSnapshotInput,
): PreparedPortfolioSnapshot {
  const metadata = snapshotInputSchema.parse(candidate);
  const balances = candidate.balanceRead.balances.map((balance) => ({
    ...balance,
    slot: balance.slot.toString(),
  }));
  const slots = balances.map((balance) => BigInt(balance.slot));
  const slot = slots.reduce((highest, current) =>
    current > highest ? current : highest,
  );
  const tokenMints = new Set(
    balances.flatMap((balance) => (balance.mint ? [balance.mint] : [])),
  );
  const valuationMints = metadata.valuations.map((valuation) => valuation.mint);
  if (new Set(valuationMints).size !== valuationMints.length) {
    throw new Error("Snapshot valuations must have unique mint identifiers");
  }
  if (valuationMints.some((mint) => !tokenMints.has(mint))) {
    throw new Error("Snapshot valuation references a balance that was not observed");
  }

  const document: PortfolioSnapshotDocument = {
    agentId: metadata.agentId,
    owner: candidate.balanceRead.owner,
    cluster: candidate.balanceRead.cluster,
    slot: slot.toString(),
    source: candidate.balanceRead.source,
    capturedAt: candidate.balanceRead.capturedAt,
    balances,
    valuations: metadata.valuations,
  };

  return Object.freeze({
    custodyType: metadata.custodyType,
    document,
    contentHash: hashCanonical(document),
  });
}

export async function createPortfolioSnapshot(
  candidate: CreatePortfolioSnapshotInput,
  database?: NavisDatabase,
): Promise<PortfolioSnapshot> {
  const prepared = preparePortfolioSnapshot(candidate);
  const db = database ?? (await import("../db/client")).getDatabase();
  return persistPortfolioSnapshot(prepared, db);
}

/**
 * Writes the treasury account and snapshot for an already prepared document.
 * Accepts a database or an open transaction. When `id` is supplied the caller
 * has already bound that identifier elsewhere (for example inside a decision
 * context), so a content-hash collision with a different row is an error.
 */
export async function persistPortfolioSnapshot(
  prepared: PreparedPortfolioSnapshot & Readonly<{ id?: string }>,
  db: NavisDatabase,
): Promise<PortfolioSnapshot> {
  return db.transaction(async (transaction) => {
    const [account] = await transaction
      .insert(schema.treasuryAccounts)
      .values({
        agentId: prepared.document.agentId,
        cluster: prepared.document.cluster,
        ownerPublicKey: prepared.document.owner,
        custodyType: prepared.custodyType,
        lastSyncedAt: new Date(prepared.document.capturedAt),
      })
      .onConflictDoUpdate({
        target: [
          schema.treasuryAccounts.agentId,
          schema.treasuryAccounts.ownerPublicKey,
          schema.treasuryAccounts.cluster,
        ],
        set: {
          custodyType: prepared.custodyType,
          lastSyncedAt: new Date(prepared.document.capturedAt),
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!account) throw new Error("Treasury account persistence returned no record");

    const [snapshot] = await transaction
      .insert(schema.portfolioSnapshots)
      .values({
        ...(prepared.id ? { id: prepared.id } : {}),
        agentId: prepared.document.agentId,
        treasuryAccountId: account.id,
        cluster: prepared.document.cluster,
        slot: BigInt(prepared.document.slot),
        source: prepared.document.source,
        capturedAt: new Date(prepared.document.capturedAt),
        balances: prepared.document.balances,
        valuations: prepared.document.valuations,
        contentHash: prepared.contentHash,
      })
      .onConflictDoNothing({ target: schema.portfolioSnapshots.contentHash })
      .returning();

    const persisted =
      snapshot ??
      (
        await transaction
          .select()
          .from(schema.portfolioSnapshots)
          .where(eq(schema.portfolioSnapshots.contentHash, prepared.contentHash))
          .limit(1)
      )[0];
    if (!persisted)
      throw new Error("Portfolio snapshot persistence returned no record");
    if (prepared.id && persisted.id !== prepared.id) {
      throw new Error(
        "Portfolio snapshot content hash is already bound to another row",
      );
    }

    return portfolioSnapshotSchema.parse({
      ...prepared.document,
      id: persisted.id,
      treasuryAccountId: persisted.treasuryAccountId,
      contentHash: persisted.contentHash,
      createdAt: persisted.createdAt.toISOString(),
    });
  });
}
