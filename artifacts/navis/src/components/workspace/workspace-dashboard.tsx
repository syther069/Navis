import { ArrowRight, Compass, FileCheck2, LineChart, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

import { AssuranceBadge } from "@/components/shared/assurance-badge";
import { ClusterStamp, ModeStamp } from "@/components/shared/domain-primitives";
import { assuranceLevels, describeAssurance } from "@workspace/navis-core/lib/assurance";
import { LANDING_PROOF_POINTS, LANDING_SENTENCE } from "@workspace/navis-core/lib/landing-copy";

import { IntegrationList, MarketSnapshot } from "./context-panel";
import { DecisionBrief, DecisionSummaryBrief } from "./decision-brief";
import { shortHash } from "./lifecycle";
import { EmptyNote, ErrorState, SectionHead, SkeletonRows } from "./primitives";
import { RecentDecisions } from "./recent-decisions";
import type {
  DecisionRunResult,
  Loadable,
  PublicCapabilities,
  StoredDecisionSummary,
  WorkspaceSession,
} from "./types";

export type WorkspaceDashboardProps = {
  capabilities: PublicCapabilities;
  session: WorkspaceSession;
  /** `GET /api/workspace?path=/decisions` → `stored`. */
  decisions: Loadable<readonly StoredDecisionSummary[]>;
  /** Optional full run for the newest stored decision. */
  latestRun?: Loadable<DecisionRunResult | null>;
};

const authorityChain = [
  { who: "Atlas", does: "proposes" },
  { who: "Policy", does: "constrains" },
  { who: "You", does: "approve" },
  { who: "Wallet", does: "signs" },
  { who: "Solana", does: "confirms" },
  { who: "Receipt", does: "proves" },
] as const;

const destinations = [
  {
    icon: Compass,
    href: "/agents/atlas",
    title: "Atlas",
    body: "Decision records, and a clearly labelled demo run.",
  },
  {
    icon: Plus,
    href: "/agents/new",
    title: "Create an agent",
    body: "A mandate and risk policy for a wallet you control.",
  },
  {
    icon: LineChart,
    href: "/markets/launch",
    title: "Markets Launch",
    body: "ClawPump, Meteora DBC profiles and the PreStocks catalogue.",
  },
  {
    icon: FileCheck2,
    href: "/proofs/demo-proof",
    title: "Verify a demo receipt",
    body: "A prepared, fictional receipt for trying the verifier.",
    demo: true,
  },
] as const;

function executionSentence(capabilities: PublicCapabilities) {
  if (capabilities.mode === "demo")
    return "Demo mode: decisions are simulated and receipts stay offchain.";
  const flagged =
    (capabilities.mode === "devnet" && capabilities.devnetExecutionAvailable) ||
    (capabilities.mode === "mainnet" && capabilities.mainnetExecutionAvailable);
  return flagged
    ? `${capabilities.mode} mode: execution flags allow wallet-signed transactions on ${capabilities.cluster}. Each needs your signature.`
    : `${capabilities.mode} mode: execution flags are off, so runs stay simulated.`;
}

export function WorkspaceDashboard({
  capabilities,
  session,
  decisions,
  latestRun,
}: WorkspaceDashboardProps) {
  const persistenceReady = capabilities.persistenceConfigured;
  const newest =
    decisions.state === "ready" && decisions.data.length > 0 ? decisions.data[0] : null;
  const run = latestRun?.state === "ready" ? latestRun.data : null;

  let lead: ReactNode;
  if (!persistenceReady) {
    lead = (
      <EmptyNote kind="unavailable" title="Decisions are not stored in this instance" testId="lead-unavailable" action={
        <Link className="secondary-button" href="/agents/atlas" data-testid="link-open-atlas">
          Open Atlas <ArrowRight aria-hidden="true" size={15} />
        </Link>
      }>
        There is no database, so there is no decision history to summarise. Atlas can still
        produce a demo simulation that is shown inline and not kept.
      </EmptyNote>
    );
  } else if (decisions.state === "loading" || latestRun?.state === "loading") {
    lead = (
      <div className="ws-brief" aria-busy="true">
        <SkeletonRows rows={5} label="Loading the latest decision" />
      </div>
    );
  } else if (decisions.state === "error") {
    lead = (
      <ErrorState
        title="The latest decision could not be loaded"
        error={decisions.error}
        retry={decisions.retry}
        testId="lead-error"
      />
    );
  } else if (run) {
    lead = <DecisionBrief run={run} />;
  } else if (newest) {
    lead = (
      <>
        {latestRun?.state === "error" ? (
          <ErrorState
            title="The latest decision record could not be loaded"
            error={`${latestRun.error} Only the ledger summary is shown below; policy, approval and proof details are unavailable until the record loads.`}
            retry={latestRun.retry}
            testId="lead-detail-error"
          />
        ) : null}
        <DecisionSummaryBrief decision={newest} />
      </>
    );
  } else {
    lead = (
      <EmptyNote
        title="Nothing has been proposed yet"
        testId="lead-empty"
        action={
          <Link className="primary-button" href="/agents/atlas" data-testid="link-open-atlas">
            Open Atlas <ArrowRight aria-hidden="true" size={15} />
          </Link>
        }
      >
        No decision is stored. When Atlas proposes, the proposal, its policy verdict, your
        approval state and its receipt will be summarised here.
      </EmptyNote>
    );
  }

  return (
    <div className="ws-page" data-page="dashboard">
      <header className="ws-page-head">
        <div className="ws-page-title">
          <span className="ws-eyebrow">Overview</span>
          <h1>Decisions, limits and proof</h1>
          <p className="ws-lede" data-testid="landing-sentence">
            {LANDING_SENTENCE}
          </p>
        </div>
        <div className="ws-statusbar" role="status" data-testid="landing-mode-banner">
          <span className="ws-statusbar-stamps">
            <ModeStamp mode={capabilities.mode} />
            <ClusterStamp cluster={capabilities.cluster} />
          </span>
          <span className="ws-statusbar-copy">{executionSentence(capabilities)}</span>
          <span className="ws-statusbar-session" data-testid="text-session-state">
            {session ? (
              <>
                Wallet <code>{shortHash(session.wallet, 4, 4)}</code> authenticated
              </>
            ) : (
              "No wallet authenticated"
            )}
          </span>
        </div>
      </header>

      <ol className="ws-chain" aria-label="Who holds authority">
        {authorityChain.map((step) => (
          <li key={step.who}>
            <strong>{step.who}</strong>
            <span>{step.does}</span>
          </li>
        ))}
      </ol>

      <div className="ws-dash-grid">
        <div className="ws-dash-main">
          <section className="ws-section" aria-labelledby="lead-title">
            <SectionHead
              id="lead-title"
              eyebrow="Happening now"
              title="Latest decision"
              hint="atlas"
              hintLabel="About Atlas"
            />
            {lead}
          </section>

          <section className="ws-section" aria-labelledby="activity-title">
            <SectionHead
              id="activity-title"
              eyebrow="Recent activity"
              title="Decision ledger"
              aside={
                <Link className="text-link" href="/decisions" data-testid="link-all-decisions">
                  All decisions <ArrowRight aria-hidden="true" size={14} />
                </Link>
              }
            />
            <RecentDecisions
              decisions={decisions}
              persistenceReady={persistenceReady}
              emptyAction={
                <Link className="secondary-button" href="/agents/atlas" data-testid="link-empty-atlas">
                  Open Atlas
                </Link>
              }
            />
            <p className="ws-caption">
              {session
                ? "Public Atlas records and decisions stored for your wallet, newest first."
                : "Public Atlas records, newest first. Authenticate a wallet to include your own decisions."}{" "}
              <Link className="text-link" href="/transactions">
                Execution attempts are in Transactions.
              </Link>
            </p>
          </section>
        </div>

        <aside className="ws-dash-side" aria-label="Context">
          <section className="ws-section ws-side-block" aria-labelledby="context-title">
            <SectionHead
              id="context-title"
              eyebrow="Context"
              title="Execution and integrations"
              hint="context"
              hintLabel="About integration status"
            />
            <IntegrationList capabilities={capabilities} />
          </section>

          <section className="ws-section ws-side-block" aria-labelledby="market-title">
            <SectionHead
              id="market-title"
              eyebrow="Market"
              title="Inputs behind the latest decision"
              hint="marketInputs"
            />
            {!persistenceReady ? (
              <EmptyNote kind="unavailable" title="No stored market inputs" testId="market-snapshot-unavailable">
                Market inputs are stored with each decision. This instance does not store
                decisions.
              </EmptyNote>
            ) : decisions.state === "loading" || latestRun?.state === "loading" ? (
              <SkeletonRows rows={3} label="Loading market inputs" />
            ) : decisions.state === "error" || latestRun?.state === "error" ? (
              <EmptyNote kind="unavailable" title="Market inputs unavailable" testId="market-snapshot-error">
                The latest decision record could not be loaded, so its market inputs are not
                shown. This is not the same as having no market data.
              </EmptyNote>
            ) : newest && !run ? (
              <EmptyNote kind="unavailable" title="Market inputs not loaded" testId="market-snapshot-not-loaded">
                Open the latest decision record to see the assets and prices it used.
              </EmptyNote>
            ) : (
              <MarketSnapshot run={run} />
            )}
          </section>

          <nav className="ws-section ws-side-block" aria-labelledby="go-title">
            <SectionHead id="go-title" eyebrow="Next" title="Where to go" />
            <ul className="ws-destinations">
              {destinations.map(({ icon: Icon, href, title, body, ...rest }) => (
                <li key={href}>
                  <Link className="ws-destination" href={href} data-testid={`link-destination-${href.replaceAll("/", "-").slice(1)}`}>
                    <Icon aria-hidden="true" size={17} />
                    <span>
                      <strong>
                        {title}
                        {"demo" in rest ? <span className="ws-tag" data-kind="fixture">Demo</span> : null}
                      </strong>
                      <small>{body}</small>
                    </span>
                    <ArrowRight className="ws-destination-go" aria-hidden="true" size={15} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>

      <section className="ws-section ws-guarantees" aria-labelledby="guarantees-title">
        <SectionHead
          id="guarantees-title"
          eyebrow="Guarantees"
          title="What Navis enforces"
          hint="assurance"
          hintLabel="About assurance levels"
        />
        <div className="ws-guarantee-grid">
          <ol className="ws-points">
            {LANDING_PROOF_POINTS.map((point, index) => (
              <li key={point.id}>
                <span className="ws-point-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{point.title}</h3>
                  <p>{point.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ol className="ws-ladder" aria-label="Assurance levels">
            {assuranceLevels.map((level) => {
              const assurance = describeAssurance(
                level,
                level === "offchain_integrity" ? "demo_simulation" : "live_onchain",
              );
              return (
                <li key={level} data-level={level}>
                  <AssuranceBadge assurance={assurance} compact />
                  <p>{assurance.explanation}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}
