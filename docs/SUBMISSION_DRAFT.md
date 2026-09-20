# Navis Stocklana submission draft

Updated: 2026-09-20.

Use this draft as the source text for the final Stocklana submission form. Replace required `TODO` fields before submitting; optional video and live-sponsor evidence may remain unfilled when genuinely unavailable.

## Project name

Navis

## One-line summary

Navis is a governed Solana equity-agent workspace that turns AI trade proposals into policy-checked, wallet-authorized, hash-verifiable execution receipts.

## Short description

Navis demonstrates a safer pattern for agentic equity exposure on Solana: the agent can propose, but deterministic policy code decides whether an action is allowed, and the wallet still authorizes value movement. On the public site a judge can press Run decision and get a fresh proposal, policy evaluation and hash-verified receipt (Balanced is approved, Oversized is rejected). The product also includes a proof-terminal UI, decision and proof timelines, a transaction ledger, ClawPump launch preflight, Meteora DBC builder surfaces, and a read-only PreStocks catalogue disclosure.

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
2. On `/agents/atlas` run **Balanced** (approved) and then **Oversized** (rejected on max trade bps and min reserve bps); press **Verify receipt**.
3. Open `/decisions` and then `/agents/atlas/decisions/demo-decision` for the recorded example.
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

> Navis integrates the official Meteora Dynamic Bonding Curve SDK for equity-like DBC configuration preview and guarded builder surfaces. Submission is bound to a server-prepared execution intent (owner, cluster, expiry, message hash, simulation result) and the launch record is persisted before any send, but broadcast is hard-blocked in every mode pending a review on a real cluster. No config, pool or transaction is claimed on any cluster.

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

Result at current `main` on 2026-09-20: all eight gates passed, 32 test files / 166 tests, production Next.js build, judge smoke (11 routes, PreStocks API, fresh oversized decision), Drizzle schema validation, and submission audit. Vercel production is built from GitHub `main` commit `a335681`.

Latest deployed smoke gate:

```bash
NAVIS_SMOKE_BASE_URL=https://navis-gilt.vercel.app NAVIS_SMOKE_REPORT=docs/evidence/stocklana-v2-public-smoke.json npm run smoke:judge
```

Result: Vercel production READY at `a335681`; all 11 judge-flow routes, `/api/health`, the PreStocks API and a fresh oversized decision passed. Report: `docs/evidence/stocklana-v2-public-smoke.json`. A real Chromium walk on the same day confirmed Balanced approved, Oversized rejected, receipt verified, no console errors at 1440 px and 375 px. Known gap: the `/decisions/<id>` link after a run is unreliable on Vercel because demo runs are held in one serverless instance's memory.

Known audit status:

```bash
npm audit --omit=dev
```

Result: 19 production advisories, comprising 6 high and 13 moderate findings with no critical findings. Machine-readable evidence is in `docs/evidence/stocklana-v2-dependency-audit.json`. The findings remain unresolved and do not constitute security certification.

## Track and timing plan

- Enter the main Stocklana track.
- Sponsor tracks are optional. PreStocks and Meteora DBC are candidates with honest claims; ClawPump should not be selected because its requirement is a real stock-paired launch that Navis has not done.
- Submit before Friday, September 25, 2026 at 4:00 p.m. ET.
- Formal entry still requires one public demo link and registration; the final authenticated form and registration remain external requirements. Optional video URLs are genuinely missing and are not mandatory for eligibility.

## Disclosures

- Navis is not a brokerage product.
- PreStocks tokens are presented as economic exposure, not legal shares.
- Demo receipts are simulations.
- Risk, privacy, and eligibility disclosures are visible at `/disclosures`.
- Mainnet flags and human wallet approval are necessary but not sufficient. ClawPump has no funded-launch code, and Meteora broadcast is hard-blocked until retested on a real cluster.
- No live ClawPump or Meteora address should be claimed without matching evidence in `docs/EVIDENCE.md`.
- The public demo runs in demo mode on devnet with a read-only public devnet RPC (slot probe only) and no database, ClawPump or execution configuration. Fresh decision runs are simulations kept in server memory; the demo must not be presented as live-funds, persistent, or wallet-ready.
- Open-source and sponsor resources are credited in `docs/ATTRIBUTIONS.md`.
