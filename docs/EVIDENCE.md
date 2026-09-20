# Navis Evidence Manifest

Updated: 2026-09-20.

This manifest records what can be proven from the current local workspace and what remains externally blocked.

## Local build evidence

| Gate                                          | Latest local result                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run format:check`                        | Passed                                                                              |
| `npm run lint`                                | Passed                                                                              |
| `npm run typecheck`                           | Passed                                                                              |
| `npm test`                                    | Passed: 24 files / 113 tests                                                        |
| `npm run build`                               | Passed: production Next.js 16.3.5 build                                             |
| `npm run smoke:judge`                         | Passed: 11-route deterministic demo flow including `/agents/new`                    |
| `node node_modules/drizzle-kit/bin.cjs check` | Passed                                                                              |
| `npm run check`                               | Fresh pass: all 8 gates, 24 test files / 113 tests                                  |
| `npm run submission:audit`                    | Passed with expected external-evidence TODO warning                                 |
| Deployed URL smoke verifier                   | Implemented and validated against a temporary local origin; no public URL recorded  |
| Local browser QA                              | Passed clean flow, responsive/accessibility checks, and nonce-origin runtime checks |

## Public URLs

| Item                | Value                                       |
| ------------------- | ------------------------------------------- |
| Deployed demo URL   | Not published or recorded                   |
| Repository URL      | https://github.com/syther069/Navis.git      |
| Demo video URL      | Not recorded                                |
| Pitch video URL     | Not recorded; official maximum is 3 minutes |
| Technical video URL | Not recorded; official maximum is 5 minutes |

## Demo evidence

| Item                | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Demo agent          | Atlas                                                                       |
| Demo route          | `/agents/atlas`                                                             |
| Demo decision route | `/agents/atlas/decisions/demo-decision`                                     |
| Demo proof route    | `/proofs/demo-proof`                                                        |
| Disclosure route    | `/disclosures`                                                              |
| Receipt type        | Deterministic simulation; no onchain signature                              |
| Hash anchoring      | Offchain-only decision hash; no memo instruction or transaction signature   |
| Interaction status  | Recorded deterministic walkthrough verified; fresh proposal wiring deferred |

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

| Item                   | Value                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| SDK                    | `@meteora-ag/dynamic-bonding-curve-sdk`                                                             |
| Program                | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`                                                       |
| Quote mint             | Wrapped SOL, `So11111111111111111111111111111111111111112`                                          |
| Config profile         | `navis-equity-v1`                                                                                   |
| Config transaction     | Builder implemented; no live signature in this workspace                                            |
| Pool transaction       | Builder implemented; no live signature in this workspace                                            |
| Pool address/base mint | Not available                                                                                       |
| Blocker                | Signed input is not yet server-bound to a previously prepared proposal; all live flags remain false |

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
- Main track plus at most three sponsor tracks is the current platform rule. Planned sponsor targets are ClawPump, Meteora DBC, and PreStocks.
- No funded-wallet action, live launch, production deployment, video, or final submission is claimed.

## Restoration and database evidence

| Item                 | Verified value                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Active application   | Canonical npm and Next.js application at repository root                                                                                                                 |
| Dependency restore   | Existing dependency versions retained; lock peer metadata normalized with 157 peer/optional path additions and 4 optional removals; no core version upgrade or downgrade |
| Preservation archive | `.restoration/navis-pre-root-20260920.tar.gz`                                                                                                                            |
| Preservation SHA-256 | `11090837a18cce61c4310d995cb218f21745b20a216314165a39890ea638ea65`                                                                                                       |
| Other preserved work | Root scaffold and in-progress application changes saved separately under `.restoration`                                                                                  |
| Development database | Migrations `0000` through `0005` applied in order with journal SHA tracking                                                                                              |
| Production database  | Not published or migrated                                                                                                                                                |
| Preview health       | HTTP 200; `tablesReady=true`, `immutabilityGuardsReady=true`; no secrets exposed                                                                                         |
| Deployment lookup    | `success=true`, `isDeployed=false`, empty `primaryUrl`; no public URL exists                                                                                             |

Focused agent ownership and sponsor safety tests pass. Local browser QA and runtime nonce-origin checks pass; see `docs/LOCAL_QA.md` and `docs/evidence/navis-root-preview.jpg`. A real wallet extension and signing remain unverified. The production audit result is recorded in `docs/dependency-audit.json`: 19 advisories, 6 high and 13 moderate, with no critical findings.
