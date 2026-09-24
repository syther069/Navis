CREATE TABLE "rate_limit_windows" (
	"scope" text NOT NULL,
	"client_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_windows_scope_client_hash_window_start_pk" PRIMARY KEY("scope","client_hash","window_start")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "is_public_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "client_request_id" text;--> statement-breakpoint
CREATE INDEX "rate_limit_windows_scope_window_idx" ON "rate_limit_windows" USING btree ("scope","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_public_demo_slug_unique" ON "agents" USING btree ("slug") WHERE "agents"."is_public_demo" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_agent_client_request_unique" ON "decisions" USING btree ("agent_id","client_request_id");