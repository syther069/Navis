import Link from "next/link";

import { ProgressiveBlur } from "@/components/motion/progressive-blur";
import { Link000, Link001 } from "@/components/skiper/skiper40";

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
            <Link000 href="/welcome">Overview</Link000>
            <Link000 href="/faq">FAQ</Link000>
            <Link000 href="/start">Get started</Link000>
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
            <Link000 href="/welcome">Overview</Link000>
            <Link000 href="/start">Get started</Link000>
            <Link000 href="/">Workspace</Link000>
            <Link000 href="/agents/atlas">Atlas</Link000>
          </nav>
          <nav aria-label="Evidence">
            <span>Evidence</span>
            <Link000 href="/faq">FAQ</Link000>
            <Link000 href="/disclosures">Disclosures</Link000>
            <Link000 href="/proofs/demo-proof">Demo receipt</Link000>
            <Link001 href={GITHUB_URL}>GitHub</Link001>
          </nav>
          <nav aria-label="Ecosystem">
            <span>Ecosystem</span>
            <Link001 href={SOLANA_URL}>Solana</Link001>
            <Link001 href={METEORA_URL}>Meteora</Link001>
          </nav>
        </div>
        <div className="public-container public-footer-legal">
          <p>Demo decisions are simulations. No mainnet execution is available.</p>
        </div>
      </footer>
    </div>
  );
}
