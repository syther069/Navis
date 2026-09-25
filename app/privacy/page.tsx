import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy", description: "What information the Navis prototype handles and what it never stores." };

const items = [
  ["Information handled", "Depending on deployment configuration, Navis may handle a wallet public key, wallet-authentication nonce hashes, session records, agent configuration, policy and strategy versions, decisions, execution attempts, request metadata, and proof receipts."],
  ["Wallet and blockchain information", "Public wallet addresses and public transaction evidence are not secret. Blockchain data is public and replicated. Navis does not request or store private keys or seed phrases."],
  ["How information is used", "Information is used to authenticate a wallet session, scope records to the wallet that created them, run the selected workflow, persist decision evidence, and protect the service from abuse."],
  ["Third-party infrastructure", "The product can request data from configured infrastructure such as Solana RPC, PreStocks, Meteora, and ClawPump. Those services have their own terms, privacy practices, and retention."],
  ["Retention and security", "Persisted records remain subject to the configured database and deployment lifecycle. Session expiry and revocation controls are used where configured. No security certification or guarantee is claimed."],
  ["Your choices", "You can disconnect your wallet and stop using the application. Some records may be retained for integrity, abuse prevention, or because they are public blockchain data. This is product guidance, not legal advice."],
] as const;

export default function PrivacyPage() {
  return <div className="public-site"><header className="public-header"><div className="public-header-inner"><Link className="brand-lockup public-brand" href="/welcome"><span className="bearing-mark" aria-hidden="true"><span /></span><span>NAVIS</span></Link><nav className="public-nav" aria-label="Public navigation"><Link href="/welcome">Overview</Link><Link href="/docs">Docs</Link><Link href="/faq">FAQ</Link></nav><Link className="public-header-action" href="/">Open workspace <span aria-hidden="true">↗</span></Link></div></header><main className="public-container public-inner-page privacy-page"><header className="public-page-intro"><span className="public-eyebrow">NAVIS / Privacy</span><h1>Clear about the data the prototype touches.</h1><p>This plain-language overview reflects the current hackathon application. It does not claim a legal entity, certification, or data practice that is not established by the deployment.</p></header><div className="privacy-list">{items.map(([title, body], index) => <section className="privacy-item" key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{title}</h2><p>{body}</p></div></section>)}</div><p className="public-end-note"><span>Questions about the product boundary?</span><Link href="/disclosures">Read risk disclosures ↗</Link></p></main></div>;
}
