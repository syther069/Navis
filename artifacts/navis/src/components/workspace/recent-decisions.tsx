import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

import { deriveLifecycle, formatTimestamp, relativeTime, shortHash } from "./lifecycle";
import { EmptyNote, ErrorState, LifecycleChip, SkeletonRows } from "./primitives";
import type { Loadable, StoredDecisionSummary } from "./types";

/**
 * Stored decisions only: public Atlas records plus the authenticated owner's
 * records, newest first, exactly as the server returns them. No fixture row
 * is appended here.
 */
export function RecentDecisions({
  decisions,
  persistenceReady,
  limit = 6,
  emptyTitle = "No decisions recorded yet",
  emptyBody = "When Atlas or one of your agents produces a decision, it appears here with its policy verdict and receipt.",
  emptyAction,
  testId = "list-recent-decisions",
}: {
  decisions: Loadable<readonly StoredDecisionSummary[]>;
  persistenceReady: boolean;
  limit?: number;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
  testId?: string;
}) {
  if (!persistenceReady) {
    return (
      <EmptyNote
        kind="unavailable"
        title="No decision ledger in this instance"
        testId={`${testId}-unavailable`}
      >
        This instance has no database, so decisions are not stored. Fresh Atlas runs are
        shown inline on the Atlas page only.
      </EmptyNote>
    );
  }

  if (decisions.state === "loading") {
    return <SkeletonRows rows={4} label="Loading recent decisions" />;
  }

  if (decisions.state === "error") {
    return (
      <ErrorState
        title="Recent decisions could not be loaded"
        error={decisions.error}
        retry={decisions.retry}
        testId={`${testId}-error`}
      />
    );
  }

  const rows = decisions.data.slice(0, limit);
  if (rows.length === 0) {
    return (
      <EmptyNote title={emptyTitle} action={emptyAction} testId={`${testId}-empty`}>
        {emptyBody}
      </EmptyNote>
    );
  }

  return (
    <ol className="ws-activity" data-testid={testId}>
      {rows.map((decision) => {
        const lifecycle = deriveLifecycle({
          approved: decision.approved,
          executionState: decision.executionState,
          mode: decision.agent.mode,
          evidence: "summary",
        });
        return (
          <li key={decision.decisionId} data-testid={`row-decision-${decision.decisionId}`}>
            <Link
              className="ws-activity-row"
              href={`/decisions/${decision.decisionId}`}
              data-testid={`link-decision-${decision.decisionId}`}
            >
              <span className="ws-activity-main">
                <span className="ws-activity-title">
                  <strong>{decision.action}</strong>
                  <span>{decision.agent.name}</span>
                  {decision.visibility === "public" ? (
                    <span className="ws-activity-scope">Public record</span>
                  ) : (
                    <span className="ws-activity-scope" data-owner>
                      Your wallet
                    </span>
                  )}
                </span>
                <span className="ws-activity-meta">
                  <time dateTime={decision.createdAt} title={formatTimestamp(decision.createdAt)}>
                    {relativeTime(decision.createdAt) ?? formatTimestamp(decision.createdAt)}
                  </time>
                  <code>{shortHash(decision.decisionHash, 10, 4)}</code>
                </span>
              </span>
              <LifecycleChip lifecycle={lifecycle} compact />
              <ArrowUpRight className="ws-activity-go" aria-hidden="true" size={16} />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
