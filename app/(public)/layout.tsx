import Link from "next/link";

import { CssLink } from "@/components/motion/css-link";
import { ProgressiveBlur } from "@/components/motion/progressive-blur";

const GITHUB_URL = "https://github.com/syther069/Navis";
const SOLANA_URL = "https://solana.com";
const METEORA_URL = "https://www.meteora.ag";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site">
      <a className="skip-link" href="#public-main">
        Skip to content
      </a>
      <ProgressiveBlur position="top" height="4.5rem" />
      <header className="public-header">
        <div className="public-header-inner">
          <Link
            className="brand-lockup public-brand"
            href="/welcome"
            aria-label="NAVIS overview"
          >
            <span className="bearing-mark" aria-hidden="true">
              <span />
            </span>
            <span>NAVIS</span>
          </Link>
          <nav className="public-nav" aria-label="Public navigation">
            <CssLink href="/welcome" roll>
              Overview
            </CssLink>
            <CssLink href="/faq" roll>
              FAQ
            </CssLink>
            <CssLink href="/start" roll>
              Get started
            </CssLink>
          </nav>
          <Link className="public-header-action" href="/">
            Open workspace <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <main id="public-main">{children}</main>
      <footer className="public-footer">
        <div className="public-container public-footer-grid">
          <div className="public-footer-brand-block">
            <span className="public-footer-brand">
              NAVIS <span>/ Governed decisions</span>
            </span>
            <p>
              A Solana equity-agent workspace that keeps proposal, policy, wallet
              authority, and proof on separate rails. Built for the Stocklana hackathon.
            </p>
          </div>
          <nav aria-label="Product">
            <span>Product</span>
            <CssLink href="/welcome">Overview</CssLink>
            <CssLink href="/start">Get started</CssLink>
            <CssLink href="/">Workspace</CssLink>
            <CssLink href="/agents/atlas">Atlas</CssLink>
          </nav>
          <nav aria-label="Evidence">
            <span>Evidence</span>
            <CssLink href="/faq">FAQ</CssLink>
            <CssLink href="/disclosures">Disclosures</CssLink>
            <CssLink href="/proofs/demo-proof">Demo receipt</CssLink>
            <a
              className="navis-css-link"
              href={GITHUB_URL}
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </nav>
          <nav aria-label="Ecosystem">
            <span>Ecosystem</span>
            <a
              className="navis-css-link"
              href={SOLANA_URL}
              rel="noreferrer"
              target="_blank"
            >
              Solana
            </a>
            <a
              className="navis-css-link"
              href={METEORA_URL}
              rel="noreferrer"
              target="_blank"
            >
              Meteora
            </a>
          </nav>
        </div>
        <div className="public-container public-footer-legal">
          <p>Demo decisions are simulations. No mainnet execution is available.</p>
        </div>
      </footer>
    </div>
  );
}
