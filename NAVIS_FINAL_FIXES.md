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

This section is completed after the coherent change set is ready. Pending is not passing.

| Check                                                         | Result                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Production auth/session/replay/isolation/nonce limit baseline | PASS, 23 Sep 2026 08:17 UTC                                         |
| Production judge smoke baseline                               | PASS, real persisted PreStocks simulation and proof                 |
| Security scanners baseline                                    | SAST/privacy no findings; 4 high + 2 moderate dependency advisories |
| Burst limiter and health targeted tests                       | PASS, 8 tests                                                       |
| Clean candidate install                                       | PASS, Node 22.23.2 and npm 11.19.1, 833 packages                    |
| Candidate format/lint/typecheck/unit+route+DB tests           | Pending                                                             |
| Candidate production build / smoke / submission audit         | Pending                                                             |
| Browser validation                                            | Pending                                                             |
| GitHub required checks                                        | Pending                                                             |
| Candidate tested SHA                                          | Pending                                                             |
| GitHub main SHA                                               | `ae137135dec290a20ced16a2f516befcf1c63c25` at initial check         |
| Vercel production SHA                                         | `ae137135dec290a20ced16a2f516befcf1c63c25` at initial check         |
| Audit fixes deployed?                                         | Not yet established                                                 |

No statement that tested == GitHub main == Vercel may be made while the candidate is pending or only on a PR branch.
