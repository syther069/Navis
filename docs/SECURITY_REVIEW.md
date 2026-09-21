# Navis Security Review Checklist

Updated: 2026-09-20.

## Review summary

Current `main` passes all nine automated gates, including 40 test files / 300 tests and the judge smoke with a fresh decision. The hardening below is deployed on the public Vercel demo at GitHub `main` commit `a335681`. At the time of this review the public demo had no database, sessions or RPC configured; database, sessions, origin and RPC were configured on 2026-09-20 and 2026-09-21 (see `EVIDENCE.md`). Real wallet signing and production secret review remain open. See `REMEDIATION_REPORT.md` for the remediation pass and `STOCKLANA_JUDGE_AUDIT_V2.md` for the latest independent audit.

## Hardening after the judge audit (deployed at `a335681`)

- Receipt verification now checks document/context cross-references, mode/cluster/agent coherence, policy approval and reconstructible policy outcomes. Confirmed receipt evidence requires a syntactically valid signature and the correct canonical explorer URL. It does not independently verify chain settlement or authorship, and cannot recompute the full policy input hash without the complete facts object.
- Live policy evaluations now fail closed when liquidity is unknown; demo evaluations retain an explicit warning.
- Session parsing requires a valid Solana wallet, UUID subject and expiration in addition to JWT signature/issuer/audience checks.
- Both Meteora broadcast routes have a code-level safety block that environment flags cannot enable. The UI exposes the same unavailable state. Prepared transactions are now bound to short-lived, wallet-owned database intents through simulation and submission. Submission records a `broadcasting` launch and consumes the intent idempotently before any RPC broadcast call. This ordering has automated coverage but no live broadcast has been tested.
- New Meteora configuration confirmations reject incomplete or inconsistent RPC evidence, use actual block time, preserve terminal/pool state, compare current status on updates and sanitize upstream errors. Existing historical records were not migrated or re-certified.
- Fresh dependency, SAST and privacy scans were run during the audit. SAST and privacy scans returned no findings; dependency findings remain unresolved. Absence of static findings is not a security certification.
- Mutation origin checks now trust same-origin requests behind the deployment proxy using `x-forwarded-host`; foreign origins still receive 403. Verified on production on 2026-09-20.
- The new `execution_intents` table ships as migration `0006`. At the time of this review it was applied to no database; on 2026-09-21 migrations `0000` through `0007` were applied to the public site's database. The development database still has `0000` through `0005`.

## Checks performed

| Area                   | Evidence                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment validation | `lib/env-core.ts` rejects invalid execution flags, missing RPC for live execution, mainnet without `MAINNET_RELEASE_APPROVED`, short session secrets, malformed ClawPump keys, and incomplete OpenAI config.                                                                 |
| Secret exposure        | Server-only keys are not under `NEXT_PUBLIC_*`; `.env*` is ignored by git.                                                                                                                                                                                                   |
| Wallet auth replay     | Nonce/session tests cover challenge verification, expiry, and domain-bound signatures.                                                                                                                                                                                       |
| Wallet auth origin     | Only development may derive preview origin from the exact runtime `REPLIT_DEV_DOMAIN`. Production blocks until explicit HTTPS `NEXT_PUBLIC_APP_URL`; settings and health expose only a capability boolean.                                                                   |
| Runtime nonce origin   | Same-origin preview request returned HTTP 200 with `no-store` and exact HTTPS origin binding; foreign and missing origins returned HTTP 403. No secrets were printed.                                                                                                        |
| Session CSRF           | Auth nonce, verification, agent creation, sponsor transaction routes, and session deletion require a trusted mutation origin.                                                                                                                                                |
| Demo isolation         | Demo receipts do not contain real signatures or explorer links.                                                                                                                                                                                                              |
| Hash anchoring honesty | Proof receipts include a `hashAnchoring` field; demo receipts must remain `offchain_only` and tests reject fake memo/signature anchoring claims.                                                                                                                             |
| Prompt injection       | AI prompt-hardening tests reject malformed/hostile model output.                                                                                                                                                                                                             |
| Transaction evidence   | Pending/unknown confirmation handling is covered. The launch record is persisted as `broadcasting` before any send, so a transport failure cannot leave an unrecorded broadcast; the full broadcast-error path has automated coverage but no live test.                      |
| Meteora signing        | Signed bytes are bound to a server-prepared intent: owner, cluster, expiry, message hash and simulation are checked, and wrong owner, expired, unsimulated or mismatched hashes are rejected in tests. Broadcast is hard-blocked in every mode; all live flags remain false. |
| ClawPump execution     | Preflight errors are sanitized; the raw preflight token is neither persisted nor returned, only its hash. Exact terms, pair, and payment evidence is tested. Funded execution remains unsupported.                                                                           |
| PreStocks safety       | Schema requires provider `contract_address`; ticker values cannot stand in for mints.                                                                                                                                                                                        |
| Health endpoint        | Preview `/api/health` returned 200 with `tablesReady` and `immutabilityGuardsReady` true. Public origin capability is exposed only as a boolean; no URL or secret is returned.                                                                                               |
| Database bounds        | The pool uses a 5-second connection timeout, 10-second statement timeout, and 12-second query timeout.                                                                                                                                                                       |
| Dependency audit       | `npm audit --omit=dev` reports 19 production advisories: 6 high, 13 moderate, and 0 critical. `docs/evidence/stocklana-v2-dependency-audit.json` contains the machine-readable result. No forced override is approved.                                                       |

## Adversarial claim-to-test map

Every safety claim below is backed by a named automated test in the local gate. A green run proves the local behaviour only; it is not onchain evidence.

| Claim                                                                                                            | Test file                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Signed Meteora bytes altered after signing (message byte, signature byte, unsigned, wrong payer, substituted tx) | `tests/meteora-signed-transaction.test.ts` (real `parseVerifiedSignedTransaction`, keypair-signed transactions)            |
| Submit route rejects wrong owner, expired, unsimulated or hash-mismatched intents                                | `tests/meteora-intent.test.ts`                                                                                             |
| Replayed Meteora submit does not rebroadcast; status-specific idempotent replies                                 | `tests/meteora-intent.test.ts`, `tests/meteora-intent-concurrency.test.ts`                                                 |
| Receipt with a substituted strategy (hashes correct, universe or allowed actions no longer cover the decision)   | `tests/proof-receipt.test.ts` ("semantically mismatched documents")                                                        |
| Receipt with a portfolio snapshot from another agent                                                             | `tests/proof-receipt.test.ts` (schema rejects the context copy; `agentCoherence` rejects the top-level copy)               |
| Receipt with a policy input hash from other facts                                                                | `tests/proof-receipt.test.ts` (breaks the published receipt hash), `tests/execution-state.test.ts` (gate refuses mismatch) |
| Demo receipts cannot be relabelled live or carry signatures, explorer links or anchoring claims                  | `tests/proof-receipt.test.ts`                                                                                              |
| Confirmed receipts need a valid signature and canonical explorer URL for the right cluster                       | `tests/proof-receipt.test.ts`                                                                                              |
| Stale, future-dated market data and expired quotes fail closed in devnet and mainnet                             | `tests/policy-runner.test.ts` ("adversarial live-mode inputs")                                                             |
| Missing, undated, stale or insufficient liquidity blocks BUY, SELL and REBALANCE in live modes; HOLD allowed     | `tests/policy-runner.test.ts` ("liquidity in devnet/mainnet")                                                              |
| Demo mode only warns on missing or stale liquidity                                                               | `tests/policy-runner.test.ts`                                                                                              |
| Replayed decision run request yields a fresh decision, never a reused or executed one                            | `tests/decisions-run-route.test.ts`, `tests/run-decision.test.ts`                                                          |
| Duplicate execution attempt for one decision (same key returns the same row; new key is refused)                 | `tests/persisted-decision-run.test.ts` (database), `tests/execution-state.test.ts` (gate)                                  |
| Persisted-agent run or execution by a non-owner session                                                          | `tests/decisions-run-route.test.ts`, `tests/persisted-decision-run.test.ts`, `tests/execution-state.test.ts`               |
| RPC timeout, network, invalid response, unseen signature, processed-only or missing transaction evidence         | `tests/reconciliation-outcomes.test.ts` (all map to `unknown_pending`, never `failed` or `confirmed`)                      |
| Meteora confirmation refuses inconsistent RPC evidence and sanitizes provider failures                           | `tests/meteora-route-safety.test.ts`, `tests/meteora-reconciliation.test.ts`                                               |
| Execution state machine refuses skipped, repeated or post-terminal transitions and evidence-free confirmations   | `tests/execution-state.test.ts`                                                                                            |

Behaviour changed by this sweep (2026-09-20): the policy runner now requires a dated liquidity measurement (`liquidityObservedAt`) for value-moving proposals in devnet and mainnet; an undated or stale (older than `max_data_age_seconds`) figure fails closed there and only warns in demo, where the figure is a labelled fixture. A HOLD proposal no longer needs a liquidity figure in any mode because it moves no value, and the receipt verifier now reconstructs that HOLD outcome. Known limit, stated rather than hidden: the public receipt does not include the policy facts, so a fully rehashed receipt with a foreign `policyEvaluation.inputHash` passes local verification; the binding to the real facts is the immutable stored evaluation row plus the execution gate.

## Latest automated local gate

- `npm run check`: pass on 2026-09-20 at current `main` across format, lint, typecheck, 40 test files / 300 tests (database-backed cases included; they skip without `DATABASE_URL`), production Next.js build, judge smoke (11 routes, PreStocks API, fresh oversized decision), Drizzle schema validation, and submission audit.
- History: the pre-remediation baseline at `ac26e54` passed with 24 files / 113 tests; the remediation pass with 26 files / 143 tests.
- `npm run submission:audit`: passed required file/disclosure checks with one expected warning for TODO markers that require external deployment/repository/video/live-evidence inputs.
- `npm audit --omit=dev`: 19 production advisories, comprising 6 high and 13 moderate findings with no critical findings. Core advisory roots are `bigint-buffer` (GHSA-3gc7-fjrx-p6mg), `toml` (GHSA-82x6-q7mm-w9cf and GHSA-v5mp-jgw5-2x6j), `stream-json` (GHSA-528h-pc64-c93x), and `uuid` (GHSA-w5hq-g745-h8pq), inherited through Solana/Meteora dependency chains. These findings remain unresolved and are not a security certification.

## Required before production wallet operations or mainnet

- Provision hosted secrets through the deployment platform.
- Verify no secret appears in build logs, screenshots, demo video, or submission materials.
- Use a funded wallet only after a human reviews transaction summary, cluster, programs, mints, fees, and expiry.
- Add live evidence to `docs/EVIDENCE.md` before claiming any deployed ClawPump or Meteora transaction.
- Review the recorded dependency audit and explicitly accept or remediate remaining risk without forced core dependency changes.
- Keep all live flags false until the Meteora prepared-proposal binding gate is implemented and retested.
- Do not add a ClawPump funded-launch path without explicit owner approval and reviewed paid-retry, signature, and persistence behavior.
- Keep `docs/ATTRIBUTIONS.md` current if dependencies or sponsor SDKs change before submission.
