import { ArrowRight, Layers, ShieldCheck } from "lucide-react";
import type { ComponentProps } from "react";
import { Link } from "wouter";

import { PolicyResult } from "@/components/shared/domain-primitives";

type TreasuryPosition = Readonly<{
  key: string;
  symbol: string;
  amount: string;
  valuation: string | null;
  reason: string | null;
}>;

/**
 * The prepared Atlas example. Every value here is a deterministic demo
 * fixture and is labelled as such. Render only on explicit demo surfaces.
 */
export function AgentOverview({
  treasury,
  policyChecks,
}: {
  treasury: {
    capturedAt: string;
    pricedSubtotalMicros: string;
    positions: readonly TreasuryPosition[];
  };
  policyChecks: readonly ComponentProps<typeof PolicyResult>[];
}) {
  const pricedSubtotal = Number(treasury.pricedSubtotalMicros) / 1_000_000;

  return (
    <section className="ws-demo-example" aria-labelledby="demo-example-title" data-testid="agent-overview-demo">
      <header className="ws-demo-example-head">
        <div>
          <span className="ws-tag" data-kind="fixture">
            Demo fixture · fictional
          </span>
          <h2 id="demo-example-title">Prepared Atlas example</h2>
          <p className="ws-lede">
            A constrained rebalance proposal recorded against an immutable demo snapshot,
            strategy v1.0 and a deterministic risk policy. No live wallet or funds are
            represented.
          </p>
        </div>
        <Link
          className="primary-button"
          href="/agents/atlas/decisions/demo-decision"
          data-testid="link-inspect-demo-decision"
        >
          Inspect demo decision <ArrowRight aria-hidden="true" size={15} />
        </Link>
      </header>

      <dl className="ws-facts ws-facts-inline">
        <div className="ws-fact">
          <dt>Universe</dt>
          <dd>4 demo assets</dd>
        </div>
        <div className="ws-fact">
          <dt>Policy</dt>
          <dd>Balanced mandate</dd>
        </div>
        <div className="ws-fact">
          <dt>Execution</dt>
          <dd>Hash-verified simulation, no explorer link</dd>
        </div>
      </dl>

      <div className="ws-demo-example-grid">
        <section aria-labelledby="demo-constraints-title">
          <div className="ws-mini-head">
            <ShieldCheck aria-hidden="true" size={16} />
            <h3 id="demo-constraints-title">Risk policy checks</h3>
          </div>
          <div className="constraint-list">
            {policyChecks.map((constraint) => (
              <PolicyResult key={constraint.label} {...constraint} />
            ))}
          </div>
        </section>

        <section aria-labelledby="demo-treasury-title">
          <div className="ws-mini-head">
            <Layers aria-hidden="true" size={16} />
            <h3 id="demo-treasury-title">Demo portfolio snapshot</h3>
          </div>
          <div className="ws-demo-total">
            <span className="ws-label">Priced subtotal</span>
            <strong className="ws-figure">
              ${pricedSubtotal.toLocaleString("en-US")}
            </strong>
            <small>Excludes every unpriced balance · {treasury.capturedAt}</small>
          </div>
          <ul className="ws-positions">
            {treasury.positions.map((position) => (
              <li key={position.key} data-unpriced={position.valuation === null || undefined}>
                <span className="ws-asset">
                  <strong>{position.symbol}</strong>
                  <small>{position.amount} units</small>
                </span>
                {position.valuation ? (
                  <strong className="ws-figure">
                    ${(Number(position.valuation) / 1_000_000).toLocaleString("en-US")}
                  </strong>
                ) : (
                  <span className="ws-muted">Unpriced</span>
                )}
                {position.reason ? <small className="ws-position-reason">{position.reason}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
