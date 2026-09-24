CREATE TABLE "execution_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"agent_id" uuid,
	"launch_id" uuid,
	"owner_wallet" text NOT NULL,
	"cluster" "solana_cluster" NOT NULL,
	"fee_payer" text NOT NULL,
	"message_sha256" text NOT NULL,
	"required_signers" jsonb NOT NULL,
	"accounts_summary" jsonb NOT NULL,
	"instruction_summary" jsonb NOT NULL,
	"blockhash" text NOT NULL,
	"last_valid_block_height" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"simulation" jsonb,
	"status" text NOT NULL,
	"transaction_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "execution_intents_message_sha256_unique" UNIQUE("message_sha256")
);
--> statement-breakpoint
ALTER TABLE "execution_intents" ADD CONSTRAINT "execution_intents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_intents" ADD CONSTRAINT "execution_intents_launch_id_market_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."market_launches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "execution_intents_active_pool_launch_unique" ON "execution_intents" USING btree ("launch_id") WHERE "execution_intents"."kind" = 'meteora.pool' and "execution_intents"."status" in ('prepared', 'simulating', 'simulated', 'broadcasting');