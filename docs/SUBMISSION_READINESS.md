# Navis submission readiness

Updated: 2026-09-20 (evening IST), current `main`. Public site: https://navis-gilt.vercel.app at GitHub `main` commit `085e779`.

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
- Sponsor tracks under consideration: PreStocks and Meteora DBC. ClawPump is not recommended (its requirement is a real stock-paired launch, which Navis has not done and cannot safely do in demo posture). Pyth is not used.
- Repository: https://github.com/syther069/Navis.git.
- Live demo: https://navis-gilt.vercel.app.

Track selection is not evidence of sponsor eligibility.

## Current readiness

| Item                               | Status                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Public application URL             | Live: https://navis-gilt.vercel.app, Vercel production READY at `085e779`                                   |
| Live site matches GitHub `main`    | Yes at `085e779`: first-screen intro, live devnet slot probe, doc refresh and lockfile fix are deployed.    |
| Original deterministic demo        | Verified by the 11-route smoke against production                                                           |
| Fresh decision generation          | Live on the public site: Balanced approved, Oversized rejected, receipt verified (real browser, 2026-09-20) |
| Fresh decision detail link         | Unreliable on Vercel (memory store per serverless instance). Tracked as an open task.                       |
| Full automated check               | Passed all 8 gates at current `main`: 44 files / 318 tests                                                  |
| Deployed smoke report              | `docs/evidence/stocklana-v2-public-smoke.json`                                                              |
| Same-origin mutation requests      | Fixed and verified on production: same origin 200, foreign origin 403                                       |
| Meteora intent binding             | Implemented in code with tests; broadcast hard-blocked; not live-tested                                     |
| Migration 0006 (execution intents) | No evidence it is applied to any database                                                                   |
| Real wallet extension and signing  | Not tested                                                                                                  |
| Production dependency audit        | 19: 6 high, 13 moderate, 0 critical (`docs/evidence/stocklana-v2-dependency-audit.json`)                    |
| LICENSE file                       | Present: MIT, copyright TANUJ CHANDA, `license` field set in `package.json`                                 |
| Pitch video, at most 3 minutes     | Missing                                                                                                     |
| Technical video, at most 5 minutes | Missing                                                                                                     |
| ClawPump funded launch             | Unsupported in current posture                                                                              |
| Meteora live submission            | Hard-blocked in every mode                                                                                  |
| Mainnet                            | Disabled                                                                                                    |
| Registration and team declaration  | Owner to confirm on the form                                                                                |
| Final submission                   | Not submitted                                                                                               |

## Sponsor source results

- ClawPump Partner API at https://clawpump.tech/developers was accessible on 2026-09-20. It documents bearer `cpk_` authentication, pair discovery, launch, and self-funded launch routes. The self-funded flow has no documented devnet or cluster selector. Navis supports preflight only and has no safe funded-launch code.
- Stocklana sponsor text requires a ClawPump track entry to launch a token with a stock-paired liquidity pool using ClawPump and Meteora. Navis has no evidence satisfying that requirement.
- Meteora DBC pages at https://docs.meteora.ag/developer-guides/dbc and https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/getting-started were accessible on 2026-09-20. Navis resolves SDK `1.5.12`. No config or pool transaction was executed on any cluster. Sponsor text: "working code on mainnet beats slides."
- PreStocks products and https://prestocks.com/api/prestocks were accessible on 2026-09-20. The API returned `contract_address`. Navis reads the catalogue and validates it; the demo agent does not yet consume PreStocks data in its decisions.

## Release decision

Ready to submit as an honest demo once the owner completes the form items (registration, team, tracks, optional videos) and, ideally, the open tasks from `docs/STOCKLANA_JUDGE_AUDIT_V2.md`: the unreliable decision detail link and pushing the first-screen intro so the live site explains the product. Do not claim on-chain execution, production persistence, ClawPump launches, or Meteora transactions anywhere in the submission.

## History

- Morning of 2026-09-20 (commit `ac26e54`): 24 files / 113 tests; no public URL yet; fresh proposal generation deferred; release decision was "not ready to submit".
- Remediation pass, same day: 26 files / 143 tests; Vercel demo published at `ac26e54`; hardening not yet pushed.
- Hardening, fresh decision flow, intent binding and origin fix pushed and deployed at `a335681`.
- Current: first-screen intro plus read-only devnet slot probe live at `085e779`; production `SOLANA_RPC_URL` points at the public devnet endpoint, execution flags unchanged.
