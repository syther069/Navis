import Link from "next/link";

export const PERSISTENT_RUNS_NOTICE = {
  eyebrow: "Fresh decisions",
  title: "Not available for live-mode agents yet",
  body: "Fresh decisions run only for demo-mode agents. A devnet or mainnet agent needs a real treasury snapshot and live market data before every fact the policy checks (reserve, turnover, freshness, liquidity) is present, so Navis will not run a decision it cannot fully check.",
  linkLabel: "Open the Atlas demo",
  href: "/agents/atlas",
} as const;

export function PersistentRunsNotice() {
  return (
    <section
      className="route-panel route-panel-muted"
      data-testid="persistent-runs-notice"
    >
      <span className="route-eyebrow">{PERSISTENT_RUNS_NOTICE.eyebrow}</span>
      <h2>{PERSISTENT_RUNS_NOTICE.title}</h2>
      <p>{PERSISTENT_RUNS_NOTICE.body}</p>
      <Link className="secondary-button" href={PERSISTENT_RUNS_NOTICE.href}>
        {PERSISTENT_RUNS_NOTICE.linkLabel}
      </Link>
    </section>
  );
}
