# Navis Security Review Checklist

Updated: 2026-09-19.

## Review summary

No P0 local findings remain from the checks below. Live deployment, real sponsor execution, and production secret review still require the final hosted environment.

## Checks performed

| Area                   | Evidence                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment validation | `lib/env-core.ts` rejects invalid execution flags, missing RPC for live execution, mainnet without `MAINNET_RELEASE_APPROVED`, short session secrets, malformed ClawPump keys, and incomplete OpenAI config.                        |
| Secret exposure        | Server-only keys are not under `NEXT_PUBLIC_*`; `.env*` is ignored by git.                                                                                                                                                          |
| Wallet auth replay     | Nonce/session tests cover challenge verification, expiry, and domain-bound signatures.                                                                                                                                              |
| Session CSRF           | Auth nonce, verification, agent creation, sponsor transaction routes, and session deletion require a trusted mutation origin.                                                                                                       |
| Demo isolation         | Demo receipts do not contain real signatures or explorer links.                                                                                                                                                                     |
| Hash anchoring honesty | Proof receipts include a `hashAnchoring` field; demo receipts must remain `offchain_only` and tests reject fake memo/signature anchoring claims.                                                                                    |
| Prompt injection       | AI prompt-hardening tests reject malformed/hostile model output.                                                                                                                                                                    |
| Transaction evidence   | Execution services store signatures only after RPC submission and treat timeouts as pending/unknown, not false failure.                                                                                                             |
| Meteora signing        | Signed transaction parsing verifies payer, message hash, and signatures before simulate/submit.                                                                                                                                     |
| PreStocks safety       | Schema requires provider `contract_address`; ticker values cannot stand in for mints.                                                                                                                                               |
| Health endpoint        | `/api/health` returns non-secret configuration/readiness state and database reachability without exposing URLs or keys.                                                                                                             |
| Dependency audit       | `npm audit --omit=dev` reports 19 remaining production advisories: 13 moderate and 6 high, transitive through Solana/Meteora/Anchor/Jayson dependency chains. Non-forced `npm audit fix` was attempted; no forced override applied. |

## Latest local gate

- `npm run check`: passed format, lint, typecheck, 22 test files / 103 tests, production build, clean-session judge-flow smoke, Drizzle schema validation, and submission audit.
- `npm run submission:audit`: passed required file/disclosure checks with one expected warning for TODO markers that require external deployment/repository/video/live-evidence inputs.
- `npm audit --omit=dev`: still reports 19 production advisories: 13 moderate and 6 high, with no non-forced fix available in the current dependency graph.

## Required before production/mainnet

- Provision hosted secrets through the deployment platform.
- Verify no secret appears in build logs, screenshots, demo video, or submission materials.
- Use a funded wallet only after a human reviews transaction summary, cluster, programs, mints, fees, and expiry.
- Add live evidence to `docs/EVIDENCE.md` before claiming any deployed ClawPump or Meteora transaction.
- Re-run dependency audit and document any remaining accepted risk.
- Keep `docs/ATTRIBUTIONS.md` current if dependencies or sponsor SDKs change before submission.
