# Navis submission readiness

Updated: 2026-09-21 (IST), GitHub `main` at `a41c10a`. Public site: https://navis-gilt.vercel.app. The deployed commit and the public smoke result are recorded in `docs/EVIDENCE.md` under "Final state".

## Official rules verified

| Requirement     | Current source and verification                                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deadline        | Stocklana page, https://hackathons.solana.com/hackathons/stocklana, fetched 2026-09-20: submissions close Friday 25 September 2026, 4:00 pm ET (26 September, 1:30 am IST). Edits allowed until close.                             |
| Judging         | Same page: through 2 October. One question: "could this be a real app that people will actually use?" Judges look for a real user and problem, a working end-to-end demo, a reason it belongs on Solana, and quality of execution. |
| Supporting link | Same page: include at least one of GitHub, live demo, or video.                                                                                                                                                                    |
| Eligibility     | Same page: individuals and teams, one submission per team, original work; open-source components are fine if disclosed.                                                                                                            |
| Sponsor tracks  | How It Works, https://hackathons.solana.com/how-it-works, fetched 2026-09-20: sponsor tracks are optional and sponsors pick their own winners. The main track is separate.                                                         |
| Pitch video     | Same How It Works page: optional, three minutes maximum.                                                                                                                                                                           |
| Technical video | Same How It Works page: optional, five-minute code walkthrough.                                                                                                                                                                    |
| Submit form     | https://hackathons.solana.com/hackathons/stocklana/submit returned only a sign-in prompt during public fetch. Form-only terms remain unconfirmed.                                                                                  |

## Planned entry

- Main Stocklana track.
- Sponsor tracks: PreStocks and Meteora DBC. Not ClawPump (its requirement is a real stock-paired launch, which Navis has not done and cannot safely do in demo posture). Not Pyth (not used).
- Repository: https://github.com/syther069/Navis.
- Live demo: https://navis-gilt.vercel.app.

Track selection is not evidence of sponsor eligibility.

## What the product does now

- Landing screen at `/` with the one-sentence pitch, three proof points, mode and cluster banner, the assurance model and entry links.
- Agent list at `/agents` (Atlas plus the signed-in owner's agents) and agent creation at `/agents/new`.
- Fresh decision runs: Atlas in public without a wallet, on the live PreStocks universe by default (fixture fallback with a visible note); owner-created demo-mode agents persisted as snapshot, decision, policy evaluation, simulated execution attempt and proof receipt in one transaction; devnet and mainnet agents refused with 409.
- Assurance badges (offchain integrity, wallet authorization, onchain settlement; demo or live) on every receipt, decision detail, run result and ledger row; "Why this passed / failed" panel with observed value, limit and fact source per check.
- Real HTTP 404 for unknown decision and proof ids.
- Markets Launch: ClawPump preflight (not configured in public), Meteora DBC with `navis-equity-v1` and the stock-paired `navis-stock-exposure-v1` profile, PreStocks research view.

## Current readiness

| Item                                     | Status                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Public application URL                   | Live: https://navis-gilt.vercel.app                                                                               |
| Live site matches GitHub `main`          | See `docs/EVIDENCE.md`, "Final state" (deployed commit after push and public smoke result)                        |
| Full automated check                     | Passed all nine gates at the final application commit: 46 files / 340 tests; submission audit with zero warnings  |
| Local smoke report                       | `docs/evidence/final-local-smoke.json` (fresh oversized decision on the PreStocks universe)                       |
| Screenshots                              | `docs/evidence/final-*.png`: agent run verdict and receipt hash, proof page, Markets Launch, landing              |
| Same-origin mutation requests            | Trusted behind the proxy; foreign origin 403 (verified on production earlier on 2026-09-20)                       |
| Public database, wallet sessions, origin | Not configured on Vercel (health shows `not_configured`); owner steps in `docs/DEPLOYMENT_RUNBOOK.md`, section 6a |
| Meteora intent binding                   | Implemented in code with tests; broadcast hard-blocked; not live-tested                                           |
| Migrations 0006 and 0007                 | In the repository; applied to no database                                                                         |
| Real wallet extension and signing        | Not tested                                                                                                        |
| Production dependency audit              | 19: 6 high, 13 moderate, 0 critical (`docs/evidence/stocklana-v2-dependency-audit.json`)                          |
| LICENSE file                             | Present: MIT, copyright TANUJ CHANDA, `license` field set in `package.json`, checked by the submission audit      |
| Pitch video, at most 3 minutes           | Not recorded (optional; scenes in `docs/SUBMISSION_DRAFT.md`)                                                     |
| Technical video, at most 5 minutes       | Not recorded (optional; scenes in `docs/SUBMISSION_DRAFT.md`)                                                     |
| ClawPump funded launch                   | Unsupported in current posture                                                                                    |
| Meteora live submission                  | Hard-blocked in every mode                                                                                        |
| Mainnet                                  | Disabled                                                                                                          |
| Registration and team declaration        | Owner to confirm on the form                                                                                      |
| Final submission                         | Not submitted                                                                                                     |

## Sponsor source results

- ClawPump Partner API at https://clawpump.tech/developers was accessible on 2026-09-20. It documents bearer `cpk_` authentication, pair discovery, launch, and self-funded launch routes. The self-funded flow has no documented devnet or cluster selector. Navis supports preflight only and has no safe funded-launch code.
- Stocklana sponsor text requires a ClawPump track entry to launch a token with a stock-paired liquidity pool using ClawPump and Meteora. Navis has no evidence satisfying that requirement.
- Meteora DBC pages at https://docs.meteora.ag/developer-guides/dbc and https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/getting-started were accessible on 2026-09-20. Navis resolves SDK `1.5.12` and builds a stock-paired profile quoted in a PreStocks mint, gated on the Meteora token badge. No config or pool transaction was executed on any cluster. Sponsor text: "working code on mainnet beats slides."
- PreStocks products and https://prestocks.com/api/prestocks were accessible on 2026-09-20. The API returned `contract_address` for 8 assets. Navis reads and validates the catalogue, and the Atlas demo agent uses it as its asset universe.

## Release decision

Ready to submit as an honest demo once the owner completes the form items (registration, team, tracks, optional videos). Do not claim on-chain execution, production persistence, ClawPump launches, or Meteora transactions anywhere in the submission.

## History

- Morning of 2026-09-20 (commit `ac26e54`): 24 files / 113 tests; no public URL yet; fresh proposal generation deferred; release decision was "not ready to submit".
- Remediation pass, same day: 26 files / 143 tests; Vercel demo published at `ac26e54`; hardening not yet pushed.
- Hardening, fresh decision flow, intent binding and origin fix pushed and deployed at `a335681`.
- First-screen intro plus read-only devnet slot probe live at `085e779`; production `SOLANA_RPC_URL` points at the public devnet endpoint.
- CI pipeline, agent list, persisted runs, landing screen, assurance badges, MIT licence and real 404s deployed at `6aa5f32` (44 files / 318 tests at that point).
- Final (2026-09-21): PreStocks verified asset universe, evidence sync, 46 files / 340 tests; deployed at `a41c10a`, public smoke passed.
