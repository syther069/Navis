# Navis Stocklana submission draft

Updated: 2026-09-20.

Use this draft as the source text for the final Stocklana submission form. Replace required `TODO` fields before submitting; optional video and live-sponsor evidence may remain unfilled when genuinely unavailable.

## Project name

Navis

## One-line summary

Navis is a governed Solana equity-agent workspace that turns AI trade proposals into policy-checked, wallet-authorized, hash-verifiable execution receipts.

## Short description

Navis demonstrates a safer pattern for agentic equity exposure on Solana: the agent can propose, but deterministic policy code decides whether an action is allowed, and the wallet still authorizes value movement. The verified demo is the recorded deterministic Atlas walkthrough. Fresh proposal generation is deferred. The product includes a proof-terminal UI, decision and proof timelines, a transaction ledger, ClawPump launch preflight, Meteora DBC builder surfaces, and a read-only PreStocks catalogue disclosure.

Demo receipts are explicitly labelled simulations. Real explorer links, mints, pool addresses, and signatures should appear only after Navis has stored confirmed external evidence.

## Public links

| Item                | URL                                    |
| ------------------- | -------------------------------------- |
| Demo URL            | https://navis-gilt.vercel.app          |
| Repository URL      | https://github.com/syther069/Navis.git |
| Demo video URL      | Not recorded                           |
| Pitch video URL     | TODO, 3 minutes maximum                |
| Technical video URL | TODO, 5 minutes maximum                |

## Suggested demo flow

1. Open the deployed URL and show the mode/cluster banner.
2. Visit `/agents/atlas` and explain the mandate, treasury snapshot, and risk rails.
3. Open `/decisions` and then `/agents/atlas/decisions/demo-decision`.
4. Show that the policy engine, not model prose, controls execution eligibility.
5. Open `/proofs/demo-proof` and point out the deterministic receipt hash and simulation labelling.
6. Visit `/markets/launch` and show the ClawPump preflight, Meteora DBC builder, and PreStocks read-only disclosure.
7. Visit `/settings`, `/disclosures`, and `/transactions` to show capability flags, risk/privacy boundaries, and evidence ledger behavior.

## Sponsor integration claims

Only keep claims backed by the final evidence manifest.

### ClawPump

Current safe claim:

> Navis integrates ClawPump server-side for agent linking, pair discovery, and self-funded launch preflight. It does not currently implement funded launch execution. The official self-funded endpoint has no documented devnet selector, so a future launch requires an explicit owner-approved mainnet release and reviewed paid-retry, signature, and persistence code.

If a live launch is completed, add:

- Launch mint: TODO
- Transaction signature: TODO
- Provider request ID: TODO
- Payout wallet: TODO

### Meteora DBC

Current safe claim:

> Navis integrates the official Meteora Dynamic Bonding Curve SDK for equity-like DBC configuration preview and guarded builder surfaces. Live submission is not ready because signed caller input is not yet server-bound to the exact previously prepared proposal. No live pool is claimed.

If a live config/pool is completed, add:

- Config transaction signature: TODO
- Pool transaction signature: TODO
- Pool address: TODO
- Base mint: TODO
- Quote mint: TODO

### PreStocks

Current safe claim:

> Navis consumes the PreStocks catalogue read-only through a strict schema and displays economic-exposure/eligibility disclosures. It does not expose PreStocks buy, sell, launch, or issuance actions.

## Technical highlights

- Next.js App Router with strict TypeScript.
- Wallet Standard connection and nonce-bound wallet authentication.
- Drizzle/PostgreSQL persistence model for agents, strategies, policies, decisions, attempts, proofs, launch records, and external calls.
- Deterministic demo provider plus OpenAI-compatible provider abstraction with prompt-injection hardening.
- Decimal-safe policy runner for allowlists, trade size, concentration, reserve, turnover, cooldown, freshness, liquidity, and slippage rules.
- Receipt builder that prevents demo evidence from being labelled as confirmed onchain proof.
- `/api/health` endpoint that reports non-secret readiness state.

## Validation summary

Latest automated local gate:

```bash
npm run check
```

Result: final local remediation pass on 2026-09-20 across all eight gates, 26 test files / 143 tests, production Next.js 16.3.5 build, 11-route deterministic demo smoke including `/agents/new`, Drizzle schema validation, and submission audit. These local changes have not been pushed or deployed; public verification applies to the separately recorded baseline commit.

Latest deployed smoke gate:

```bash
NAVIS_SMOKE_BASE_URL=https://navis-gilt.vercel.app NAVIS_SMOKE_REPORT=docs/evidence/stocklana-public-smoke.json npm run smoke:judge
```

Result: Public Vercel deployment READY at https://navis-gilt.vercel.app; all 11 judge-flow routes and `/api/health` passed. Replit remains NOT published. Sanitized generated report: `docs/evidence/stocklana-public-smoke.json`. This report verifies the pre-remediation production commit; subsequent local fixes have not been pushed or deployed.

Known audit status:

```bash
npm audit --omit=dev
```

Result: 19 production advisories, comprising 6 high and 13 moderate findings with no critical findings. Machine-readable evidence is in `docs/dependency-audit.json`. The findings remain unresolved and do not constitute security certification.

## Track and timing plan

- Enter the main Stocklana track.
- Select at most three sponsor tracks: ClawPump, Meteora DBC, and PreStocks, only where final evidence supports the claim.
- Submit before Friday, September 25, 2026 at 4:00 p.m. ET.
- Formal entry still requires one public demo link and registration; the final authenticated form and registration remain external requirements. Optional video URLs are genuinely missing and are not mandatory for eligibility.

## Disclosures

- Navis is not a brokerage product.
- PreStocks tokens are presented as economic exposure, not legal shares.
- Demo receipts are simulations.
- Risk, privacy, and eligibility disclosures are visible at `/disclosures`.
- Mainnet flags and human wallet approval are necessary but not sufficient. ClawPump and Meteora also require their unresolved protocol and security gates to be completed and retested.
- No live ClawPump or Meteora address should be claimed without matching evidence in `docs/EVIDENCE.md`.
- The public demo is read-only deterministic demo mode on devnet; it has no persistence, wallet sessions, RPC, ClawPump, or Meteora configuration and must not be presented as live-funds or wallet-ready.
- Open-source and sponsor resources are credited in `docs/ATTRIBUTIONS.md`.
