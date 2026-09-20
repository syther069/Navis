import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { RiskPolicyDocument, StrategyDocument, TradeProposal } from "../domain";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const executionModeEnum = pgEnum("execution_mode", [
  "demo",
  "devnet",
  "mainnet",
]);
export const clusterEnum = pgEnum("solana_cluster", ["devnet", "mainnet-beta"]);
export const agentStatusEnum = pgEnum("agent_status", [
  "draft",
  "active",
  "paused",
  "error",
]);
export const integrationStatusEnum = pgEnum("integration_status", [
  "not_configured",
  "pending",
  "linked",
  "failed",
]);
export const verificationStateEnum = pgEnum("verification_state", [
  "unverified",
  "provider_verified",
  "onchain_verified",
  "blocked",
]);
export const decisionStatusEnum = pgEnum("decision_status", [
  "proposed",
  "approved",
  "rejected",
  "expired",
  "executing",
  "executed",
  "failed",
]);
export const executionStateEnum = pgEnum("execution_state", [
  "created",
  "simulated",
  "awaiting_signature",
  "submitted",
  "confirmed",
  "rejected",
  "cancelled",
  "failed",
  "unknown_pending",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  wallet: text("wallet").notNull().unique(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  disclosureAcceptedAt: timestamp("disclosure_accepted_at", { withTimezone: true }),
  ...timestamps,
});

export const authChallenges = pgTable(
  "auth_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wallet: text("wallet").notNull(),
    nonceHash: text("nonce_hash").notNull().unique(),
    domain: text("domain").notNull(),
    uri: text("uri").notNull(),
    statement: text("statement").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("auth_challenges_wallet_expires_idx").on(table.wallet, table.expiresAt),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "restrict" }),
    ownerWallet: text("owner_wallet"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: agentStatusEnum("status").default("draft").notNull(),
    mode: executionModeEnum("mode").notNull(),
    cluster: clusterEnum("cluster").notNull(),
    activeStrategyVersion: integer("active_strategy_version"),
    activeRiskPolicyVersion: integer("active_risk_policy_version"),
    integrationStatus: integrationStatusEnum("integration_status")
      .default("not_configured")
      .notNull(),
    externalAgentId: text("external_agent_id"),
    externalWallet: text("external_wallet"),
    externalRequestId: text("external_request_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("agents_owner_wallet_slug_unique").on(table.ownerWallet, table.slug),
    check(
      "agents_mode_cluster_check",
      sql`(${table.mode} = 'demo') OR (${table.mode} = 'devnet' AND ${table.cluster} = 'devnet') OR (${table.mode} = 'mainnet' AND ${table.cluster} = 'mainnet-beta')`,
    ),
    check(
      "agents_linked_evidence_check",
      sql`${table.integrationStatus} <> 'linked' OR (${table.externalAgentId} IS NOT NULL AND ${table.externalWallet} IS NOT NULL)`,
    ),
    check(
      "agents_active_versions_check",
      sql`(${table.activeStrategyVersion} IS NULL OR ${table.activeStrategyVersion} > 0) AND (${table.activeRiskPolicyVersion} IS NULL OR ${table.activeRiskPolicyVersion} > 0) AND (${table.status} <> 'active' OR (${table.activeStrategyVersion} IS NOT NULL AND ${table.activeRiskPolicyVersion} IS NOT NULL))`,
    ),
  ],
);

export const strategyVersions = pgTable(
  "strategy_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    hash: text("hash").notNull(),
    document: jsonb("document").$type<StrategyDocument>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("strategy_versions_agent_version_unique").on(
      table.agentId,
      table.version,
    ),
    uniqueIndex("strategy_versions_agent_hash_unique").on(table.agentId, table.hash),
    check("strategy_versions_positive_check", sql`${table.version} > 0`),
  ],
);

export const riskPolicyVersions = pgTable(
  "risk_policy_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    hash: text("hash").notNull(),
    document: jsonb("document").$type<RiskPolicyDocument>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("risk_policy_versions_agent_version_unique").on(
      table.agentId,
      table.version,
    ),
    uniqueIndex("risk_policy_versions_agent_hash_unique").on(table.agentId, table.hash),
    check("risk_policy_versions_positive_check", sql`${table.version} > 0`),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mint: text("mint").notNull(),
    isDemo: boolean("is_demo").default(false).notNull(),
    cluster: clusterEnum("cluster").notNull(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    decimals: integer("decimals").notNull(),
    issuer: text("issuer"),
    source: text("source").notNull(),
    sourceTimestamp: timestamp("source_timestamp", { withTimezone: true }),
    verificationState: verificationStateEnum("verification_state").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assets_cluster_mint_unique").on(table.cluster, table.mint),
    check("assets_decimals_check", sql`${table.decimals} BETWEEN 0 AND 18`),
  ],
);

export const agentAssetPermissions = pgTable(
  "agent_asset_permissions",
  {
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    allowedActions: text("allowed_actions").array().notNull(),
    maxExposureBpsOverride: integer("max_exposure_bps_override"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.agentId, table.assetId] }),
    check(
      "agent_asset_permissions_exposure_check",
      sql`${table.maxExposureBpsOverride} IS NULL OR ${table.maxExposureBpsOverride} BETWEEN 1 AND 10000`,
    ),
  ],
);

export const treasuryAccounts = pgTable(
  "treasury_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    cluster: clusterEnum("cluster").notNull(),
    ownerPublicKey: text("owner_public_key").notNull(),
    custodyType: text("custody_type").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("treasury_accounts_agent_owner_cluster_unique").on(
      table.agentId,
      table.ownerPublicKey,
      table.cluster,
    ),
  ],
);

export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    treasuryAccountId: uuid("treasury_account_id")
      .notNull()
      .references(() => treasuryAccounts.id),
    cluster: clusterEnum("cluster").notNull(),
    slot: bigint("slot", { mode: "bigint" }).notNull(),
    source: text("source").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    balances: jsonb("balances").notNull(),
    valuations: jsonb("valuations").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("portfolio_snapshots_hash_unique").on(table.contentHash),
    index("portfolio_snapshots_agent_captured_idx").on(table.agentId, table.capturedAt),
  ],
);

export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    strategyVersionId: uuid("strategy_version_id")
      .notNull()
      .references(() => strategyVersions.id),
    riskPolicyVersionId: uuid("risk_policy_version_id")
      .notNull()
      .references(() => riskPolicyVersions.id),
    portfolioSnapshotId: uuid("portfolio_snapshot_id")
      .notNull()
      .references(() => portfolioSnapshots.id),
    status: decisionStatusEnum("status").default("proposed").notNull(),
    proposal: jsonb("proposal").$type<TradeProposal>().notNull(),
    modelMetadata: jsonb("model_metadata").notNull(),
    decisionHash: text("decision_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("decisions_agent_created_idx").on(table.agentId, table.createdAt)],
);

export const policyEvaluations = pgTable("policy_evaluations", {
  id: uuid("id").defaultRandom().primaryKey(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id, { onDelete: "restrict" }),
  approved: boolean("approved").notNull(),
  checks: jsonb("checks").notNull(),
  inputHash: text("input_hash").notNull(),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const executionAttempts = pgTable(
  "execution_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    decisionId: uuid("decision_id")
      .notNull()
      .references(() => decisions.id, { onDelete: "restrict" }),
    state: executionStateEnum("state").default("created").notNull(),
    active: boolean("active").default(true).notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    cluster: clusterEnum("cluster").notNull(),
    transactionSignature: text("transaction_signature"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    slot: bigint("slot", { mode: "bigint" }),
    feeLamports: numeric("fee_lamports", { precision: 30, scale: 0 }),
    errorCode: text("error_code"),
    safeError: text("safe_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("execution_attempts_one_active_per_decision")
      .on(table.decisionId)
      .where(sql`${table.active} = true`),
    check(
      "execution_attempts_signature_state_check",
      sql`${table.state} NOT IN ('submitted', 'confirmed', 'unknown_pending') OR ${table.transactionSignature} IS NOT NULL`,
    ),
    check(
      "execution_attempts_confirmation_evidence_check",
      sql`${table.state} <> 'confirmed' OR (${table.confirmedAt} IS NOT NULL AND ${table.slot} IS NOT NULL)`,
    ),
  ],
);

export const executionEvents = pgTable(
  "execution_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    executionAttemptId: uuid("execution_attempt_id")
      .notNull()
      .references(() => executionAttempts.id, { onDelete: "restrict" }),
    priorState: executionStateEnum("prior_state"),
    state: executionStateEnum("state").notNull(),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("execution_events_attempt_created_idx").on(
      table.executionAttemptId,
      table.createdAt,
    ),
  ],
);

export const proofReceipts = pgTable("proof_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id, { onDelete: "restrict" })
    .unique(),
  executionAttemptId: uuid("execution_attempt_id").references(
    () => executionAttempts.id,
    { onDelete: "restrict" },
  ),
  mode: executionModeEnum("mode").notNull(),
  cluster: clusterEnum("cluster").notNull(),
  receiptHash: text("receipt_hash").notNull().unique(),
  document: jsonb("document").notNull(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const marketLaunches = pgTable("market_launches", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  providerRequestId: text("provider_request_id").unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  cluster: clusterEnum("cluster").notNull(),
  status: text("status").notNull(),
  quoteMint: text("quote_mint"),
  baseMint: text("base_mint"),
  poolAddress: text("pool_address"),
  payoutWallet: text("payout_wallet"),
  transactionSignature: text("transaction_signature"),
  metadata: jsonb("metadata").notNull(),
  ...timestamps,
});

export const executionIntents = pgTable(
  "execution_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "restrict" }),
    launchId: uuid("launch_id").references(() => marketLaunches.id, {
      onDelete: "restrict",
    }),
    ownerWallet: text("owner_wallet").notNull(),
    cluster: clusterEnum("cluster").notNull(),
    feePayer: text("fee_payer").notNull(),
    messageSha256: text("message_sha256").notNull().unique(),
    requiredSigners: jsonb("required_signers").notNull(),
    accountsSummary: jsonb("accounts_summary").notNull(),
    instructionSummary: jsonb("instruction_summary").notNull(),
    blockhash: text("blockhash").notNull(),
    lastValidBlockHeight: integer("last_valid_block_height").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    simulation: jsonb("simulation"),
    status: text("status").notNull(),
    transactionSignature: text("transaction_signature"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("execution_intents_active_pool_launch_unique")
      .on(table.launchId)
      .where(
        sql`${table.kind} = 'meteora.pool' and ${table.status} in ('prepared', 'simulating', 'simulated', 'broadcasting')`,
      ),
  ],
);

export const externalCalls = pgTable(
  "external_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    requestId: text("request_id"),
    operation: text("operation").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms"),
    safeError: text("safe_error"),
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("external_calls_provider_created_idx").on(table.provider, table.createdAt),
  ],
);
