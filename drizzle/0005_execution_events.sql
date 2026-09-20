CREATE TABLE "execution_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_attempt_id" uuid NOT NULL,
	"prior_state" "execution_state",
	"state" "execution_state" NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_execution_attempt_id_execution_attempts_id_fk" FOREIGN KEY ("execution_attempt_id") REFERENCES "public"."execution_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "execution_events_attempt_created_idx" ON "execution_events" USING btree ("execution_attempt_id","created_at");--> statement-breakpoint
ALTER TABLE "execution_attempts" ADD CONSTRAINT "execution_attempts_signature_state_check" CHECK ("execution_attempts"."state" NOT IN ('submitted', 'confirmed', 'unknown_pending') OR "execution_attempts"."transaction_signature" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "execution_attempts" ADD CONSTRAINT "execution_attempts_confirmation_evidence_check" CHECK ("execution_attempts"."state" <> 'confirmed' OR ("execution_attempts"."confirmed_at" IS NOT NULL AND "execution_attempts"."slot" IS NOT NULL));
--> statement-breakpoint
CREATE TRIGGER execution_events_immutable
BEFORE UPDATE OR DELETE ON "execution_events"
FOR EACH ROW EXECUTE FUNCTION navis_reject_immutable_mutation();
--> statement-breakpoint
CREATE TRIGGER policy_evaluations_immutable
BEFORE UPDATE OR DELETE ON "policy_evaluations"
FOR EACH ROW EXECUTE FUNCTION navis_reject_immutable_mutation();
