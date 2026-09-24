import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { questions } from "../faq/questions";
import { StatusLabel, type IntegrationStatus } from "../status-label";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Understand NAVIS: agent proposals, deterministic policy, wallet authorization and hash-verifiable receipts, with clear current limitations.",
};

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

export default function WelcomePage() {
  return (
    <>
      <section className="public-hero public-container" aria-labelledby="hero-title">
        <div className="public-hero-content">
          <span className="public-eyebrow">
            <span className="public-eyebrow-dot" /> NAVIS / Public overview
          </span>
          <h1 id="hero-title">
            An agent can propose.
            <br />
            <em>Only you can authorize.</em>
          </h1>
          <p>
            NAVIS is a governed Solana equity-agent workspace. Inspect an Atlas
            proposal, see deterministic policy checks, and verify the resulting
            receipt—without mistaking a demo decision for an executed trade.
          </p>
          <div className="public-actions">
            <Link className="public-button public-button-primary" href="/start">
              Get oriented <span aria-hidden="true">↗</span>
            </Link>
            <Link className="public-button public-button-secondary" href="/">
              Open workspace <span aria-hidden="true">↗</span>
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
        className="public-section public-container public-definition"
        id="what-is-navis"
        aria-labelledby="what-title"
      >
        <div className="public-section-heading">
          <span className="public-eyebrow">01 / The premise</span>
          <h2 id="what-title">
            A decision workspace, <span>not a brokerage.</span>
          </h2>
        </div>
        <div className="public-definition-copy">
          <p>
            NAVIS exists to keep an agent&apos;s analysis separate from authority over a
            wallet. Atlas can form a proposal from market information; fixed policy
            rules evaluate it before anyone considers execution.
          </p>
          <p>
            The current public experience lets you explore fresh Balanced and Oversized
            Atlas demo decisions, read-only PreStocks research, launch preflights and
            hash-verifiable receipts. It does not offer mainnet execution or PreStocks
            trading. PreStocks tokens are not legal shares.
          </p>
        </div>
      </section>

      <section
        className="public-section public-section-surface"
        id="how-it-works"
        aria-labelledby="workflow-title"
      >
        <div className="public-container">
          <div className="public-section-heading public-heading-wide">
            <span className="public-eyebrow">02 / The sequence</span>
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
        id="use-cases"
        aria-labelledby="uses-title"
      >
        <div className="public-section-heading">
          <span className="public-eyebrow">03 / In the workspace</span>
          <h2 id="uses-title">What you can inspect today.</h2>
        </div>
        <div className="public-use-grid">
          <article>
            <span>01 / Evaluate</span>
            <h3>Compare two proposals.</h3>
            <p>
              Run Atlas&apos;s Balanced and Oversized demo scenarios. See which policy
              checks pass or fail and why.
            </p>
            <Link href="/agents/atlas">
              View Atlas <span aria-hidden="true">↗</span>
            </Link>
          </article>
          <article>
            <span>02 / Research</span>
            <h3>Read the market context.</h3>
            <p>
              Inspect read-only PreStocks facts and market-source information. These are
              research inputs, not execution quotes.
            </p>
            <Link href="/markets/launch">
              Explore markets <span aria-hidden="true">↗</span>
            </Link>
          </article>
          <article>
            <span>03 / Verify</span>
            <h3>Check the evidence.</h3>
            <p>
              Open a demo receipt and recompute document hashes in your browser.
              Integrity is not proof of settlement.
            </p>
            <Link href="/proofs/demo-proof">
              Verify demo receipt <span aria-hidden="true">↗</span>
            </Link>
          </article>
        </div>
      </section>

      <section
        className="public-section public-section-surface"
        id="integrations"
        aria-labelledby="integrations-title"
      >
        <div className="public-container">
          <div className="public-section-heading public-heading-wide">
            <span className="public-eyebrow">04 / Integration register</span>
            <h2 id="integrations-title">Connected is not the same as executable.</h2>
            <p>
              These labels describe the scope of the current product, not a promise of
              future availability.
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
        </div>
      </section>

      <section
        className="public-section public-container public-control"
        id="user-control"
        aria-labelledby="control-title"
      >
        <div className="public-section-heading">
          <span className="public-eyebrow">05 / Authority</span>
          <h2 id="control-title">The wallet stays yours.</h2>
          <p>
            Atlas never signs, submits or holds keys. A passing proposal still requires
            you to review and sign any eligible value-moving devnet transaction in your
            wallet.
          </p>
        </div>
        <div className="public-control-list">
          <div>
            <span>01</span>
            <p>Review the proposal and its policy result.</p>
          </div>
          <div>
            <span>02</span>
            <p>Reject or approve in your own wallet if an action is eligible.</p>
          </div>
          <div>
            <span>03</span>
            <p>Inspect the receipt. A demo receipt has no onchain signature.</p>
          </div>
        </div>
      </section>

      <section
        className="public-section public-section-surface"
        id="why-solana"
        aria-labelledby="solana-title"
      >
        <div className="public-container public-solana-layout">
          <div className="public-section-heading">
            <span className="public-eyebrow">06 / Network context</span>
            <h2 id="solana-title">Why Solana?</h2>
          </div>
          <div>
            <p>
              Solana provides the wallet authority, network/cluster boundaries and
              transaction semantics for governed value movement. Those boundaries let
              the product distinguish an unsigned preparation, a signed submission and a
              confirmed transaction.
            </p>
            <p>
              Today the public Atlas demo is offchain. No Solana settlement should be
              inferred from a passing demo verdict or a verified receipt.
            </p>
          </div>
        </div>
      </section>

      <section
        className="public-section public-container"
        id="product"
        aria-labelledby="product-title"
      >
        <div className="public-section-heading public-heading-wide">
          <span className="public-eyebrow">07 / Inside the product</span>
          <h2 id="product-title">The actual workspace.</h2>
          <p>
            Captured from the live NAVIS deployment, not illustrations of a hypothetical
            transaction.
          </p>
        </div>
        <div className="public-gallery">
          {captures.map(({ src, title, caption }, index) => (
            <figure
              key={src}
              className={
                index === 0 ? "public-capture public-capture-feature" : "public-capture"
              }
            >
              <div className="public-capture-frame">
                <Image
                  src={src}
                  width={1440}
                  height={900}
                  alt={`${title} screen in the NAVIS product`}
                  sizes={
                    index === 0
                      ? "(max-width: 760px) 100vw, 1120px"
                      : "(max-width: 760px) 100vw, 550px"
                  }
                />
              </div>
              <figcaption>
                <span>
                  {String(index + 1).padStart(2, "0")} / {title}
                </span>
                <p>{caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section
        className="public-section public-section-surface"
        id="faq"
        aria-labelledby="preview-title"
      >
        <div className="public-container public-preview-layout">
          <div className="public-section-heading">
            <span className="public-eyebrow">08 / Before you proceed</span>
            <h2 id="preview-title">Good questions to ask.</h2>
            <Link className="public-text-link" href="/faq">
              Read all questions <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="public-preview-list">
            {[2, 3, 4, 5, 9].map((index) => (
              <details className="public-faq-item" key={questions[index].question}>
                <summary>
                  <span>{questions[index].question}</span>
                  <span className="public-faq-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{questions[index].answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="public-final public-container" aria-labelledby="final-title">
        <span className="public-eyebrow">09 / Start with the evidence</span>
        <h2 id="final-title">
          See the decision.
          <br />
          <em>Keep the authority.</em>
        </h2>
        <p>
          Explore the demo without connecting a wallet. The onboarding steps are
          optional.
        </p>
        <div className="public-actions">
          <Link className="public-button public-button-primary" href="/start">
            Get started <span aria-hidden="true">↗</span>
          </Link>
          <Link className="public-button public-button-secondary" href="/">
            Open workspace <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </>
  );
}
