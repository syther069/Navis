import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";
import type { TradeProposal } from "../domain";
import {
  proofReceiptDocumentSchema,
  verifyProofReceipt,
  type ProofReceiptDocument,
} from "../proofs/receipt";
import type { ExecutionState } from "./execution";

type NavisDatabase = NodePgDatabase<typeof schema>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoredDecisionSummary = Readonly<{
  decisionId: string;
  proofId: string | null;
  agent: Readonly<{ id: string; slug: string; name: string; mode: string }>;
  action: TradeProposal["action"];
  status: (typeof schema.decisions.$inferSelect)["status"];
  approved: boolean | null;
  executionState: ExecutionState | null;
  decisionHash: string;
  createdAt: string;
}>;

/** Owner-scoped list of stored decisions, newest first. */
export async function listDecisionsForOwner(
  ownerWallet: string,
  database: NavisDatabase,
  limit = 25,
): Promise<readonly StoredDecisionSummary[]> {
  const rows = await database
    .select({
      decisionId: schema.decisions.id,
      proofId: schema.proofReceipts.id,
      agent: {
        id: schema.agents.id,
        slug: schema.agents.slug,
        name: schema.agents.name,
        mode: schema.agents.mode,
      },
      proposal: schema.decisions.proposal,
      status: schema.decisions.status,
      approved: schema.policyEvaluations.approved,
      executionState: schema.executionAttempts.state,
      decisionHash: schema.decisions.decisionHash,
      createdAt: schema.decisions.createdAt,
    })
    .from(schema.decisions)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.decisions.agentId))
    .leftJoin(
      schema.policyEvaluations,
      eq(schema.policyEvaluations.decisionId, schema.decisions.id),
    )
    .leftJoin(
      schema.proofReceipts,
      eq(schema.proofReceipts.decisionId, schema.decisions.id),
    )
    .leftJoin(
      schema.executionAttempts,
      eq(schema.executionAttempts.id, schema.proofReceipts.executionAttemptId),
    )
    .where(eq(schema.agents.ownerWallet, ownerWallet))
    .orderBy(desc(schema.decisions.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    decisionId: row.decisionId,
    proofId: row.proofId,
    agent: row.agent,
    action: row.proposal.action,
    status: row.status,
    approved: row.approved,
    executionState: row.executionState,
    decisionHash: row.decisionHash,
    createdAt: row.createdAt.toISOString(),
  }));
}

export type StoredProofSummary = Readonly<{
  proofId: string;
  decisionId: string;
  agent: Readonly<{ id: string; slug: string; name: string; mode: string }>;
  mode: string;
  receiptHash: string;
  executionState: string;
  approved: boolean;
  finalizedAt: string;
}>;

export type StoredProofRecord = StoredProofSummary &
  Readonly<{
    receipt: ProofReceiptDocument;
    verification: ReturnType<typeof verifyProofReceipt>;
  }>;

const proofSelection = {
  proofId: schema.proofReceipts.id,
  decisionId: schema.proofReceipts.decisionId,
  agent: {
    id: schema.agents.id,
    slug: schema.agents.slug,
    name: schema.agents.name,
    mode: schema.agents.mode,
  },
  mode: schema.proofReceipts.mode,
  receiptHash: schema.proofReceipts.receiptHash,
  document: schema.proofReceipts.document,
  finalizedAt: schema.proofReceipts.finalizedAt,
};

function summarise(row: {
  proofId: string;
  decisionId: string;
  agent: StoredProofSummary["agent"];
  mode: string;
  receiptHash: string;
  document: unknown;
  finalizedAt: Date;
}): StoredProofRecord {
  const receipt = proofReceiptDocumentSchema.parse(row.document);
  return {
    proofId: row.proofId,
    decisionId: row.decisionId,
    agent: row.agent,
    mode: row.mode,
    receiptHash: row.receiptHash,
    executionState: receipt.execution.state,
    approved: receipt.policyEvaluation.approved,
    finalizedAt: row.finalizedAt.toISOString(),
    receipt,
    verification: verifyProofReceipt(receipt, row.receiptHash),
  };
}

/** Owner-scoped list of stored proof receipts, newest first. */
export async function listProofsForOwner(
  ownerWallet: string,
  database: NavisDatabase,
  limit = 25,
): Promise<readonly StoredProofRecord[]> {
  const rows = await database
    .select(proofSelection)
    .from(schema.proofReceipts)
    .innerJoin(
      schema.decisions,
      eq(schema.decisions.id, schema.proofReceipts.decisionId),
    )
    .innerJoin(schema.agents, eq(schema.agents.id, schema.decisions.agentId))
    .where(eq(schema.agents.ownerWallet, ownerWallet))
    .orderBy(desc(schema.proofReceipts.finalizedAt))
    .limit(limit);
  return rows.map(summarise);
}

/** Loads one stored receipt by row id; null when unknown or owned by another wallet. */
export async function loadProofForOwner(
  proofId: string,
  ownerWallet: string,
  database: NavisDatabase,
): Promise<StoredProofRecord | null> {
  if (!UUID_PATTERN.test(proofId)) return null;
  const [row] = await database
    .select(proofSelection)
    .from(schema.proofReceipts)
    .innerJoin(
      schema.decisions,
      eq(schema.decisions.id, schema.proofReceipts.decisionId),
    )
    .innerJoin(schema.agents, eq(schema.agents.id, schema.decisions.agentId))
    .where(
      and(
        eq(schema.proofReceipts.id, proofId),
        eq(schema.agents.ownerWallet, ownerWallet),
      ),
    )
    .limit(1);
  return row ? summarise(row) : null;
}
