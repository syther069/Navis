import Link from "next/link";

const GITHUB_URL = "https://github.com/syther069/Navis";
const SOLANA_URL = "https://solana.com";
const METEORA_URL = "https://www.meteora.ag";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site">
      <a className="skip-link" href="#public-main">
        Skip to content
      </a>
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
            <Link href="/welcome">Overview</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/start">Get started</Link>
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
            <Link href="/welcome">Overview</Link>
            <Link href="/start">Get started</Link>
            <Link href="/">Workspace</Link>
            <Link href="/agents/atlas">Atlas</Link>
          </nav>
          <nav aria-label="Evidence">
            <span>Evidence</span>
            <Link href="/faq">FAQ</Link>
            <Link href="/disclosures">Disclosures</Link>
            <Link href="/proofs/demo-proof">Demo receipt</Link>
            <a href={GITHUB_URL} rel="noreferrer" target="_blank">
              GitHub
            </a>
          </nav>
          <nav aria-label="Ecosystem">
            <span>Ecosystem</span>
            <a href={SOLANA_URL} rel="noreferrer" target="_blank">
              Solana
            </a>
            <a href={METEORA_URL} rel="noreferrer" target="_blank">
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
