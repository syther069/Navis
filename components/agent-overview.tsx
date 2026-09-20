import {
  ArrowRight,
  ShieldCheck,
  Sparkle,
  Stack,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { PolicyResult, StatusBadge } from "@/components/shared/domain-primitives";

type TreasuryPosition = Readonly<{
  key: string;
  symbol: string;
  amount: string;
  valuation: string | null;
  reason: string | null;
}>;

export function AgentOverview({
  treasury,
  policyChecks,
}: {
  treasury: {
    capturedAt: string;
    pricedSubtotalMicros: string;
    positions: readonly TreasuryPosition[];
  };
  policyChecks: readonly React.ComponentProps<typeof PolicyResult>[];
}) {
  const pricedSubtotal = Number(treasury.pricedSubtotalMicros) / 1_000_000;

  return (
    <>
      <section className="agent-heading" aria-labelledby="agent-title">
        <div>
          <div className="heading-meta">
            <StatusBadge tone="active">Monitoring</StatusBadge>
            <span>Strategy v1.0</span>
            <span>Demo fixture</span>
          </div>
          <h2 id="agent-title">Atlas</h2>
          <p>
            Preserve capital while rotating into a bounded basket of tokenized equities.
          </p>
        </div>
        <div className="agent-owner">
          <span>Agent treasury</span>
          <strong>Deterministic fixture</strong>
          <small>No live wallet or funds are represented</small>
        </div>
      </section>

      <div className="primary-grid">
        <section className="decision-surface" aria-labelledby="decision-title">
          <div className="section-kicker">
            <Sparkle aria-hidden="true" size={16} /> Decision command
          </div>
          <div className="decision-copy">
            <div>
              <span className="decision-state">Recorded demo decision</span>
              <h2 id="decision-title">Review the constrained rebalance proposal.</h2>
              <p>
                Atlas received the immutable demo snapshot, strategy version, and
                deterministic risk policy shown alongside this decision.
              </p>
            </div>
            <Link
              className="primary-button"
              href="/agents/atlas/decisions/demo-decision"
            >
              Inspect decision <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>

          <div className="decision-context" aria-label="Decision context">
            <div>
              <span>Universe</span>
              <strong>4 demo assets</strong>
            </div>
            <div>
              <span>Policy</span>
              <strong>Balanced mandate</strong>
            </div>
            <div>
              <span>Execution</span>
              <strong>Hash-verified simulation</strong>
            </div>
          </div>

          <div className="empty-proof">
            <div className="proof-node" aria-hidden="true" />
            <div>
              <strong>One simulated decision recorded</strong>
              <p>
                Its proof spine connects the proposal to exact checks and a simulation
                receipt without an explorer link.
              </p>
              <Link className="text-link" href="/decisions">
                Open decision ledger
              </Link>
            </div>
          </div>
        </section>

        <aside className="agent-ledger" aria-label="Agent constraints and treasury">
          <section className="ledger-section" aria-labelledby="constraints-title">
            <div className="ledger-heading">
              <div>
                <span>Risk policy</span>
                <h2 id="constraints-title">Constraint ledger</h2>
              </div>
              <ShieldCheck aria-hidden="true" size={22} />
            </div>
            <div className="constraint-list">
              {policyChecks.map((constraint) => (
                <PolicyResult key={constraint.label} {...constraint} />
              ))}
            </div>
          </section>

          <section
            className="ledger-section treasury-summary"
            aria-labelledby="treasury-title"
          >
            <div className="ledger-heading">
              <div>
                <span>Treasury</span>
                <h2 id="treasury-title">Demo portfolio snapshot</h2>
              </div>
              <Stack aria-hidden="true" size={22} />
            </div>
            <div className="treasury-priced-total">
              <span>Priced subtotal</span>
              <strong>${pricedSubtotal.toLocaleString("en-US")}</strong>
              <small>Excludes every unpriced balance · {treasury.capturedAt}</small>
            </div>
            <div className="treasury-position-list">
              {treasury.positions.map((position) => (
                <div
                  key={position.key}
                  data-unpriced={position.valuation === null || undefined}
                >
                  <span>
                    <strong>{position.symbol}</strong>
                    <small>{position.amount} units</small>
                  </span>
                  {position.valuation ? (
                    <strong>
                      $
                      {(Number(position.valuation) / 1_000_000).toLocaleString("en-US")}
                    </strong>
                  ) : (
                    <span className="treasury-unpriced">
                      <TrendUp size={14} /> Unpriced
                    </span>
                  )}
                  {position.reason ? <small>{position.reason}</small> : null}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
