import { ArrowRight, FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

import { RunDecisionPanel } from "@/components/decisions/run-decision-panel";
import { ModeStamp } from "@/components/shared/domain-primitives";

import { DecisionSummaryBrief } from "./decision-brief";
import { DecisionRecord } from "./decision-record";
import { formatTimestamp, relativeTime } from "./lifecycle";
import { EmptyNote, ErrorState, SectionHead, SkeletonRows } from "./primitives";
import { RecentDecisions } from "./recent-decisions";
import type {
  DecisionRunResult,
  Loadable,
  PublicCapabilities,
  StoredDecisionSummary,
  WorkspaceSession,
} from "./types";
import { WorkspaceHint } from "./workspace-hint";

export type AtlasWorkspaceProps = {
  capabilities: PublicCapabilities;
  session: WorkspaceSession;
  /** `GET /api/workspace?path=/decisions` → `stored`. Filtered to Atlas here. */
  decisions: Loadable<readonly StoredDecisionSummary[]>;
  /** Optional full run for the newest stored Atlas decision. */
  latestRun?: Loadable<DecisionRunResult | null>;
  /** Called after a demo run completes so the wrapper can refetch records. */
  onDecisionsChanged?: () => void;
};

/**
 * Atlas as a structured decision record, not a conversation. The main surface
 * is built from stored records only. The demo run lives in a separate,
 * labelled disclosure and never substitutes for recorded data.
 */
export function AtlasWorkspace({
  capabilities,
  session,
  decisions,
  latestRun,
  onDecisionsChanged,
}: AtlasWorkspaceProps) {
  const persistenceReady = capabilities.persistenceConfigured;

  const atlasDecisions: Loadable<readonly StoredDecisionSummary[]> = useMemo(() => {
    if (decisions.state !== "ready") return decisions;
    return {
      state: "ready",
      data: decisions.data.filter((decision) => decision.agent.slug === "atlas"),
    };
  }, [decisions]);

  const records = atlasDecisions.state === "ready" ? atlasDecisions.data : [];
  const newest = records[0] ?? null;
  const stats = useMemo(() => {
    const approved = records.filter((record) => record.approved === true).length;
    const blocked = records.filter((record) => record.approved === false).length;
    return { total: records.length, approved, blocked };
  }, [records]);

  // Collapsed by default in every configuration: the primary screen never
  // opens on demo content.
  const [demoOpen, setDemoOpen] = useState(false);
  const run = latestRun?.state === "ready" ? latestRun.data : null;
  // Counts are only shown from a successful read. Loading, errors and a
  // missing database never render as zero.
  const statsReady = persistenceReady && atlasDecisions.state === "ready";
  const statFallback = !persistenceReady
    ? "Not stored"
    : atlasDecisions.state === "error"
      ? "Unavailable"
      : "Loading";
  const statValue = (value: number | string) =>
    statsReady ? value : <span className="ws-muted ws-stat-fallback">{statFallback}</span>;
  const latestIsAtlas = run ? run.agent.slug === "atlas" : false;

  let lead;
  if (!persistenceReady) {
    lead = (
      <EmptyNote kind="unavailable" title="No stored Atlas records in this instance" testId="atlas-lead-unavailable">
        This instance has no database, so Atlas decisions are not kept. The demo run, in the
        collapsed panel below, shows a full simulated record inline and does not keep it.
      </EmptyNote>
    );
  } else if (atlasDecisions.state === "loading" || latestRun?.state === "loading") {
    lead = (
      <div className="ws-record ws-record-loading">
        <SkeletonRows rows={6} label="Loading the latest Atlas record" />
      </div>
    );
  } else if (atlasDecisions.state === "error") {
    lead = (
      <ErrorState
        title="Atlas records could not be loaded"
        error={atlasDecisions.error}
        retry={atlasDecisions.retry}
        testId="atlas-lead-error"
      />
    );
  } else if (run && latestIsAtlas) {
    lead = <DecisionRecord run={run} />;
  } else if (newest && latestRun?.state === "error") {
    lead = (
      <>
        <ErrorState
          title="The latest Atlas record could not be loaded"
          error={`${latestRun.error} Only the ledger summary is shown below; rationale, policy, risk and proof are unavailable until the record loads.`}
          retry={latestRun.retry}
          testId="atlas-lead-detail-error"
        />
        <DecisionSummaryBrief decision={newest} />
      </>
    );
  } else if (newest) {
    lead = <DecisionSummaryBrief decision={newest} />;
  } else {
    lead = (
      <EmptyNote
        title="Atlas has no recorded decisions yet"
        testId="atlas-lead-empty"
        action={
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setDemoOpen(true);
              requestAnimationFrame(() =>
                document.getElementById("atlas-demo")?.scrollIntoView({ behavior: "smooth", block: "start" }),
              );
            }}
            data-testid="button-open-demo-run"
          >
            <FlaskConical aria-hidden="true" size={15} /> Open the demo run
          </button>
        }
      >
        Records appear here once Atlas proposes and policy evaluates. A demo run is stored as
        a public simulated record.
      </EmptyNote>
    );
  }

  return (
    <div className="ws-page" data-page="atlas">
      <header className="ws-page-head ws-agent-head">
        <div className="ws-page-title">
          <span className="ws-eyebrow">Agent · public demo agent</span>
          <div className="ws-heading-row">
            <h1>Atlas</h1>
            <WorkspaceHint topic="atlas" label="About Atlas" />
          </div>
          <p className="ws-lede">
            Atlas proposes one portfolio action at a time and writes down why. Deterministic
            policy decides whether it may proceed. Nothing moves without a wallet signature.
          </p>
        </div>
        <dl className="ws-agent-stats" aria-label="Atlas record summary">
          <div>
            <dt>Mode</dt>
            <dd>
              <ModeStamp mode={capabilities.mode} />
            </dd>
          </div>
          <div>
            <dt>Records</dt>
            <dd className="ws-figure" data-testid="text-atlas-record-count">
              {statValue(stats.total)}
            </dd>
          </div>
          <div>
            <dt>Approved / blocked</dt>
            <dd className="ws-figure">{statValue(`${stats.approved} / ${stats.blocked}`)}</dd>
          </div>
          <div>
            <dt>Last proposal</dt>
            <dd>
              {statsReady ? (
                newest ? (
                  <time dateTime={newest.createdAt} title={formatTimestamp(newest.createdAt)}>
                    {relativeTime(newest.createdAt)}
                  </time>
                ) : (
                  "None recorded"
                )
              ) : (
                <span className="ws-muted">{statFallback}</span>
              )}
            </dd>
          </div>
        </dl>
      </header>

      <section className="ws-section" aria-labelledby="atlas-latest-title">
        <SectionHead
          id="atlas-latest-title"
          eyebrow="Latest record"
          title="Decision, rationale, policy and proof"
          hint="lifecycle"
          hintLabel="About decision status"
        />
        {lead}
      </section>

      <section className="ws-section" aria-labelledby="atlas-history-title">
        <SectionHead
          id="atlas-history-title"
          eyebrow="History"
          title="Atlas records"
          aside={
            <Link className="text-link" href="/decisions" data-testid="link-atlas-all-decisions">
              Decision ledger <ArrowRight aria-hidden="true" size={14} />
            </Link>
          }
        />
        <RecentDecisions
          decisions={atlasDecisions}
          persistenceReady={persistenceReady}
          limit={10}
          emptyTitle="No Atlas records"
          emptyBody="Stored Atlas decisions are public records. None exist yet."
          testId="list-atlas-decisions"
        />
        {session ? null : (
          <p className="ws-caption">Atlas records are public. Your own agents live under Agents.</p>
        )}
      </section>

      <details
        id="atlas-demo"
        className="ws-demo"
        open={demoOpen}
        onToggle={(event) => setDemoOpen(event.currentTarget.open)}
        data-testid="disclosure-atlas-demo"
      >
        <summary>
          <span className="ws-tag" data-kind="simulation">
            Demo · simulation
          </span>
          <span className="ws-demo-title">
            <strong>Run Atlas in demo mode</strong>
            <small>
              Generates a real proposal and policy verdict, then records a simulated execution.
              Nothing is signed or sent.
            </small>
          </span>
          <span className="ws-demo-toggle" aria-hidden="true" />
        </summary>
        <div className="ws-demo-body">
          <RunDecisionPanel agentSlug="atlas" onRunComplete={() => onDecisionsChanged?.()} />
          <p className="ws-caption ws-demo-foot">
            Want the prepared example instead?{" "}
            <Link
              className="text-link"
              href="/agents/atlas/decisions/demo-decision"
              data-testid="link-prepared-demo"
            >
              Open the prepared demo decision
            </Link>{" "}
            (fictional fixture data, labelled as such).
          </p>
        </div>
      </details>
    </div>
  );
}
