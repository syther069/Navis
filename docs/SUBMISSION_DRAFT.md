# Navis Stocklana submission draft

Updated: 2026-09-20 (late evening IST).

Use this draft as the source text for the final Stocklana submission form. Every field below is final except the two optional videos, which the owner records; the exact scenes are listed under "Videos".

## Project name

Navis

## One-line summary

Navis is a governed Solana equity-agent workspace that turns AI trade proposals into policy-checked, wallet-authorized, hash-verifiable execution receipts.

## Short description

Navis demonstrates a safer pattern for agentic equity exposure on Solana: the agent can propose, but deterministic policy code decides whether an action is allowed, and the wallet still authorizes value movement. On the public site a judge can press Run decision on the Atlas agent and get a fresh proposal over the live PreStocks catalogue, a full policy evaluation with observed values and limits, and a receipt that the browser verifies by hash (Balanced is approved, Oversized is rejected). Owners can create their own agents; with a database and wallet session, each demo run is persisted as a snapshot, decision, policy evaluation, simulated execution attempt and proof receipt in one transaction. Every receipt carries an assurance level (offchain integrity, wallet authorization, onchain settlement) and a demo or live label, so a simulation can never be mistaken for onchain proof.

The product also includes a landing screen with the three proof points, an agent list, decision and proof timelines, a transaction ledger, ClawPump launch preflight, a Meteora DBC builder with a stock-paired quote profile, and a read-only PreStocks research view (premium or discount to mark, valuation gap, allocation impact).

Demo receipts are explicitly labelled simulations. Real explorer links, mints, pool addresses, and signatures appear only after Navis has stored confirmed external evidence, and none exist yet.

## Public links

| Item                | URL                                                          |
| ------------------- | ------------------------------------------------------------ |
| Demo URL            | https://navis-gilt.vercel.app                                |
| Repository URL      | https://github.com/syther069/Navis                           |
| Demo video URL      | Not available (owner to record; optional)                    |
| Pitch video URL     | Not available (owner to record; optional, 3 minutes maximum) |
| Technical video URL | Not available (owner to record; optional, 5 minutes maximum) |

## Videos

Videos are optional under the documented rules; confirm the current submission form before submitting. If the owner records them, use `docs/DEMO_SCRIPT.md` as the shot list. The technical video is that script in order (five minutes): landing screen (0:00), Atlas run with Balanced then Oversized and Verify receipt (0:30), proof page (1:30), Markets Launch with the two Meteora profiles and the PreStocks research view (2:15), settings, disclosures and transactions (3:20). The pitch video (three minutes) is the landing screen, one Balanced run, one Oversized run with the "Why this failed" panel, and the proof page. Record from a clean browser against https://navis-gilt.vercel.app. When the persistence note reports database storage, open the public Atlas decision and proof links and reload them. Without a database, show the inline result and explain that it is not durably stored.

## Suggested demo flow

1. Open the deployed URL. The landing screen shows the one-sentence pitch, the mode and cluster banner (demo, devnet), the three proof points and the assurance model.
2. Open the Atlas demo (`/agents/atlas`). Run **Balanced** (approved, 10 of 11 checks passed and 1 warned because PreStocks publishes no liquidity figure) and then **Oversized** (rejected on max trade bps and min reserve bps). Press **Verify receipt**. Point out the PreStocks facts under each policy check and the research table under the result.
3. Open `/agents/atlas/decisions/demo-decision` for the recorded example and `/proofs/demo-proof` for the public verifier: hashes, assurance badge, "Why this passed" panel, no explorer link.
4. Open `/agents` and `/agents/new` to show that owners define their own mandates; explain that with a database and wallet session each run is persisted as a full evidence chain.
5. Open `/markets/launch`: ClawPump "Not configured" state, the two Meteora DBC quote profiles (SOL-quoted, and stock-paired on a PreStocks mint with its onchain gate), and the PreStocks research view.
6. Open `/settings`, `/disclosures` and `/transactions` for capability flags, boundaries and the ledger state.

## Sponsor integration claims

Only claims backed by `docs/EVIDENCE.md` are kept.

### PreStocks (recommended track)

> Navis consumes the PreStocks catalogue through a strict schema and uses it as the live asset universe for the Atlas demo agent: the allowlist comes from the validated contract addresses and the token price is the research price. Catalogue fetches bypass the Next.js data cache and have a five-second timeout. The timestamp records successful fetch time; the provider price observation timestamp is unavailable, so this is not proof of price freshness. No liquidity or execution quote is invented. The research view shows premium or discount to mark, valuation gap, supply and allocation impact, labelled as research data. Navis exposes no PreStocks buy, sell, launch or issuance action and describes the tokens as economic exposure, not shares.

### Meteora DBC (recommended track)

> Navis integrates the official Meteora Dynamic Bonding Curve SDK with two server-approved quote profiles. The owner has explicitly authorised the SOL-quoted equity curve as a **devnet-only** test path: code requires devnet mode, devnet cluster, the devnet execution flag, a devnet RPC and wallet authentication, followed by prepare, wallet sign, simulate, submit and reconcile. Submission is bound to a server-prepared execution intent (owner, cluster, expiry, message hash, simulation result), and the launch record is persisted before any send. Mainnet broadcast remains code-blocked. The PreStocks stock-paired curve remains mainnet-only and gated by onchain token-program, decimals, Token-2022 extension and Meteora token-badge checks; it is not a devnet path. No config, pool or transaction is claimed on any cluster.

Config transaction signature, pool transaction signature, pool address, base mint and quote mint: not available.

### ClawPump (not entered)

> Navis integrates ClawPump server-side for agent linking, pair discovery, and self-funded launch preflight. It does not implement funded launch execution. The official self-funded endpoint has no documented devnet selector, so a launch would require an explicit owner-approved mainnet release and reviewed paid-retry, signature and persistence code.

Launch mint, transaction signature, provider request ID and payout wallet: not available. The ClawPump track requires a real stock-paired launch, so Navis does not enter it.

## Technical highlights

- Next.js App Router with strict TypeScript; the full gate runs on GitHub for every push.
- Wallet Standard connection and nonce-bound wallet authentication; same-origin mutations trusted behind the deployment proxy, foreign origins refused.
- Drizzle/PostgreSQL persistence for agents, strategies, policies, snapshots, decisions, policy evaluations, execution attempts, execution intents, proofs, launch records, and external calls; evidence rows are append-only.
- Deterministic demo provider plus OpenAI-compatible provider abstraction with prompt-injection hardening.
- Decimal-safe policy runner for allowlists, trade size, concentration, reserve, turnover, cooldown, freshness, liquidity, and slippage rules, with observed value, limit and fact source on every check.
- Receipt builder and assurance helper that prevent demo evidence from being labelled as confirmed onchain proof.
- Real HTTP 404 for unknown decision and proof ids; `/api/health` reports non-secret readiness state.

## Validation summary

Local gate at the final application commit, 2026-09-20:

```bash
npm run check
```

All nine gates passed: format, zero-warning lint, strict types, 46 test files / 340 tests, lockfile registry check, production Next.js build, judge smoke (12 page routes, PreStocks API, real 404s, fresh oversized decision on the PreStocks universe), Drizzle schema check, and submission audit with zero warnings. Local smoke report: `docs/evidence/final-local-smoke.json`.

Public smoke:

```bash
NAVIS_SMOKE_BASE_URL=https://navis-gilt.vercel.app NAVIS_SMOKE_REPORT=docs/evidence/final-public-smoke.json npm run smoke:judge
```

Result: recorded in `docs/EVIDENCE.md` under "Final state" with the deployed commit and date.

Dependency audit:

```bash
npm audit --omit=dev
```

19 production advisories (6 high, 13 moderate, 0 critical), all transitive through the Solana and Meteora chains: `docs/evidence/stocklana-v2-dependency-audit.json`. Unresolved; not a security certification.

## Track and timing plan

- Enter the main Stocklana track.
- Sponsor tracks: PreStocks and Meteora DBC, with the claims above. Not ClawPump (its requirement is a real stock-paired launch that Navis has not done). Not Pyth (not used).
- Submit before Friday, September 25, 2026 at 4:00 p.m. ET (Saturday 26 September, 1:30 a.m. IST).
- Formal entry requires registration and the authenticated form; at least one public link is required and both are available. Videos are optional.

## Disclosures

- Navis is not a brokerage product.
- PreStocks tokens are presented as economic exposure, not legal shares.
- Demo receipts are simulations.
- Risk, privacy, and eligibility disclosures are visible at `/disclosures`.
- Meteora execution is authorised only for the SOL profile on devnet with all code gates satisfied and the complete prepare → wallet sign → simulate → submit → reconcile sequence. Mainnet remains code-blocked; flags and wallet approval cannot bypass that stop. ClawPump has no funded-launch code.
- No live ClawPump or Meteora address should be claimed without matching evidence in `docs/EVIDENCE.md`.
- This documentation update submitted no transaction and establishes no production or Vercel publication. Do not turn workspace capability into a deployed-success or bounty claim.
- Atlas runs remain demo simulations: PreStocks research uses mainnet-beta asset identifiers, not mainnet execution. A configured database stores the public Atlas snapshot, decision, policy evaluation, simulated or rejected attempt and proof receipt atomically; public links need no wallet. Owner-agent records are session-scoped. Without a database, runs are memory-only with no durable links; database write failures must be shown as errors. This is not a real treasury-to-trade execution flow, a wallet signature, or onchain settlement. Confirm deployed capabilities and the displayed persistence result before recording; historical local-only devnet artifacts are not evidence of deployed execution.
- Open-source and sponsor resources are credited in `docs/ATTRIBUTIONS.md`; the code is released under the MIT licence.
