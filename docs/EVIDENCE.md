# Navis Evidence Manifest

Updated: 2026-09-20.

This manifest records what can be proven from the current `main` and the public deployment, and what remains externally blocked. Vercel production is built from GitHub `main` commit `a335681`, which contains the hardening, the fresh decision flow, the Meteora intent binding and the same-origin fix. Earlier baselines are listed under History at the end.

## Local build evidence

| Gate                                          | Latest local result                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                        | Passed                                                                                                                                |
| `npm run lint`                                | Passed                                                                                                                                |
| `npm run typecheck`                           | Passed                                                                                                                                |
| `npm test`                                    | Passed: 32 files / 166 tests                                                                                                          |
| `npm run build`                               | Passed: production Next.js 16.3.5 build                                                                                               |
| `npm run smoke:judge`                         | Passed: 11 routes including `/agents/new`, PreStocks API, and a fresh oversized decision                                              |
| `node node_modules/drizzle-kit/bin.cjs check` | Passed                                                                                                                                |
| `npm run check`                               | Passed at current `main`: all 8 gates, 32 test files / 166 tests                                                                      |
| `npm run submission:audit`                    | Passed with expected external-evidence TODO warning                                                                                   |
| Deployed URL smoke verifier                   | Production passed all 11 routes, health, PreStocks API and a fresh oversized decision: `docs/evidence/stocklana-v2-public-smoke.json` |
| Production browser QA                         | Real Chromium on 2026-09-20 at 1440/375 px: Balanced approved, Oversized rejected, receipt verified, no console errors, no overflow   |
| Production dependency audit                   | 19 advisories (6 high, 13 moderate, 0 critical): `docs/evidence/stocklana-v2-dependency-audit.json`                                   |

## Public URLs

| Item                | Value                                                                |
| ------------------- | -------------------------------------------------------------------- |
| Deployed demo URL   | https://navis-gilt.vercel.app (Vercel production READY at `a335681`) |
| Repository URL      | https://github.com/syther069/Navis.git (GitHub main: `a335681`)      |
| Demo video URL      | Not recorded                                                         |
| Pitch video URL     | Not recorded; official maximum is 3 minutes                          |
| Technical video URL | Not recorded; official maximum is 5 minutes                          |

## Demo evidence

### Fresh decision evidence

`POST /api/decisions/run` creates a fresh Atlas proposal for the `balanced` or
`oversized` scenario. The response includes every policy check, execution
eligibility, and a receipt that can be checked with the local verifier. The
oversized scenario deterministically fails the trade-size and reserve controls.
`GET /api/decisions/{decisionId}` retrieves the run. In demo deployments without
a database, runs are retained only in bounded process memory for that server
instance; on Vercel this means the `/decisions/{id}` link opened after a run can
show "Decision unavailable" when the request reaches another instance (observed
in the production browser walk on 2026-09-20). No onchain execution occurs in
demo mode.

Fresh runs for persistent agents are currently disabled with a 409 response.
Persisted snapshots do not yet contain all facts needed to evaluate reserve,
turnover, freshness, and liquidity without fabrication.

| Item                | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Demo agent          | Atlas                                                                     |
| Demo route          | `/agents/atlas`                                                           |
| Demo decision route | `/agents/atlas/decisions/demo-decision`                                   |
| Demo proof route    | `/proofs/demo-proof`                                                      |
| Disclosure route    | `/disclosures`                                                            |
| Receipt type        | Deterministic simulation; no onchain signature                            |
| Hash anchoring      | Offchain-only decision hash; no memo instruction or transaction signature |
| Interaction status  | Prepared walkthrough plus fresh balanced and oversized demo decision runs |

## ClawPump evidence

| Item                                | Value                                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| API adapter                         | Implemented under `lib/integrations/clawpump/*`                                                                                                    |
| Local support                       | Agent creation/linking, pair discovery, launch preflight                                                                                           |
| Live launch mint                    | Not available                                                                                                                                      |
| Live launch transaction             | Not available                                                                                                                                      |
| Provider request ID for live launch | Not available                                                                                                                                      |
| Blocker                             | Current app has preflight only. Official self-funded launch has no devnet selector; safe owner-approved mainnet execution code does not exist yet. |

## Meteora DBC evidence

| Item                   | Value                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK                    | `@meteora-ag/dynamic-bonding-curve-sdk`                                                                                                                                                |
| Program                | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`                                                                                                                                          |
| Quote mint             | Wrapped SOL, `So11111111111111111111111111111111111111112`                                                                                                                             |
| Config profile         | `navis-equity-v1`                                                                                                                                                                      |
| Config transaction     | Builder implemented; no live signature in this workspace                                                                                                                               |
| Pool transaction       | Builder implemented; no live signature in this workspace                                                                                                                               |
| Pool address/base mint | Not available                                                                                                                                                                          |
| Intent binding         | Submit routes accept only a server-prepared intent ID plus signed bytes; owner, cluster, expiry, message hash and simulation are checked; launch persisted as broadcasting before send |
| Blocker                | Broadcast is hard-blocked in every mode pending a review on a real cluster; no evidence migration `0006` is applied anywhere; all live flags remain false                              |

## PreStocks evidence

| Item             | Value                                                             |
| ---------------- | ----------------------------------------------------------------- |
| API URL          | `https://prestocks.com/api/prestocks`                             |
| Navis API route  | `/api/assets/prestocks`                                           |
| Adapter          | `lib/integrations/prestocks/client.ts`                            |
| Schema           | `lib/integrations/prestocks/schemas.ts`                           |
| Product surface  | Read-only catalogue/disclosure on `/markets/launch`               |
| Execution path   | None                                                              |
| Preview response | HTTP 200; 8 assets captured `2026-09-20T08:29:20.874Z`            |
| Action metadata  | Schema validated; `readOnly=true`, `valueMovementAvailable=false` |

## Compliance notes

- Demo and live modes are labelled separately.
- PreStocks are described as economic exposure, not shares.
- No secret values are documented here.
- No external live address is claimed without a corresponding signature/address row.
- Deployment and Stocklana submission steps are tracked in `docs/DEPLOYMENT_RUNBOOK.md`.
- Copy-ready submission language is staged in `docs/SUBMISSION_DRAFT.md`.
- Open-source and sponsor credits are recorded in `docs/ATTRIBUTIONS.md`.
- Sponsor tracks are optional and judged by the sponsors. Candidates with honest claims: PreStocks and Meteora DBC. ClawPump is not recommended.
- No funded-wallet action, live launch, production database deployment, video, or final submission is claimed; the Vercel demo deployment is recorded above.

## Restoration and database evidence

| Item                 | Verified value                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Active application   | Canonical npm and Next.js application at repository root                                                                                                                 |
| Dependency restore   | Existing dependency versions retained; lock peer metadata normalized with 157 peer/optional path additions and 4 optional removals; no core version upgrade or downgrade |
| Preservation archive | `.restoration/navis-pre-root-20260920.tar.gz`                                                                                                                            |
| Preservation SHA-256 | `11090837a18cce61c4310d995cb218f21745b20a216314165a39890ea638ea65`                                                                                                       |
| Other preserved work | Root scaffold and in-progress application changes saved separately under `.restoration`                                                                                  |
| Development database | Migrations `0000` through `0005` applied in order with journal SHA tracking                                                                                              |
| Production database  | None; the public Vercel demo has no database, so fresh runs are non-persistent                                                                                           |
| Preview health       | Dev health: HTTP 200; `tablesReady=true`, `immutabilityGuardsReady=true`, origin and wallet session configured, no RPC/ClawPump; no secrets exposed                      |
| Public health        | HTTP 200; demo/devnet; database, authentication origin, wallet sessions, Solana RPC, ClawPump, and Meteora not configured; PreStocks and demo AI configured              |
| Deployment lookup    | Navis is deployed on Vercel (READY at `a335681`); it is not published through Replit                                                                                     |

A real wallet extension and signing remain unverified. See `docs/STOCKLANA_JUDGE_AUDIT_V2.md` for the full round 2 audit and its evidence list.

## History

- Baseline, 2026-09-20 morning, commit `ac26e54`: 24 files / 113 tests; first Vercel publish; Chromium QA of the deterministic journey and 10 UI routes at 375/768/1440 px (`docs/evidence/stocklana-browser-audit.json`); dependency audit in `docs/dependency-audit.json`.
- Remediation pass, same day: 26 files / 143 tests; local smoke in `docs/evidence/stocklana-local-smoke.json`; not yet pushed at that time.
- Hardening push, same day, commit `a335681`: fresh decision flow, Meteora intent binding, persist-before-broadcast, same-origin fix; deployed to Vercel.
