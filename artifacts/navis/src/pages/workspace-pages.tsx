import { useCallback, useEffect, useState } from "react";
import { WorkspaceDashboard, AtlasWorkspace, DecisionDetail } from "@/components/workspace";
import type { DecisionRunResult, Loadable, StoredDecisionSummary } from "@/components/workspace/types";
import { usePageData } from "@/lib/page-data";

async function workspaceRequest(path: string, signal: AbortSignal) {
  const response = await fetch(`/api/workspace?path=${encodeURIComponent(path)}`, {
    credentials: "same-origin", signal,
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error ?? `Workspace request failed (${response.status}).`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return body;
}

function useStoredDecisions(atlasOnly: boolean) {
  const { session } = usePageData();
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  const [decisions, setDecisions] = useState<Loadable<StoredDecisionSummary[]>>({state: "loading"});
  const [latestRun, setLatestRun] = useState<Loadable<DecisionRunResult | null>>({state: "loading"});
  useEffect(() => {
    const controller = new AbortController();
    setDecisions({state: "loading"});
    setLatestRun({state: "loading"});
    void workspaceRequest("/decisions", controller.signal).then(async result => {
      const records: StoredDecisionSummary[] = result.stored;
      setDecisions({state: "ready", data: records});
      const latest = records.find(record => !atlasOnly || record.agent.slug === "atlas");
      if (!latest) {
        setLatestRun({state: "ready", data: null});
        return;
      }
      try {
        const detail = await workspaceRequest(`/decisions/${encodeURIComponent(latest.decisionId)}`, controller.signal);
        setLatestRun({state: "ready", data: detail.run});
      } catch (error: any) {
        if (error.name === "AbortError") return;
        setLatestRun(error.status === 404
          ? {state: "ready", data: null}
          : {state: "error", error: error.message, retry});
      }
    }).catch(error => {
      if (error.name === "AbortError") return;
      setDecisions({state: "error", error: error.message, retry});
      setLatestRun({state: "error", error: error.message, retry});
    });
    return () => controller.abort();
  }, [atlasOnly, session?.wallet, revision, retry]);
  return { decisions, latestRun, retry };
}

export function DashboardPage() {
  const { capabilities, session } = usePageData();
  const { decisions, latestRun } = useStoredDecisions(false);
  return <WorkspaceDashboard capabilities={capabilities} session={session} decisions={decisions} latestRun={latestRun}/>;
}
export function AtlasPage() {
  const { capabilities, session } = usePageData();
  const { decisions, latestRun, retry } = useStoredDecisions(true);
  return <AtlasWorkspace capabilities={capabilities} session={session} decisions={decisions} latestRun={latestRun} onDecisionsChanged={retry}/>;
}
export function DecisionPage() {
  const { run } = usePageData();
  return <DecisionDetail run={run}/>;
}