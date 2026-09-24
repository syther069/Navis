import { useMemo } from "react";
import { Link } from "wouter";
import { DecisionRecord } from "@/components/workspace";
import { usePageData } from "@/lib/page-data";
import { preparedExampleRecord, PREPARED_EXAMPLE_NOTE } from "@/lib/prepared-example";

export default function PreparedExamplePage() {
  const { demoProof, demoAgentBundle } = usePageData();
  const record = useMemo(
    () => preparedExampleRecord(demoProof, demoAgentBundle),
    [demoProof, demoAgentBundle],
  );
  return (
    <div className="ws-page" data-page="prepared-demo-decision">
      <nav className="ws-crumbs" aria-label="Breadcrumb">
        <Link className="text-link" href="/agents/atlas">Atlas</Link>
        <span>Prepared demo example</span>
      </nav>
      <section className="route-panel route-panel-muted" aria-label="Static example provenance">
        <span className="route-eyebrow">Explicit demo fixture · prepared example</span>
        <h1>Atlas bounded one-unit rebalance</h1>
        <p>{PREPARED_EXAMPLE_NOTE}</p>
      </section>
      <DecisionRecord run={record} showDetailLink={false}/>
    </div>
  );
}