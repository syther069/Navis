# Navis Demo Script

This walkthrough is the technical-video source and must remain within five minutes. Prepare a separate pitch edit no longer than three minutes.

The verified baseline is the recorded deterministic Atlas walkthrough. Fresh proposal generation is deferred and must not be narrated as implemented.

## 0:00–0:30 — Problem and wedge

Open `/agents/atlas`.

Say: Navis is a governed Solana equity-agent workspace. The point is not an AI stock-tip chatbot; it is a capital-bearing mandate with visible rules, wallet authority, and proof.

Show:

- Demo mode stamp.
- Atlas mandate.
- Constraint ledger.
- Treasury snapshot labelled as deterministic/demo.

## 0:30–1:30 — Decision and policy proof

Click “Inspect decision.”

Show:

- The deterministic rebalance proposal.
- Policy checks and hash.
- No explorer link for the simulated receipt.

Say: The AI/provider can propose, but deterministic Navis code decides whether a transition is allowed. Demo mode cannot become a real-looking onchain claim.

## 1:30–2:15 — Receipt verification

Open the linked proof receipt.

Show:

- Decision hash.
- Strategy hash.
- Risk-policy hash.
- Receipt hash verification.
- Copyable evidence fields.

Say: A judge can verify the receipt from a clean browser. If a real signature existed, it would appear here with cluster and explorer evidence; this demo receipt intentionally has none.

## 2:15–3:20 — Sponsor market surfaces

Open `/markets/launch`.

Show:

- ClawPump pair source state. If the key is missing, point out the explicit unavailable state.
- Meteora DBC profile: program, quote mint, initial and migration market caps, threshold, fees, LP distribution.
- Transaction builder copy: prepare before sign, simulate before submit, submit before confirm.
- Pool monitor unavailable state when RPC is missing.
- PreStocks read-only catalogue or unavailable state; emphasize economic-exposure disclosure and no trading path.

Say: Navis separates ClawPump and Meteora evidence so one sponsor claim cannot be confused for another.

## 3:20–4:00 — Capability, disclosure, and transaction status

Open `/settings`, `/disclosures`, then `/transactions`.

Show:

- Capability labels for wallet sessions, persistence, ClawPump, Meteora, PreStocks, and AI.
- Risk, privacy, PreStocks eligibility, wallet-authority, and no-false-proof boundaries.
- Transaction ledger empty/database-required state if `DATABASE_URL` is not configured.

Say: The app is deliberately conservative: external credentials, funding, RPC, deployment, or confirmation blockers are shown as blockers, not hidden by fake data.

## Claims to avoid

- Do not say a ClawPump token was launched unless `docs/EVIDENCE.md` contains a real mint/signature/request ID.
- Do not say a Meteora config or pool is deployed unless `docs/EVIDENCE.md` contains the real address and signature.
- Do not call PreStocks tokens shares.
- Do not imply mainnet execution unless mainnet evidence exists.
- Do not imply that ClawPump funded launch is available in demo or devnet; the current product supports preflight only.
- Do not present Meteora submission as live-ready while prepared-proposal binding remains unresolved.
- The focused agent create/read and sponsor safety tests pass, but do not claim browser-based real-wallet authentication was verified.
