import Link from "next/link";

import { DevnetPulse } from "@/components/agent/devnet-pulse";

type NavisIntroProps = {
  solanaRpcConfigured: boolean;
  cluster: string;
};

const honestyStamps = ["Demo", "Offchain receipts", "Devnet", "No live execution"];

export function NavisIntro({ solanaRpcConfigured, cluster }: NavisIntroProps) {
  return (
    <section className="route-panel navis-intro" aria-labelledby="navis-intro-title">
      <span className="route-eyebrow">What Navis is</span>
      <h1 id="navis-intro-title">
        A hard stop between AI agents and tokenized stocks on Solana.
      </h1>
      <dl className="navis-intro-lines">
        <div>
          <dt>The problem</dt>
          <dd>
            AI agents are starting to trade tokenized stocks. Nothing forces them to
            stop when a trade breaks a risk limit, and nothing proves afterwards what
            was decided or why.
          </dd>
        </div>
        <div>
          <dt>What Navis does</dt>
          <dd>
            The agent proposes. A deterministic policy decides. The wallet stays the
            only authority that can sign. Every run gets a hash-verifiable receipt.
          </dd>
        </div>
        <div>
          <dt>What you can try now</dt>
          <dd>
            Run a decision for the Atlas demo agent and watch the policy approve or
            reject it, then verify a receipt in the public verifier.
          </dd>
        </div>
      </dl>
      <div className="navis-intro-actions">
        <a className="primary-button" href="#run-title">
          Run a decision
        </a>
        <Link className="secondary-button" href="/proofs/demo-proof">
          Verify a receipt
        </Link>
      </div>
      <div className="navis-intro-footer">
        <ul className="navis-intro-stamps" aria-label="Honesty notes">
          {honestyStamps.map((stamp) => (
            <li key={stamp}>{stamp}</li>
          ))}
        </ul>
        <DevnetPulse configured={solanaRpcConfigured} cluster={cluster} />
      </div>
    </section>
  );
}
