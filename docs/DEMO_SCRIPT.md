# Navis Demo Script

This walkthrough is the technical-video source and must remain within five minutes. Prepare a separate pitch edit no longer than three minutes (landing screen, one Balanced run, one Oversized run with the "Why this failed" panel, the proof page).

Verified on the public site: the landing screen, the agent list, the recorded deterministic Atlas walkthrough, the fresh **Run new decision** panel on the PreStocks universe (Balanced approved, Oversized rejected, receipt verified in the browser), the proof verifier, Markets Launch with both Meteora profiles and the PreStocks research view, and real 404s for unknown ids. Narrate those. Do not narrate persistence, on-chain activity or sponsor transactions on the public site; none exist there.

Record from a clean browser against https://navis-gilt.vercel.app.

## 0:00–0:30 — Problem and wedge

Open `/` (the landing screen).

Read the one sentence on screen: "Navis lets an AI equity agent propose Solana actions, but only deterministic policy checks and wallet approval can turn those proposals into verifiable receipts."

Show:

- Mode and cluster banner (demo, devnet).
- The three proof points: the agent cannot bypass policy; demo and live evidence are labelled differently; wallet approval remains required for value movement.
- The assurance model: offchain integrity, wallet authorization, onchain settlement. Say that the public demo never leaves the first level.

Click **Open the Atlas demo** (`/agents/atlas`).

Say: Navis is a governed Solana equity-agent workspace. The point is not an AI stock-tip chatbot; it is a capital-bearing mandate with visible rules, wallet authority, and proof.

Show:

- Demo mode stamp and the intro card (what Navis is, run a decision, verify a receipt, no live execution).
- Atlas mandate, constraint ledger, demo portfolio snapshot.

## 0:30–1:30 — Decision and policy proof

In the **Run new decision** panel leave the asset universe on **PreStocks universe**, choose **Balanced** and press **Run decision**, then switch to **Oversized** and run again.

Show:

- Balanced: Approved, 10 of 11 checks passed and 1 warned (PreStocks publishes no liquidity figure, so the liquidity rule warns instead of inventing a number). Fresh receipt hash; "Receipt verified" after pressing **Verify receipt**. The assurance badge reads "Offchain integrity" and "Demo simulation".
- The PreStocks facts under each check (allowlist from the catalogue contract addresses, trade value at the catalogue token price, read time as data age) and the research table under the result: premium or discount to mark, valuation gap, allocation impact.
- Oversized: Rejected on max trade bps and min reserve bps; still a valid receipt. The "Why this failed" panel names the checks that exceeded their limits.
- The persistence note: kept in memory for this server instance only. There is no detail link for in-memory runs on the public site; do not go looking for one.

Then click **Inspect decision** on the recorded example (`/agents/atlas/decisions/demo-decision`) and show the deterministic proposal, policy checks and hash, with no explorer link for the simulated receipt.

Say: The AI/provider can propose, but deterministic Navis code decides whether a transition is allowed. Demo mode cannot become a real-looking onchain claim.

## 1:30–2:15 — Receipt verification and owner agents

Open the linked proof receipt (`/proofs/demo-proof`).

Show:

- Decision hash, strategy hash, risk-policy hash, receipt hash verification.
- Assurance badge: offchain integrity, demo simulation.
- "Why this passed" panel with every policy check, observed value and limit.
- Copyable evidence fields.

Say: A judge can verify the receipt from a clean browser. If a real signature existed, it would appear here with cluster and explorer evidence; this demo receipt intentionally has none.

Open `/agents` and `/agents/new` briefly.

Say: Owners define their own mandates. With a database and a wallet session, each demo run for an owner agent is persisted as a snapshot, decision, policy evaluation, simulated execution attempt and proof receipt in one transaction, and the decision and proof pages are owner-scoped. On the public site this needs a connected wallet; sign in, create an agent and run Balanced to see the persisted decision and its detail link.

## 2:15–3:20 — Sponsor market surfaces

Open `/markets/launch`.

Show:

- ClawPump: the explicit "Not configured" state card (a failed provider call would show "Unavailable"). Say that Navis supports preflight only.
- Meteora DBC: the two server-approved quote profiles. `navis-equity-v1` (wrapped SOL, available on devnet) and `navis-stock-exposure-v1` (quoted in a PreStocks exposure token, mainnet only, gated on the Meteora token badge, unavailable on devnet with no substitute mint). Program, market caps, threshold, fees, LP distribution.
- Transaction builder copy: prepare before sign, simulate before submit, submit before confirm; broadcast hard-blocked.
- PreStocks research view: catalogue read time, source URL, premium or discount, valuation gap, supply; the economic-exposure disclosure and the absence of any trading path.

Say: Navis separates ClawPump, Meteora and PreStocks evidence so one sponsor claim cannot be confused for another.

## 3:20–4:00 — Capability, disclosure, and transaction status

Open `/settings`, `/disclosures`, then `/transactions`.

Show:

- Capability labels for wallet sessions, persistence, Solana RPC, ClawPump, Meteora, PreStocks, and AI.
- Risk, privacy, PreStocks eligibility, wallet-authority, and no-false-proof boundaries.
- Transaction ledger empty/database-required state, and the assurance badge on ledger rows when a database exists.

Say: The app is deliberately conservative: external credentials, funding, RPC, deployment, or confirmation blockers are shown as blockers, not hidden by fake data.

## Claims to avoid

- Do not say a ClawPump token was launched unless `docs/EVIDENCE.md` contains a real mint/signature/request ID.
- Do not say a Meteora config or pool is deployed unless `docs/EVIDENCE.md` contains the real address and signature.
- Do not call PreStocks tokens shares.
- Do not imply mainnet execution unless mainnet evidence exists.
- Do not imply that ClawPump funded launch is available in demo or devnet; the current product supports preflight only.
- Do not present Meteora submission as live-ready. Signed input is bound to a server-prepared intent, but broadcast is hard-blocked in every mode.
- Do not claim browser-based real-wallet authentication was verified; only the origin and nonce checks were tested.
- Do not claim the fresh Atlas decision persists or can be shared by link on the public site.

## History

Until the 20 September 2026 hardening push, fresh proposal generation was deferred and this script said so. Later the same day the landing screen, agent list, persisted owner runs, assurance badges and the PreStocks universe were added and this script was updated to match.
