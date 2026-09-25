import type { Metadata } from "next";
import Link from "next/link";

import { FAQ_ITEMS } from "@/components/landing/faq-data";
import { CaptureDeck } from "@/components/motion/capture-deck";
import { StatusLabel, type IntegrationStatus } from "../status-label";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Navis is a governed Solana equity-agent workspace: observe, analyze, decide, prepare execution, and prove it.",
};

const loop = [
  {
    id: "observe",
    title: "Observe",
    copy: "Read portfolio state, catalogue facts, and network posture. Nothing is invented to fill a gap.",
  },
  {
    id: "analyze",
    title: "Analyze",
    copy: "Atlas forms a proposal from those facts against a written mandate.",
  },
  {
    id: "decide",
    title: "Decide",
    copy: "Deterministic policy checks the proposal. One failed rule stops the run.",
  },
  {
    id: "execute",
    title: "Execute",
    copy: "Preparation can reach a wallet. The agent never signs. Mainnet broadcast is blocked.",
  },
  {
    id: "prove",
    title: "Prove",
    copy: "A hash-verifiable receipt binds inputs, checks, action, and whatever evidence actually exists.",
  },
] as const;

const lifecycle = [
  {
    title: "Portfolio detected",
    copy: "Balances and research facts enter the run as a snapshot.",
  },
  {
    title: "Market conditions analyzed",
    copy: "Atlas reads the snapshot against its mandate.",
  },
  {
    title: "Risk evaluated",
    copy: "Fixed policy rules measure size, reserve, position, and slippage.",
  },
  {
    title: "Decision generated",
    copy: "Approve or reject is a code result, not a chatbot verdict.",
  },
  {
    title: "Execution prepared",
    copy: "Eligible paths can prepare a transaction. Demo runs stay simulated.",
  },
  {
    title: "Proof recorded",
    copy: "The receipt is inspectable. Settlement is claimed only when a signature exists.",
  },
] as const;

const workflow = [
  { title: "Market Data", copy: "Read-only research facts enter the decision." },
  { title: "Atlas", copy: "The demo agent forms a proposed action." },
  { title: "Policy / Risk", copy: "Code tests the proposal against fixed limits." },
  { title: "Proposal", copy: "The intended action is shown for review." },
  { title: "User Approval", copy: "You decide whether to proceed." },
  {
    title: "Wallet Signature",
    copy: "Your wallet, not Atlas, authorizes value movement.",
  },
  { title: "Onchain Action", copy: "Gated devnet path only; mainnet is blocked." },
  { title: "Proof", copy: "A receipt binds decision inputs and results by hash." },
] as const;

const integrations: {
  name: string;
  status: IntegrationStatus;
  description: string;
}[] = [
  {
    name: "Solana wallet adapter",
    status: "CONNECTED",
    description:
      "Connects compatible browser wallets; actual extension signing is not verified in the public demo.",
  },
  {
    name: "PreStocks market data",
    status: "READ-ONLY",
    description:
      "Validated catalogue and research inputs. No PreStocks buy, sell or value movement.",
  },
  {
    name: "Meteora DBC",
    status: "DEVNET",
    description:
      "Config preview, pool reads, preparation and simulation, with wallet-signed devnet submission where the deployment enables it. No confirmed pool is evidenced yet.",
  },
  {
    name: "Solana devnet execution",
    status: "DEVNET",
    description:
      "Enabled on the production deployment for wallet-signed devnet transactions after policy and simulation pass. Devnet tokens carry no real value.",
  },
  {
    name: "Solana mainnet execution",
    status: "BLOCKED",
    description: "An unconditional code hard-stop prevents mainnet broadcast.",
  },
  {
    name: "ClawPump",
    status: "BLOCKED",
    description:
      "Provider verification and preflight run. Funded launch is unsupported; no launch is submitted.",
  },
  {
    name: "Receipt onchain anchoring",
    status: "PLANNED",
    description: "Not implemented. Receipts are offchain and hash-verified today.",
  },
  {
    name: "AI provider",
    status: "SIMULATION",
    description: "Public demo decisions use a deterministic demo provider.",
  },
  {
    name: "Database",
    status: "CONNECTED",
    description:
      "Persistence is implemented; without a database connection, runs are bounded memory-only.",
  },
];

const captures = [
  {
    src: "/product/workspace.png",
    title: "Workspace",
    caption:
      "The workspace home shows the available navigation and the current execution posture.",
  },
  {
    src: "/product/atlas-decision.png",
    title: "Atlas decision",
    caption: "A demo proposal with a deterministic policy verdict and visible checks.",
  },
  {
    src: "/product/markets-launch.png",
    title: "Markets / Launch",
    caption: "Provider preflight, Meteora preparation and explicit launch boundaries.",
  },
  {
    src: "/product/transactions.png",
    title: "Transactions",
    caption:
      "The transaction ledger distinguishes recorded states from unavailable settlement.",
  },
  {
    src: "/product/proof-receipt.png",
    title: "Proof receipt",
    caption:
      "Browser-verifiable document hashes; this is not proof of onchain settlement.",
  },
] as const;

const proofChain = [
  { label: "Decision", copy: "What was proposed, and whether policy approved it." },
  { label: "Reason", copy: "The mandate thesis and the check that passed or failed." },
  { label: "Inputs", copy: "Snapshot facts the run actually used." },
  { label: "Action", copy: "The intended movement, if any, after policy." },
  {
    label: "Transaction",
    copy: "Present only when a wallet signed and Navis stored evidence.",
  },
  { label: "Proof", copy: "Hashes you can recompute in the browser." },
] as const;

export default function WelcomePage() {
  return (
    <>
      <section className="public-hero public-container" aria-labelledby="hero-title">
        <div className="public-hero-content">
          <span className="public-eyebrow">
            <span className="public-eyebrow-dot" /> NAVIS / Public overview
          </span>
          <h1 id="hero-title">
            Your treasury stays yours.
            <br />
            The agent stays accountable.
          </h1>
          <p>
            Navis is a governed Solana equity-agent workspace. Atlas can reason over
            portfolio state and prepare an action. Deterministic policy can stop it.
            Only your wallet can authorize value movement, and every run leaves a
            receipt you can inspect.
          </p>
          <div className="public-actions">
            <Link className="public-button public-button-primary" href="/start">
              Launch Navis <span aria-hidden="true">↗</span>
            </Link>
            <Link
              className="public-button public-button-secondary"
              href="/agents/atlas"
            >
              Explore the agent <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <span className="public-hero-disclosure">
            Demo execution is simulated · Mainnet execution is blocked
          </span>
        </div>
        <div
          className="public-hero-graphic"
          aria-label="Agent proposal passes through policy and user authority before any onchain action"
        >
          <div className="public-graphic-top">
            <span>DECISION PATH</span>
            <span>01 / 03</span>
          </div>
          <div className="public-graphic-flow">
            <div>
              <span className="public-graphic-step">01 &nbsp; INTENT</span>
              <strong>Atlas proposes</strong>
              <small>Agent has no signing authority</small>
            </div>
            <span className="public-graphic-connector" aria-hidden="true">
              ↓
            </span>
            <div>
              <span className="public-graphic-step">02 &nbsp; BOUNDARY</span>
              <strong>Policy evaluates</strong>
              <small>Failed checks stop the proposal</small>
            </div>
            <span className="public-graphic-connector" aria-hidden="true">
              ↓
            </span>
            <div>
              <span className="public-graphic-step">03 &nbsp; AUTHORITY</span>
              <strong>You approve</strong>
              <small>Wallet signature required for value movement</small>
            </div>
          </div>
          <div className="public-graphic-bottom">
            <span className="public-graphic-indicator" /> No autonomous execution
          </div>
        </div>
      </section>

      <section
        className="public-section public-section-surface"
        id="loop"
        aria-labelledby="loop-title"
      >
        <div className="public-container">
          <div className="public-section-heading public-heading-wide">
            <span className="public-eyebrow">How Navis works</span>
            <h2 id="loop-title">Observe, then prove.</h2>
            <p>
              Intelligence is useful only when every step is visible. This is the
              product loop, not a promise of unsupervised trading.
            </p>
          </div>
          <ol className="public-loop" aria-label="Navis agent loop">
            {loop.map((step, index) => (
              <li key={step.id}>
                <span className="public-loop-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="public-section public-container"
        id="lifecycle"
        aria-labelledby="lifecycle-title"
      >
        <div className="public-section-heading">
          <span className="public-eyebrow">Decision lifecycle</span>
          <h2 id="lifecycle-title">
            One run, <span>end to end.</span>
          </h2>
        </div>
        <ol className="public-lifecycle" aria-label="Illustrative decision lifecycle">
          {lifecycle.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="public-workflow-note">
          Illustrative of the product sequence. Live Atlas runs use the facts they
          actually fetched; demo receipts are simulations.
        </p>
      </section>

      <section
        className="public-section public-section-surface"
        id="how-it-works"
        aria-labelledby="workflow-title"
      >
        <div className="public-container">
          <div className="public-section-heading public-heading-wide">
            <span className="public-eyebrow">The sequence</span>
            <h2 id="workflow-title">How a decision moves.</h2>
            <p>
              Each boundary is visible. A passed policy check is not a wallet signature
              or settlement.
            </p>
          </div>
          <ol className="public-workflow" aria-label="NAVIS decision sequence">
            {workflow.map((step, index) => (
              <li
                key={step.title}
                className={index === 6 ? "public-workflow-gated" : ""}
              >
                <span className="public-workflow-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
          <p className="public-workflow-note">
            <span aria-hidden="true">⊘</span> The public demo stops at simulation and an
            offchain proof receipt. Devnet broadcast is gated; mainnet broadcast is
            blocked.
          </p>
        </div>
      </section>

      <section
        className="public-section public-container"
        id="execution"
        aria-labelledby="execution-title"
      >
        <div className="public-section-heading">
          <span className="public-eyebrow">Onchain execution</span>
          <h2 id="execution-title">
            Intelligence reaches the chain <span>only through a wallet.</span>
          </h2>
        </div>
        <div className="public-definition-copy">
          <p>
            Navis connects Atlas to Solana as infrastructure: wallet adapter,
            transaction preparation, optional gated devnet submission, and verification
            of whatever evidence was stored. The agent never holds keys.
          </p>
          <p>
            Today the public Atlas demo is offchain. A passing demo verdict or a
            verified receipt is not Solana settlement.
          </p>
        </div>
      </section>

      <section
        className="public-section public-section-surface"
        id="proof"
        aria-labelledby="proof-title"
      >
        <div className="public-container">
          <div className="public-section-heading public-heading-wide">
            <span className="public-eyebrow">Transparency</span>
            <h2 id="proof-title">Proof is inspectable.</h2>
            <p>
              Human-readable first. Technical hashes second. Nothing is upgraded beyond
              the evidence on the record.
            </p>
          </div>
          <ol className="public-proof-chain" aria-label="Proof inspection order">
            {proofChain.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <p>{item.copy}</p>
              </li>
            ))}
          </ol>
          <Link className="public-text-link" href="/proofs/demo-proof">
            Open the demo receipt <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section
        className="public-section public-container"
        id="integrations"
        aria-labelledby="integrations-title"
      >
        <div className="public-section-heading public-heading-wide">
          <span className="public-eyebrow">Supported infrastructure</span>
          <h2 id="integrations-title">Connected is not the same as executable.</h2>
          <p>
            Only integrations that exist in this repository. Labels describe current
            scope, not a roadmap.
          </p>
        </div>
        <div className="public-integration-list">
          {integrations.map(({ name, status, description }) => (
            <div className="public-integration-row" key={name}>
              <h3>{name}</h3>
              <StatusLabel status={status} />
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="public-section public-section-surface"
        id="product"
        aria-labelledby="product-title"
      >
        <div className="public-container">
          <div className="public-section-heading public-heading-wide">
            <span className="public-eyebrow">Inside the product</span>
            <h2 id="product-title">The actual workspace.</h2>
            <p>
              Captured from the live NAVIS deployment, not illustrations of a
              hypothetical transaction.
            </p>
          </div>
          <CaptureDeck captures={captures} />
        </div>
      </section>

      <section
        className="public-section public-container"
        id="faq"
        aria-labelledby="preview-title"
      >
        <div className="public-preview-layout">
          <div className="public-section-heading">
            <span className="public-eyebrow">Before you proceed</span>
            <h2 id="preview-title">Good questions to ask.</h2>
            <Link className="public-text-link" href="/faq">
              Read all questions <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="public-preview-list">
            {[2, 3, 4, 5, 9].map((index) => (
              <details className="public-faq-item" key={FAQ_ITEMS[index].question}>
                <summary>
                  <span>{FAQ_ITEMS[index].question}</span>
                  <span className="public-faq-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{FAQ_ITEMS[index].answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="public-final public-container" aria-labelledby="final-title">
        <span className="public-eyebrow">Start with the evidence</span>
        <h2 id="final-title">
          Let the agent handle the analysis.
          <br />
          Keep the authority.
        </h2>
        <p>
          Explore the demo without connecting a wallet. The onboarding steps are
          optional.
        </p>
        <div className="public-actions">
          <Link className="public-button public-button-primary" href="/">
            Open workspace <span aria-hidden="true">↗</span>
          </Link>
          <Link className="public-button public-button-secondary" href="/agents/atlas">
            Explore the agent <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </>
  );
}
