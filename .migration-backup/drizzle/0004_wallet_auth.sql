CREATE TABLE "auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet" text NOT NULL,
	"nonce_hash" text NOT NULL,
	"domain" text NOT NULL,
	"uri" text NOT NULL,
	"statement" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_challenges_nonce_hash_unique" UNIQUE("nonce_hash")
);
--> statement-breakpoint
CREATE INDEX "auth_challenges_wallet_expires_idx" ON "auth_challenges" USING btree ("wallet","expires_at");