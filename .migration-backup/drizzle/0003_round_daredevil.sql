CREATE UNIQUE INDEX "treasury_accounts_agent_owner_cluster_unique" ON "treasury_accounts" USING btree ("agent_id","owner_public_key","cluster");
--> statement-breakpoint
CREATE TRIGGER portfolio_snapshots_immutable
BEFORE UPDATE OR DELETE ON "portfolio_snapshots"
FOR EACH ROW EXECUTE FUNCTION navis_reject_immutable_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION navis_guard_decision_evidence()
RETURNS trigger AS $$
BEGIN
  IF NEW.agent_id IS DISTINCT FROM OLD.agent_id
    OR NEW.strategy_version_id IS DISTINCT FROM OLD.strategy_version_id
    OR NEW.risk_policy_version_id IS DISTINCT FROM OLD.risk_policy_version_id
    OR NEW.portfolio_snapshot_id IS DISTINCT FROM OLD.portfolio_snapshot_id
    OR NEW.proposal IS DISTINCT FROM OLD.proposal
    OR NEW.model_metadata IS DISTINCT FROM OLD.model_metadata
    OR NEW.decision_hash IS DISTINCT FROM OLD.decision_hash
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'decision evidence fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER decisions_evidence_immutable
BEFORE UPDATE ON "decisions"
FOR EACH ROW EXECUTE FUNCTION navis_guard_decision_evidence();
