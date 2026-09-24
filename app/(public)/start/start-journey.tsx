"use client";

import Link from "next/link";
import { useState } from "react";

import { InfoHint } from "@/components/shared/info-hint";
import type { InfoHintKey } from "@/components/shared/info-hint-content";
import { SolanaWalletProvider } from "@/components/wallet/solana-wallet-provider";
import { WalletControl } from "@/components/wallet/wallet-control";
import type { SolanaCluster } from "@/lib/env-core";

const steps: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  hints: InfoHintKey[];
}[] = [
  {
    title: "Connect wallet",
    description:
      "Connect a compatible browser wallet if you have one; browsing does not require it.",
    href: "/",
    linkLabel: "See the workspace",
    hints: [],
  },
  {
    title: "Understand workspace",
    description:
      "Start at the home screen to see where agents, markets, transactions and proofs live.",
    href: "/",
    linkLabel: "Open workspace home",
    hints: [],
  },
  {
    title: "Inspect market",
    description:
      "Read available market facts as research inputs, not executable quotes.",
    href: "/markets/launch",
    linkLabel: "Explore markets",
    hints: [],
  },
  {
    title: "View Atlas decision",
    description:
      "See how the demo agent forms a proposal without signing or moving funds.",
    href: "/agents/atlas",
    linkLabel: "View Atlas",
    hints: ["atlas", "proposal"],
  },
  {
    title: "Review policy / risk",
    description:
      "Compare the proposal against deterministic rules and their observed values.",
    href: "/agents/atlas/decisions/demo-decision",
    linkLabel: "Inspect demo decision",
    hints: ["policy", "risk"],
  },
  {
    title: "Prepare action",
    description:
      "Inspect preparation and simulation states; neither implies a submitted trade.",
    href: "/markets/launch",
    linkLabel: "See launch preparation",
    hints: ["simulation", "proposal"],
  },
  {
    title: "Approve if required",
    description:
      "Only an eligible value-moving devnet action asks your wallet to approve and sign.",
    href: "/transactions",
    linkLabel: "Review transaction states",
    hints: ["approval"],
  },
  {
    title: "Verify receipt",
    description:
      "Recompute a demo receipt's hashes in your browser; this is not settlement evidence.",
    href: "/proofs/demo-proof",
    linkLabel: "Verify demo proof",
    hints: ["proof"],
  },
];

export function StartJourney({
  cluster,
  authenticationConfigured,
}: {
  cluster: SolanaCluster;
  authenticationConfigured: boolean;
}) {
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState<number[]>([]);

  function goTo(index: number) {
    setVisited((current) =>
      current.includes(active) ? current : [...current, active],
    );
    setActive(Math.max(0, Math.min(steps.length - 1, index)));
  }

  return (
    <div className="public-container public-inner-page public-start">
      <div className="public-page-intro">
        <span className="public-eyebrow">Orientation / 8 optional steps</span>
        <h1>Find your bearings.</h1>
        <p>
          Take the steps in any order. Connecting a wallet is optional; the Atlas demo
          is available without one.
        </p>
      </div>
      <div className="public-start-layout">
        <aside className="public-start-sidebar">
          <span className="public-kicker">Your route</span>
          <p>
            {visited.length} of {steps.length} steps visited
          </p>
          <Link className="public-text-link" href="/">
            Skip to workspace <span aria-hidden="true">↗</span>
          </Link>
        </aside>
        <div className="public-start-main">
          <div className="public-start-list">
            {steps.map((step, index) => (
              <article
                className="public-start-card"
                data-active={active === index || undefined}
                key={step.title}
              >
                <button
                  type="button"
                  className="public-start-card-heading"
                  onClick={() => goTo(index)}
                  aria-expanded={active === index}
                  aria-controls={active === index ? `start-step-${index}` : undefined}
                >
                  <span className="public-start-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{step.title}</span>
                  <span
                    className="public-start-check"
                    aria-label={visited.includes(index) ? "Visited" : undefined}
                  >
                    {visited.includes(index) ? "✓" : active === index ? "−" : "+"}
                  </span>
                </button>
                {active === index ? (
                  <div className="public-start-card-body" id={`start-step-${index}`}>
                    <p>{step.description}</p>
                    {step.hints.length > 0 && (
                      <div className="public-start-hints" aria-label="Concept help">
                        {step.hints.map((hint) => (
                          <span key={hint}>
                            {hint === "atlas"
                              ? "Atlas"
                              : hint === "risk"
                                ? "Risk"
                                : hint.charAt(0).toUpperCase() + hint.slice(1)}{" "}
                            <InfoHint topic={hint} label={`About ${hint}`} />
                          </span>
                        ))}
                      </div>
                    )}
                    {index === 0 && (
                      <div className="public-start-wallet">
                        <SolanaWalletProvider cluster={cluster}>
                          <WalletControl
                            authenticationConfigured={authenticationConfigured}
                          />
                        </SolanaWalletProvider>
                        <span>Wallet not required for the demo.</span>
                      </div>
                    )}
                    <Link className="public-text-link" href={step.href}>
                      {step.linkLabel} <span aria-hidden="true">↗</span>
                    </Link>
                    <div className="public-start-controls">
                      <button
                        type="button"
                        onClick={() => goTo(index - 1)}
                        disabled={index === 0}
                      >
                        Back
                      </button>
                      {index < steps.length - 1 ? (
                        <button type="button" onClick={() => goTo(index + 1)}>
                          Next step <span aria-hidden="true">→</span>
                        </button>
                      ) : (
                        <Link href="/">
                          Open workspace <span aria-hidden="true">↗</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <p className="public-start-note">
            This is an orientation, not an execution checklist. No step automatically
            submits a transaction.
          </p>
        </div>
      </div>
    </div>
  );
}
