# Navis Stocklana submission draft

Updated: 2026-09-19.

Use this draft as the source text for the final Stocklana submission form. Replace every `TODO` before submitting.

## Project name

Navis

## One-line summary

Navis is a governed Solana equity-agent workspace that turns AI trade proposals into policy-checked, wallet-authorized, hash-verifiable execution receipts.

## Short description

Navis demonstrates a safer pattern for agentic equity exposure on Solana: the agent can propose, but deterministic policy code decides whether an action is allowed, and the wallet still authorizes value movement. The product includes a premium proof-terminal UI, an Atlas demo agent, immutable decision/proof timelines, a transaction ledger, ClawPump launch preflight surfaces, Meteora DBC transaction builders, and a read-only PreStocks catalogue disclosure.

Demo receipts are explicitly labelled simulations. Real explorer links, mints, pool addresses, and signatures should appear only after Navis has stored confirmed external evidence.

## Public links

| Item           | URL  |
| -------------- | ---- |
| Demo URL       | TODO |
| Repository URL | TODO |
| Demo video URL | TODO |

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

> Navis integrates ClawPump server-side for agent linking, pair discovery, and self-funded launch preflight. Live launch execution is gated behind API credentials, authenticated wallet approval, funding, provider acceptance, and chain confirmation.

If a live launch is completed, add:

- Launch mint: TODO
- Transaction signature: TODO
- Provider request ID: TODO
- Payout wallet: TODO

### Meteora DBC

Current safe claim:

> Navis integrates the official Meteora Dynamic Bonding Curve SDK for equity-like DBC configuration preview, transaction preparation, simulation, submission, confirmation, and pool monitoring. No live pool is claimed unless a real signature and pool address are recorded.

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

Latest local gate:

```bash
npm run check
```

Result: passed format, lint, typecheck, 22 test files / 103 tests, production build, clean-session judge-flow smoke, and Drizzle schema validation.

Latest deployed smoke gate:

```bash
NAVIS_SMOKE_BASE_URL=TODO NAVIS_SMOKE_REPORT=docs/deployed-smoke-report.json npm run smoke:judge
```

Result: TODO.

Known audit status:

```bash
npm audit --omit=dev
```

Result: 19 production advisories remain in transitive Solana/Meteora/Anchor/Jayson dependency chains, with no non-forced fix available from the current dependency graph.

## Disclosures

- Navis is not a brokerage product.
- PreStocks tokens are presented as economic exposure, not legal shares.
- Demo receipts are simulations.
- Risk, privacy, and eligibility disclosures are visible at `/disclosures`.
- Mainnet execution is blocked unless `ENABLE_MAINNET_EXECUTION=true`, `MAINNET_RELEASE_APPROVED=true`, the public cluster is `mainnet-beta`, and a human approves the wallet transaction.
- No live ClawPump or Meteora address should be claimed without matching evidence in `docs/EVIDENCE.md`.
- Open-source and sponsor resources are credited in `docs/ATTRIBUTIONS.md`.
