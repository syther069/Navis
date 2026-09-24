import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

import { DecisionRecord } from "./decision-record";
import { SkeletonRows } from "./primitives";
import type { DecisionRunResult } from "./types";

/** `/decisions/:decisionId` body. Loading and 404 stay in the route wrapper. */
export function DecisionDetail({ run }: { run: DecisionRunResult }) {
  return (
    <div className="ws-page" data-page="decision-detail">
      <nav className="ws-crumbs" aria-label="Breadcrumb">
        <Link className="text-link" href="/decisions" data-testid="link-back-decisions">
          <ArrowLeft aria-hidden="true" size={14} /> Decision ledger
        </Link>
        {run.agent.slug === "atlas" ? (
          <Link className="text-link" href="/agents/atlas">
            Atlas
          </Link>
        ) : null}
      </nav>
      <DecisionRecord run={run} showDetailLink={false} />
    </div>
  );
}

export function DecisionDetailSkeleton() {
  return (
    <div className="ws-page" data-page="decision-detail">
      <div className="ws-record ws-record-loading">
        <SkeletonRows rows={7} label="Loading decision record" />
      </div>
    </div>
  );
}
