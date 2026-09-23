# Navis final fixes and release ledger

Date: 23 September 2026. Production baseline: `ae137135dec290a20ced16a2f516befcf1c63c25`.

## Prioritized fix plan

1. P0: reproduce and repair clean lockfile installation without importing unrelated local work.
2. P0/P1: restore the local broadcast stop; bind transaction RPC to the expected genesis; keep threshold, cluster constants and execution flags unchanged.
3. P2, small security fixes: close logout/checking outage gap, bound burst-limiter memory, improve readiness checks, redact infrastructure errors.
4. P1/P2 evidence honesty: correct obsolete submission instructions, stale-fetch timestamp and misleading all-checks-passed text.
5. Validate the exact candidate, open a protected PR, distinguish candidate from production, verify the live application, and stop.

Changes are intentionally narrow. No mainnet execution enablement, funds, production migration, unrelated feature merge, bulk refactor or fake sponsor evidence.

## Findings, root causes and disposition

| ID / priority               | Finding and root cause                                                   | Fix or disposition                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 P0                      | CI lockfile incomplete after incremental dependency installation         | Resolved: missing emnapi/native optional metadata restored; clean Node 22.23.2/npm 11.19.1 install of 833 packages passes; no disabled checks |
| F02 P0 local only           | Devnet broadcast gate in local main contradicts final brief              | Restore unconditional stop; production already stopped                                                                                        |
| F03 P1 safety               | RPC cluster label not genesis-bound at Meteora transaction boundary      | Add fail-closed genesis validation; do not enable submit                                                                                      |
| F04 P2                      | Logout skips DELETE while session checking/anonymous after a read outage | Always attempt durable logout; preserve uncertainty/retry and prevent unsafe session replacement                                              |
| F05 P2                      | Process-local limiter retains identities forever                         | Expire idle identities, cap at 10,000, fail closed instead of evicting live limits                                                            |
| F06 P2                      | Health misses migrations needed by auth/public demo/identity uniqueness  | Require rate-limit table, scope/idempotency columns and uniqueness indexes; expose validated Vercel SHA only                                  |
| F07 P2                      | Prepare/simulate returns raw infrastructure Error.message                | Keep typed user errors; redact unexpected server failures                                                                                     |
| F08 P1                      | Docs say public Atlas runs lack persistence/detail links                 | Reconcile docs with actual PostgreSQL-backed public decision/proof flow and no-DB fallback                                                    |
| F09 P2                      | Cached PreStocks response gets a new timestamp on every read             | Remove false freshness; disclose absent provider observation timestamp                                                                        |
| F10 P2                      | Approved receipt says every check passed despite warnings                | Show passed/warn/failed counts accurately                                                                                                     |
| F11 P1 external/product     | ClawPump preflight/read success mistaken for combined bounty flow        | No launch claim; 403 authorization and undocumented ClawPump-to-Meteora same-token handoff remain blocked                                     |
| F12 P1 external             | PreStocks stock quote requires absent Meteora token badges               | No bypass or substituted asset; sponsor issuance/authorization needed                                                                         |
| F13 P1 product              | Real-agent decision execution deliberately unsupported                   | Preserve guard and position Atlas as research simulation, not end-to-end autonomous trading                                                   |
| F14 P2                      | No shared quotas on several costly/record-creating endpoints             | Unresolved; do not live-flood; add scoped quotas separately                                                                                   |
| F15 P2                      | Standalone receipt lacks full raw PolicyFacts replay                     | Document integrity limit; not a claim of full historical deterministic replay                                                                 |
| F16 P2                      | Fixture sizing/reserve assumptions not live proposal/treasury facts      | Demo-only limitation; do not use as live authorization evidence                                                                               |
| F17 P2                      | Reconciliation verifies selected identities, not every config parameter  | Document narrow guarantee; full parameter attestation remains                                                                                 |
| F18 P2                      | Smoke report only saved on success                                       | Remains; retain fresh audit timestamps and never reuse an old success as new evidence                                                         |
| F19 P2                      | Transitive dependency advisories                                         | Compatibility/reachability review; no unsafe forced major upgrade                                                                             |
| F20 P2 operational          | Production health provider status is a stored prior observation          | Audit labels age explicitly; fresh provider GET evidence captured separately                                                                  |
| F21 P2 tests                | Reported public-Atlas DB deadlock test risk                              | Record exact observed result of final suite; no retries used to conceal failures                                                              |
| F22 external                | Registration/submission/originality/team declaration unknown             | Owner confirmation/submission needed before official deadline                                                                                 |
| F23 P2                      | Authenticate and Disconnect could overlap in one tab                     | Serialize the two client actions and test delayed verify; cross-tab issuance races remain a documented limitation                             |
| F24 P2 legacy compatibility | Tokens predating jti revocation cannot be individually revoked           | Retain original bounded eight-hour expiry; qualify all revocation claims                                                                      |

## Scope and lineage

- Audit branch: `audit/final-readiness`, based on `origin/main` at the production baseline.
- Deliberately excluded: local devnet/replay delta and cancelled stock-filter PR.
- Implementation commits use author and committer `TANUJ CHANDA <191589705+syther069@users.noreply.github.com>`.
- Do not force-push, bypass required checks or silently change execution flags.

## Validation and deployment ledger

The complete local check ran successfully on implementation/report commit `b5b3df1` (the subsequent report update changes documentation only). The final PR head must independently pass the required GitHub check before release. Pending is not passing.

| Check                                                         | Result                                                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production auth/session/replay/isolation/nonce limit baseline | PASS, 23 Sep 2026 08:17 UTC                                                                                                                                      |
| Production judge smoke baseline                               | PASS, real persisted PreStocks simulation and proof                                                                                                              |
| Security scanners baseline                                    | SAST/privacy no findings; 4 high + 2 moderate dependency advisories                                                                                              |
| Burst limiter and health targeted tests                       | PASS, 8 tests                                                                                                                                                    |
| Clean candidate install                                       | PASS, Node 22.23.2 and npm 11.19.1, 833 packages                                                                                                                 |
| Candidate format/lint/typecheck/unit+route+DB tests           | PASS; 67 files, 511 tests, including enabled development DB tests                                                                                                |
| Candidate production build / smoke / submission audit         | PASS; build, judge smoke, registry gate, Drizzle check and submission audit                                                                                      |
| Browser validation                                            | Production baseline PASS: Chromium reload, restart and re-sign-in; candidate logout failures covered by interaction tests, not an extension-wallet browser claim |
| GitHub required checks                                        | Pending                                                                                                                                                          |
| Candidate locally tested implementation/report SHA            | `b5b3df1`; exact final PR head is tested again by required GitHub CI                                                                                             |
| GitHub main SHA                                               | `ae137135dec290a20ced16a2f516befcf1c63c25` at initial check                                                                                                      |
| Vercel production SHA                                         | `ae137135dec290a20ced16a2f516befcf1c63c25` at initial check                                                                                                      |
| Audit fixes deployed?                                         | Not yet established                                                                                                                                              |

No statement that tested == GitHub main == Vercel may be made while the candidate is pending or only on a PR branch.

## Implementation and regression coverage

| Fixes       | Files changed                                                                                           | Added or expanded tests and result                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| F01         | `package-lock.json` only                                                                                | Original EUSAGE reproduced; clean copy without node_modules, Node 22.23.2/npm 11.19.1 install PASS; registry gate PASS |
| F02         | Local main only: `lib/integrations/meteora/broadcast-safety.ts`, `tests/meteora-broadcast-gate.test.ts` | Six gate tests PASS; local stop commit `9cb855a`; release gate already unconditionally false and unchanged             |
| F03/F07     | `lib/integrations/meteora/client.ts`, `errors.ts`; config/pool prepare/simulate routes                  | Cluster-binding and error-redaction tests, updated config/quote-profile fixtures; 70 targeted tests PASS               |
| F04/F23     | `lib/auth/server.ts`, auth session/verify routes, `components/wallet/wallet-control.tsx`                | Session replacement/outage and delayed-verify interaction coverage; 59 targeted auth/security tests PASS               |
| F05/F06     | `lib/auth/rate-limit.ts`, health route                                                                  | Bounded-rate-limit and expanded health-route tests; eight tests PASS                                                   |
| F08         | README, `docs/SUBMISSION_DRAFT.md`, `SUBMISSION_READINESS.md`, `DEMO_SCRIPT.md`                         | Submission audit PASS, no fabricated transaction or sponsor claim                                                      |
| F09/F10     | `lib/integrations/prestocks/client.ts`, `components/proofs/proof-receipt-view.tsx`                      | Fresh/no-store/timeout/schema tests and approved-with-warning/rejected view tests; 15 targeted tests PASS              |
| F11-F22/F24 | Audit and submission disclosures rather than fabricated implementations                                 | See audit report for source/runtime evidence and unresolved/external classification                                    |

## Deployment handoff

The fixes are not claimed deployed merely because this ledger is committed. Keep production at the existing verified SHA until the protected audit PR passes and is explicitly released. The final delivery includes the PR URL, its exact head, CI status and independently retrieved production SHA. A subsequent release must rerun live auth/replay/persistence/health checks on that SHA.

No execution flags or validated threshold/genesis constants were changed. Verification sessions used ephemeral unfunded test keypairs. The browser replay check necessarily created three test agents; no existing user data was deleted.
