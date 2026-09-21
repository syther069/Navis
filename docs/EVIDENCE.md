# Navis Evidence Manifest

Updated: 2026-09-20 (late evening IST).

This manifest records what can be proven from the current `main` and the public deployment, and what remains externally blocked. Everything in the "Final state" section was measured on 2026-09-20 against the commit named there. Earlier baselines are listed under History at the end.

## Final state

| Item                        | Value                                                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final application commit    | `a41c10a` (GitHub `main`, pushed 2026-09-21 authored and committed by the owner); the docs-only follow-up that records the public smoke against it is the next commit on `main` (it changes only `docs/EVIDENCE.md`, `docs/SUBMISSION_READINESS.md` and `docs/evidence/*`)                               |
| Repository URL              | https://github.com/syther069/Navis                                                                                                                                                                                                                                                                       |
| Deployed URL                | https://navis-gilt.vercel.app (Vercel production, project `navis`, production branch `main`)                                                                                                                                                                                                             |
| Deployed commit before push | `6aa5f32` (Vercel READY at 16:58 UTC); it failed the current judge smoke only at the new "fresh decision reports an honest asset universe" step because the PreStocks universe work was not deployed yet                                                                                                 |
| Deployed commit after push  | `a41c10a` (Vercel production deployment READY on 2026-09-21, same commit as GitHub `main`)                                                                                                                                                                                                               |
| Public judge smoke          | Passed on 2026-09-21 from a clean session against https://navis-gilt.vercel.app: 12 page routes, PreStocks API, real 404 for unknown decision and proof ids, fresh oversized decision on the PreStocks universe. Report: `docs/evidence/final-public-smoke.json`                                         |
| Public health output        | See "Public health" below                                                                                                                                                                                                                                                                                |
| Videos                      | Not recorded (owner action; scenes are listed in `docs/SUBMISSION_DRAFT.md`)                                                                                                                                                                                                                             |
| Screenshots                 | `docs/evidence/final-agent-run-verdict.png`, `final-agent-run-receipt-hash.png`, `final-agent-run-full.png`, `final-proof-page.png`, `final-markets-launch.png`, `final-landing.png` (captured from https://navis-gilt.vercel.app at commit `a41c10a` on 2026-09-21 with `npm run evidence:screenshots`) |

## Local build evidence

All gates were run on 2026-09-20 at the final application commit.

| Gate                        | Result                                                                                                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`      | Passed                                                                                                                                                                                                                                                                |
| `npm run lint`              | Passed, zero warnings                                                                                                                                                                                                                                                 |
| `npm run typecheck`         | Passed                                                                                                                                                                                                                                                                |
| `npm test`                  | Passed: 46 files / 340 tests                                                                                                                                                                                                                                          |
| `npm run check:lockfile`    | Passed: every `package-lock.json` resolved URL is on `registry.npmjs.org`                                                                                                                                                                                             |
| `npm run build`             | Passed: production Next.js 16.3.5 build                                                                                                                                                                                                                               |
| `npm run smoke:judge`       | Passed against a local `next start` in the locked demo posture with no database: 12 page routes, PreStocks API, real 404 for unknown decision and proof ids, and a fresh oversized decision on the PreStocks universe. Report: `docs/evidence/final-local-smoke.json` |
| `npm run db:check`          | Passed (Drizzle schema matches migrations `0000` to `0007`)                                                                                                                                                                                                           |
| `npm run submission:audit`  | Passed with zero warnings                                                                                                                                                                                                                                             |
| `npm run check`             | Passed: all nine gates in sequence                                                                                                                                                                                                                                    |
| Production dependency audit | `npm audit --omit=dev`: 19 advisories (6 high, 13 moderate, 0 critical), all transitive through the Solana and Meteora chains: `docs/evidence/stocklana-v2-dependency-audit.json`. Unresolved; not a security certification                                           |

## Public URLs

| Item                | Value                                       |
| ------------------- | ------------------------------------------- |
| Deployed demo URL   | https://navis-gilt.vercel.app               |
| Repository URL      | https://github.com/syther069/Navis          |
| Demo video URL      | Not recorded                                |
| Pitch video URL     | Not recorded; official maximum is 3 minutes |
| Technical video URL | Not recorded; official maximum is 5 minutes |

## Public health

`GET https://navis-gilt.vercel.app/api/health` on 2026-09-21 at commit `a41c10a` (saved as `docs/evidence/final-public-health.json`) returned HTTP 200 with `mode=demo`, `cluster=devnet` and these services: `database` not configured, `authenticationOrigin` not configured, `solanaRpc` configured (public devnet endpoint, read-only slot probe), `walletSessions` not configured, `clawpump` not configured, `meteora` configured (SDK reads only), `prestocks` configured, `ai` configured (deterministic demo provider). No secret values are returned.

The Vercel project has environment variables named `NEXT_PUBLIC_APP_URL`, `DATABASE_URL` and `SESSION_SECRET`, but the health output shows none of them holds a usable value. Consequences on the public site: wallet sign-in is unavailable, created agents and their persisted decision runs cannot be exercised, and fresh Atlas runs are kept in the memory of the serverless instance that produced them. The owner steps to change this are in `docs/DEPLOYMENT_RUNBOOK.md`, section 6a.

## Demo evidence

### Fresh decision evidence

`POST /api/decisions/run` creates a fresh proposal, runs the deterministic policy engine, and returns every check, the execution eligibility, and a receipt that the browser verifies locally with the same code as `/proofs/<id>`. Three paths exist:

- **Atlas (public demo).** No wallet or database is needed. The default asset universe is the live PreStocks catalogue (allowlist from the validated `contract_address` values, token price as the research price, freshness from the read time, liquidity left unavailable so the rule warns instead of inventing a figure). Balanced is approved with 10 of 11 checks passed and 1 warned; Oversized is rejected on max trade bps and min reserve bps. When no database is configured the run is kept in bounded process memory only, the panel says so, and no detail link is offered (on Vercel a later request can land on another instance).
- **Owner-created agents in demo mode.** With `DATABASE_URL`, `SESSION_SECRET` and a wallet session, a run is persisted in one transaction: portfolio snapshot, decision, policy evaluation, execution attempt (simulated) and proof receipt. The decision and proof pages are owner-scoped; unknown ids return a real HTTP 404. Not exercisable on the public site (no database there).
- **Owner-created agents in devnet or mainnet mode.** Refused with HTTP 409, because a persisted snapshot does not hold every market fact an honest evaluation needs and Navis will not invent them.

No path executes onchain.

| Item                | Value                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing route       | `/` (one-sentence pitch, three proof points, mode and cluster banner, assurance model, entry links)                                                                                                                                                   |
| Agent list          | `/agents` (Atlas plus the signed-in owner's agents when a database is configured)                                                                                                                                                                     |
| Demo agent          | Atlas at `/agents/atlas`, with the **Run new decision** panel                                                                                                                                                                                         |
| Demo decision route | `/agents/atlas/decisions/demo-decision`                                                                                                                                                                                                               |
| Demo proof route    | `/proofs/demo-proof`                                                                                                                                                                                                                                  |
| Disclosure route    | `/disclosures`                                                                                                                                                                                                                                        |
| Assurance labels    | Every receipt, decision detail, run result and ledger row carries an assurance badge: offchain integrity, wallet authorization or onchain settlement, plus demo simulation or live. The public demo never leaves offchain integrity / demo simulation |
| Receipt type        | Deterministic simulation; no onchain signature                                                                                                                                                                                                        |
| Hash anchoring      | Offchain-only decision hash; no memo instruction or transaction signature                                                                                                                                                                             |
| Devnet slot probe   | `GET /api/solana/slot` live on production (`SOLANA_RPC_URL` = public devnet endpoint); the Atlas intro shows "DEVNET RPC live read: slot N" (`docs/evidence/v2-devnet-slot-live.png`). Read only; no transaction                                      |

## Sponsor evidence

### ClawPump

| Item                                | Value                                                                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API adapter                         | Implemented under `lib/integrations/clawpump/*`                                                                                                                                                                     |
| Local support                       | Agent creation/linking, pair discovery, launch preflight (`/api/integrations/clawpump/launch/preflight`)                                                                                                            |
| Live launch mint                    | Not available                                                                                                                                                                                                       |
| Live launch transaction             | Not available                                                                                                                                                                                                       |
| Provider request ID for live launch | Not available                                                                                                                                                                                                       |
| Public site                         | `CLAWPUMP_API_KEY` not configured; Markets Launch shows the explicit "Not configured" state                                                                                                                         |
| Blocker                             | Preflight only. The official self-funded launch has no devnet selector; safe owner-approved mainnet execution code does not exist. The ClawPump track requires a real stock-paired launch, so it is not recommended |

### Meteora DBC

| Item                   | Value                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK                    | `@meteora-ag/dynamic-bonding-curve-sdk` (resolves `1.5.12`)                                                                                                                                                                                                                                                                                                    |
| Program                | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`                                                                                                                                                                                                                                                                                                                  |
| Quote profiles         | Server allowlist: `navis-equity-v1` (wrapped SOL, devnet and mainnet) and `navis-stock-exposure-v1` (PreStocks catalogue mint, mainnet only, gated on a Meteora DBC token badge that no live PreStocks mint has as of 2026-09-20; unavailable on devnet, no substitute mint). Clients send a profile id, never a mint. Both are shown on `/markets/launch`     |
| Quote verification     | PreStocks quote mints are read from the live catalogue and checked onchain (token program, 9 decimals, Token-2022 extensions, Meteora token badge) at prepare time; pool preparation re-reads the onchain config and refuses a quote mint mismatch                                                                                                             |
| Intent binding         | Submit routes accept only a server-prepared intent ID plus signed bytes; owner, cluster, expiry, message hash and simulation are checked; the signature is derived from the signed bytes and the launch persisted as `submitting` before any send; confirm labels `protocol_verified`, `signature_confirmed` or `evidence_incomplete` from the decoded account |
| Config transaction     | Builder implemented; no signature on any cluster                                                                                                                                                                                                                                                                                                               |
| Pool transaction       | Builder implemented; no signature on any cluster                                                                                                                                                                                                                                                                                                               |
| Pool address/base mint | Not available                                                                                                                                                                                                                                                                                                                                                  |
| Devnet rehearsal       | Not run by the owner as of this manifest; if it is run later, record the signatures here and in `docs/INTEGRATIONS.md`                                                                                                                                                                                                                                         |
| Blocker                | Broadcast is hard-blocked in every mode (submit routes return 503 before any send) pending a review on a real cluster; migrations `0006` (execution intents) and `0007` (submitting status) exist in the repository but are applied to no database; all live flags remain false                                                                                |

### PreStocks

| Item             | Value                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API URL          | `https://prestocks.com/api/prestocks`                                                                                                                                                                                                                                                                                                                                           |
| Navis API route  | `/api/assets/prestocks`                                                                                                                                                                                                                                                                                                                                                         |
| Adapter          | `lib/integrations/prestocks/client.ts`, `research.ts`, `allocation.ts`, `lib/decisions/universe.ts`                                                                                                                                                                                                                                                                             |
| Live universe    | The Atlas demo run defaults to the live PreStocks catalogue: allowlist from the validated `contract_address` values, freshness from the read time, token price as the research price, no liquidity or quote invented. Receipt `dataSource.universe=prestocks`; the run is labelled `mainnet-beta` because that is where the mints live. Verified locally and by the judge smoke |
| Research view    | `/markets/launch` and each run result show premium or discount to mark, mark vs implied valuation gap, supply, allocation concentration, read time and source URL; labelled research data, not execution quotes                                                                                                                                                                 |
| Allocation maths | Proposal amount, token price, trade value and post-trade positions reconcile exactly; proposals exceeding the holding are refused. Covered by `tests/prestocks-universe.test.ts`                                                                                                                                                                                                |
| Fallback         | Catalogue unreachable or invalid: fixture universe with a visible note; the route tests run offline and assert the fallback                                                                                                                                                                                                                                                     |
| Execution path   | None. PreStocks tokens are described as economic exposure, not shares                                                                                                                                                                                                                                                                                                           |

## Compliance notes

- Demo and live modes are labelled separately, and every receipt carries an assurance level.
- PreStocks are described as economic exposure, not shares.
- No secret values are documented here.
- No external live address is claimed without a corresponding signature/address row.
- Deployment steps are in `docs/DEPLOYMENT_RUNBOOK.md`; copy-ready submission language is in `docs/SUBMISSION_DRAFT.md`; open-source and sponsor credits are in `docs/ATTRIBUTIONS.md`.
- Sponsor tracks are optional and judged by the sponsors. Recommended: Main, PreStocks, Meteora DBC. Not ClawPump (no launch), not Pyth (not used).
- No funded-wallet action, live launch, production database, video, or final submission is claimed.

## Database evidence

| Item                 | Verified value                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Development database | Migrations `0000` through `0005` applied with journal SHA tracking; `0006` and `0007` are in the repository and not applied |
| Production database  | None; the public Vercel demo has no database, so created agents and persisted runs cannot be exercised there                |
| Immutability         | Evidence rows are append-only; database tests run inside rolled-back transactions                                           |
| Deployment lookup    | Navis is deployed on Vercel; it is not published through Replit                                                             |

A real wallet extension and signing remain unverified. See `docs/STOCKLANA_JUDGE_AUDIT_V2.md` for the round 2 audit and its evidence list.

## History

- Baseline, 2026-09-20 morning, commit `ac26e54`: 24 files / 113 tests; first Vercel publish; Chromium QA of the deterministic journey (`docs/evidence/stocklana-browser-audit.json`).
- Remediation pass, same day: 26 files / 143 tests; local smoke in `docs/evidence/stocklana-local-smoke.json`.
- Hardening push, commit `a335681`: fresh decision flow, Meteora intent binding, persist-before-broadcast, same-origin fix; public smoke `docs/evidence/stocklana-v2-public-smoke.json`; real Chromium walk at 1440/375 px with no console errors.
- Commit `085e779` and `8d2b5db`: lockfile registry fix, Atlas intro, live devnet slot probe.
- Commit `c319e92` to `6aa5f32`: CI pipeline, `/agents` list and persisted runs for created agents, adversarial test sweep, landing screen, assurance badges, MIT licence, real 404s for unknown decisions and proofs.
- Final application commit: PreStocks verified asset universe with research view and proposal-consistent allocation; this manifest.
