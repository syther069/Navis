import Link from "next/link";

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
        <div className="public-container public-footer-inner">
          <span className="public-footer-brand">
            NAVIS <span> / Governed decisions</span>
          </span>
          <p>Demo decisions are simulations. No mainnet execution is available.</p>
          <nav aria-label="Footer navigation">
            <Link href="/welcome">Overview</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/start">Get started</Link>
            <Link href="/">Workspace</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
