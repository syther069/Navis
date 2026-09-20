# Navis submission readiness

Updated: 2026-09-20.

## Official rules verified

| Requirement         | Current source and verification                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deadline            | Stocklana page, https://hackathons.solana.com/hackathons/stocklana, fetched 2026-09-20: Friday, September 25, 2026 at 4:00 p.m. ET.                             |
| Judging             | Same Stocklana page: judging continues through October 2.                                                                                                       |
| Supporting link     | Same Stocklana page: include at least one of GitHub, live demo, or video.                                                                                       |
| Sponsor-track limit | How It Works, https://hackathons.solana.com/how-it-works, fetched 2026-09-20: choose up to three sponsor tracks. The main track is separate.                    |
| Pitch video         | Same How It Works page: three minutes maximum.                                                                                                                  |
| Technical video     | Same How It Works page: five-minute code walkthrough.                                                                                                           |
| Submit form         | https://hackathons.solana.com/hackathons/stocklana/submit returned only a sign-in prompt during public fetch on 2026-09-20. Form-only terms remain unconfirmed. |

## Planned entry

- Main Stocklana track.
- At most three sponsor tracks: ClawPump, Meteora DBC, and PreStocks.
- Repository: https://github.com/syther069/Navis.git.

Track selection is not evidence of sponsor eligibility.

## Current readiness

| Item                                 | Status                                    |
| ------------------------------------ | ----------------------------------------- |
| Root npm and Next.js restoration     | Complete and freshly baseline-verified    |
| Original deterministic demo          | Verified by the 11-route smoke            |
| Fresh proposal generation            | Deferred, not part of this phase          |
| Full automated check                 | Passed all 8 gates, 24 files / 113 tests  |
| Focused agent create/read fix        | Passed focused tests and smoke            |
| Focused sponsor corrections          | Passed focused tests                      |
| Local browser and nonce-origin QA    | Passed                                    |
| Real wallet extension and signing    | Not tested                                |
| Production dependency audit          | 19: 6 high, 13 moderate, 0 critical       |
| Public application URL               | Missing                                   |
| Replit production database migration | Pending user Publish flow                 |
| Deployed smoke report                | Missing                                   |
| Pitch video, at most 3 minutes       | Missing                                   |
| Technical video, at most 5 minutes   | Missing                                   |
| ClawPump funded launch               | Unsupported in current posture            |
| Meteora live submission              | Blocked by prepared-proposal binding gate |
| Mainnet                              | Disabled                                  |
| Final submission                     | Not submitted                             |

## Sponsor source results

- ClawPump Partner API at https://clawpump.tech/developers was accessible on 2026-09-20. It documents bearer `cpk_` authentication, pair discovery, launch, and self-funded launch routes. The self-funded flow has no documented devnet or cluster selector. Current Navis supports preflight only and has no safe funded-launch code.
- Stocklana sponsor text requires a ClawPump track entry to launch a token with a stock-paired liquidity pool using ClawPump and Meteora. Navis has no evidence satisfying that requirement.
- Meteora DBC pages at https://docs.meteora.ag/developer-guides/dbc and https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/getting-started were accessible on 2026-09-20. Navis resolves SDK `1.5.12`. No config or pool transaction was executed.
- PreStocks products and https://prestocks.com/api/prestocks were accessible on 2026-09-20. The API returned `contract_address`. Public disclosures state economic exposure without ownership or voting rights, possible total loss, no guaranteed liquidity, and U.S. and other eligibility restrictions.

## Release decision

Not ready to submit. Local browser and nonce-origin QA passed, but no real wallet extension or signing was tested. `getDeploymentInfo` currently reports `success=true`, `isDeployed=false`, and an empty `primaryUrl`, so no public URL exists. The user may Publish through Replit with safe demo flags and accept the production database schema prompt. Only after a real public origin is verified should the user set production `NEXT_PUBLIC_APP_URL` through Secrets and Republish. Then verify production health, judge routes, real-wallet behavior, and save the deployed report before preparing the final manual submission.
