CREATE TABLE "auth_session_revocations" (
	"jti" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_session_revocations_expires_idx" ON "auth_session_revocations" USING btree ("expires_at");