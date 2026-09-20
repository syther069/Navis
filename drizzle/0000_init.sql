CREATE TYPE "public"."agent_status" AS ENUM('draft', 'active', 'paused', 'error');--> statement-breakpoint
CREATE TYPE "public"."solana_cluster" AS ENUM('devnet', 'mainnet-beta');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('proposed', 'approved', 'rejected', 'expired', 'executing', 'executed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."execution_mode" AS ENUM('demo', 'devnet', 'mainnet');--> statement-breakpoint
CREATE TYPE "public"."execution_state" AS ENUM('created', 'simulated', 'awaiting_signature', 'submitted', 'confirmed', 'rejected', 'cancelled', 'failed', 'unknown_pending');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('not_configured', 'pending', 'linked', 'failed');--> statement-breakpoint
CREATE TYPE "public"."verification_state" AS ENUM('unverified', 'provider_verified', 'onchain_verified', 'blocked');--> statement-breakpoint
CREATE TABLE "agent_asset_permissions" (
	"agent_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"allowed_actions" text[] NOT NULL,
	"max_exposure_bps_override" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_asset_permissions_agent_id_asset_id_pk" PRIMARY KEY("agent_id","asset_id"),
	CONSTRAINT "agent_asset_permissions_exposure_check" CHECK ("agent_asset_permissions"."max_exposure_bps_override" IS NULL OR "agent_asset_permissions"."max_exposure_bps_override" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"owner_wallet" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" "agent_status" DEFAULT 'draft' NOT NULL,
	"mode" "execution_mode" NOT NULL,
	"cluster" "solana_cluster" NOT NULL,
	"integration_status" "integration_status" DEFAULT 'not_configured' NOT NULL,
	"external_agent_id" text,
	"external_wallet" text,
	"external_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_mode_cluster_check" CHECK (("agents"."mode" = 'demo') OR ("agents"."mode" = 'devnet' AND "agents"."cluster" = 'devnet') OR ("agents"."mode" = 'mainnet' AND "agents"."cluster" = 'mainnet-beta')),
	CONSTRAINT "agents_linked_evidence_check" CHECK ("agents"."integration_status" <> 'linked' OR ("agents"."external_agent_id" IS NOT NULL AND "agents"."external_wallet" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mint" text NOT NULL,
	"cluster" "solana_cluster" NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"decimals" integer NOT NULL,
	"issuer" text,
	"source" text NOT NULL,
	"source_timestamp" timestamp with time zone,
	"verification_state" "verification_state" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_decimals_check" CHECK ("assets"."decimals" BETWEEN 0 AND 18)
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"strategy_version_id" uuid NOT NULL,
	"risk_policy_version_id" uuid NOT NULL,
	"portfolio_snapshot_id" uuid NOT NULL,
	"status" "decision_status" DEFAULT 'proposed' NOT NULL,
	"proposal" jsonb NOT NULL,
	"model_metadata" jsonb NOT NULL,
	"decision_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_decision_hash_unique" UNIQUE("decision_hash")
);
--> statement-breakpoint
CREATE TABLE "execution_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"state" "execution_state" DEFAULT 'created' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"idempotency_key" text NOT NULL,
	"cluster" "solana_cluster" NOT NULL,
	"transaction_signature" text,
	"submitted_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"slot" bigint,
	"fee_lamports" numeric(30, 0),
	"error_code" text,
	"safe_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "execution_attempts_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "external_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"request_id" text,
	"operation" text NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer,
	"safe_error" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_launches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_request_id" text,
	"idempotency_key" text NOT NULL,
	"cluster" "solana_cluster" NOT NULL,
	"status" text NOT NULL,
	"quote_mint" text,
	"base_mint" text,
	"pool_address" text,
	"payout_wallet" text,
	"transaction_signature" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_launches_provider_request_id_unique" UNIQUE("provider_request_id"),
	CONSTRAINT "market_launches_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "policy_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"approved" boolean NOT NULL,
	"checks" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"treasury_account_id" uuid NOT NULL,
	"cluster" "solana_cluster" NOT NULL,
	"slot" bigint NOT NULL,
	"source" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"balances" jsonb NOT NULL,
	"valuations" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proof_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"execution_attempt_id" uuid,
	"mode" "execution_mode" NOT NULL,
	"cluster" "solana_cluster" NOT NULL,
	"receipt_hash" text NOT NULL,
	"document" jsonb NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proof_receipts_decision_id_unique" UNIQUE("decision_id"),
	CONSTRAINT "proof_receipts_receipt_hash_unique" UNIQUE("receipt_hash")
);
--> statement-breakpoint
CREATE TABLE "risk_policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"hash" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_policy_versions_positive_check" CHECK ("risk_policy_versions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "strategy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"hash" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategy_versions_positive_check" CHECK ("strategy_versions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "treasury_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"cluster" "solana_cluster" NOT NULL,
	"owner_public_key" text NOT NULL,
	"custody_type" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet" text NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"disclosure_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_unique" UNIQUE("wallet")
);
--> statement-breakpoint
ALTER TABLE "agent_asset_permissions" ADD CONSTRAINT "agent_asset_permissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_asset_permissions" ADD CONSTRAINT "agent_asset_permissions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_strategy_version_id_strategy_versions_id_fk" FOREIGN KEY ("strategy_version_id") REFERENCES "public"."strategy_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_risk_policy_version_id_risk_policy_versions_id_fk" FOREIGN KEY ("risk_policy_version_id") REFERENCES "public"."risk_policy_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_portfolio_snapshot_id_portfolio_snapshots_id_fk" FOREIGN KEY ("portfolio_snapshot_id") REFERENCES "public"."portfolio_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_attempts" ADD CONSTRAINT "execution_attempts_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_launches" ADD CONSTRAINT "market_launches_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_evaluations" ADD CONSTRAINT "policy_evaluations_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_treasury_account_id_treasury_accounts_id_fk" FOREIGN KEY ("treasury_account_id") REFERENCES "public"."treasury_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_receipts" ADD CONSTRAINT "proof_receipts_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_receipts" ADD CONSTRAINT "proof_receipts_execution_attempt_id_execution_attempts_id_fk" FOREIGN KEY ("execution_attempt_id") REFERENCES "public"."execution_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_policy_versions" ADD CONSTRAINT "risk_policy_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_accounts" ADD CONSTRAINT "treasury_accounts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agents_owner_wallet_slug_unique" ON "agents" USING btree ("owner_wallet","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_cluster_mint_unique" ON "assets" USING btree ("cluster","mint");--> statement-breakpoint
CREATE INDEX "decisions_agent_created_idx" ON "decisions" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_attempts_one_active_per_decision" ON "execution_attempts" USING btree ("decision_id") WHERE "execution_attempts"."active" = true;--> statement-breakpoint
CREATE INDEX "external_calls_provider_created_idx" ON "external_calls" USING btree ("provider","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_snapshots_hash_unique" ON "portfolio_snapshots" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_agent_captured_idx" ON "portfolio_snapshots" USING btree ("agent_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_policy_versions_agent_version_unique" ON "risk_policy_versions" USING btree ("agent_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_policy_versions_agent_hash_unique" ON "risk_policy_versions" USING btree ("agent_id","hash");--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_versions_agent_version_unique" ON "strategy_versions" USING btree ("agent_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_versions_agent_hash_unique" ON "strategy_versions" USING btree ("agent_id","hash");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION navis_reject_immutable_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER strategy_versions_immutable
BEFORE UPDATE OR DELETE ON "strategy_versions"
FOR EACH ROW EXECUTE FUNCTION navis_reject_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER risk_policy_versions_immutable
BEFORE UPDATE OR DELETE ON "risk_policy_versions"
FOR EACH ROW EXECUTE FUNCTION navis_reject_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER proof_receipts_append_only
BEFORE UPDATE OR DELETE ON "proof_receipts"
FOR EACH ROW EXECUTE FUNCTION navis_reject_immutable_mutation();
