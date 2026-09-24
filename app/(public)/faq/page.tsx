import type { Metadata } from "next";
import Link from "next/link";

import { questions } from "./questions";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about NAVIS, Atlas, wallet authority, simulation and current integration limits.",
};

export default function FaqPage() {
  return (
    <div className="public-container public-inner-page">
      <div className="public-page-intro">
        <span className="public-eyebrow">Reference / 01</span>
        <h1>Questions, with boundaries.</h1>
        <p>
          What you can inspect now, what remains simulated, and what NAVIS does not do.
        </p>
      </div>
      <div className="public-faq-layout">
        <aside className="public-faq-aside">
          <span className="public-kicker">Before you start</span>
          <p>
            Mainnet execution is blocked. Demo receipts do not prove onchain settlement.
          </p>
          <Link className="public-text-link" href="/start">
            Explore the workspace <span aria-hidden="true">↗</span>
          </Link>
        </aside>
        <div className="public-faq-list">
          {questions.map(({ question, answer }, index) => (
            <details key={question} className="public-faq-item">
              <summary>
                <span className="public-faq-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{question}</span>
                <span className="public-faq-plus" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
      <div className="public-end-note">
        <span>Ready to look inside?</span>
        <Link href="/">
          Open workspace <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}
