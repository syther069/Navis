import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
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

/** Who may read a stored record. */
export type RecordVisibility = "public" | "owner";

export type StoredRecordReader = Readonly<{
  /** Wallet of the authenticated session, when there is one. */
  ownerWallet?: string | null;
}>;

/**
 * Rows the reader may see: every public Atlas record, plus the records owned
 * by the reader's wallet when a session exists. Anyone else's records are
 * indistinguishable from unknown ids.
 */
function readableBy(reader: StoredRecordReader): SQL {
  const wallet = reader.ownerWallet ?? null;
  const owned = wallet ? eq(schema.agents.ownerWallet, wallet) : sql`false`;
  return or(eq(schema.agents.isPublicDemo, true), owned) as SQL;
}

const agentSelection = {
  id: schema.agents.id,
  slug: schema.agents.slug,
  name: schema.agents.name,
  mode: schema.agents.mode,
  isPublicDemo: schema.agents.isPublicDemo,
};

type AgentRow = {
  id: string;
  slug: string;
  name: string;
  mode: string;
  isPublicDemo: boolean;
};

function describeAgent(agent: AgentRow) {
  return {
    agent: { id: agent.id, slug: agent.slug, name: agent.name, mode: agent.mode },
    visibility: (agent.isPublicDemo ? "public" : "owner") as RecordVisibility,
  };
}

export type StoredDecisionSummary = Readonly<{
  decisionId: string;
  proofId: string | null;
  agent: Readonly<{ id: string; slug: string; name: string; mode: string }>;
  visibility: RecordVisibility;
  action: TradeProposal["action"];
  status: (typeof schema.decisions.$inferSelect)["status"];
  approved: boolean | null;
  executionState: ExecutionState | null;
  decisionHash: string;
  createdAt: string;
}>;

/** Stored decisions the reader may see (public Atlas plus own), newest first. */
export async function listDecisions(
  reader: StoredRecordReader,
  database: NavisDatabase,
  limit = 25,
): Promise<readonly StoredDecisionSummary[]> {
  const rows = await database
    .select({
      decisionId: schema.decisions.id,
      proofId: schema.proofReceipts.id,
      agent: agentSelection,
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
    .where(readableBy(reader))
    .orderBy(desc(schema.decisions.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    decisionId: row.decisionId,
    proofId: row.proofId,
    ...describeAgent(row.agent),
    action: row.proposal.action,
    status: row.status,
    approved: row.approved,
    executionState: row.executionState,
    decisionHash: row.decisionHash,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Owner-scoped list, kept for callers that always have a session. */
export function listDecisionsForOwner(
  ownerWallet: string,
  database: NavisDatabase,
  limit = 25,
) {
  return listDecisions({ ownerWallet }, database, limit);
}

export type StoredProofSummary = Readonly<{
  proofId: string;
  decisionId: string;
  agent: Readonly<{ id: string; slug: string; name: string; mode: string }>;
  visibility: RecordVisibility;
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
  agent: agentSelection,
  mode: schema.proofReceipts.mode,
  receiptHash: schema.proofReceipts.receiptHash,
  document: schema.proofReceipts.document,
  finalizedAt: schema.proofReceipts.finalizedAt,
};

function summarise(row: {
  proofId: string;
  decisionId: string;
  agent: AgentRow;
  mode: string;
  receiptHash: string;
  document: unknown;
  finalizedAt: Date;
}): StoredProofRecord {
  const receipt = proofReceiptDocumentSchema.parse(row.document);
  return {
    proofId: row.proofId,
    decisionId: row.decisionId,
    ...describeAgent(row.agent),
    mode: row.mode,
    receiptHash: row.receiptHash,
    executionState: receipt.execution.state,
    approved: receipt.policyEvaluation.approved,
    finalizedAt: row.finalizedAt.toISOString(),
    receipt,
    verification: verifyProofReceipt(receipt, row.receiptHash),
  };
}

/** Stored receipts the reader may see (public Atlas plus own), newest first. */
export async function listProofs(
  reader: StoredRecordReader,
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
    .where(readableBy(reader))
    .orderBy(desc(schema.proofReceipts.finalizedAt))
    .limit(limit);
  return rows.map(summarise);
}

/** Owner-scoped list, kept for callers that always have a session. */
export function listProofsForOwner(
  ownerWallet: string,
  database: NavisDatabase,
  limit = 25,
) {
  return listProofs({ ownerWallet }, database, limit);
}

/**
 * Loads one stored receipt by row id. Public Atlas receipts need no session;
 * any other receipt is null unless the reader's wallet owns the agent.
 */
export async function loadProof(
  proofId: string,
  reader: StoredRecordReader,
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
    .where(and(eq(schema.proofReceipts.id, proofId), readableBy(reader)))
    .limit(1);
  return row ? summarise(row) : null;
}

/** Owner-scoped read, kept for callers that always have a session. */
export function loadProofForOwner(
  proofId: string,
  ownerWallet: string,
  database: NavisDatabase,
) {
  return loadProof(proofId, { ownerWallet }, database);
}
