# Navis Security Review Checklist

Updated: 2026-09-20.

## Review summary

The pre-remediation baseline passed all eight automated gates, including 24 test files / 113 tests and the 11-route smoke. The public Vercel demo is now independently verified, but its database, authentication origin, sessions and RPC are not configured. Real wallet signing and production secret review remain open. See `REMEDIATION_REPORT.md` for the separate local hardening pass and final validation.

## Local hardening after the judge audit

- Receipt verification now checks document/context cross-references, mode/cluster/agent coherence, policy approval and reconstructible policy outcomes. Confirmed receipt evidence requires a syntactically valid signature and the correct canonical explorer URL. It does not independently verify chain settlement or authorship, and cannot recompute the full policy input hash without the complete facts object.
- Live policy evaluations now fail closed when liquidity is unknown; demo evaluations retain an explicit warning.
- Session parsing requires a valid Solana wallet, UUID subject and expiration in addition to JWT signature/issuer/audience checks.
- Both Meteora broadcast routes have a code-level safety block that environment flags cannot enable. The UI exposes the same unavailable state. Exact preparation/simulation binding, pool account verification, durable idempotency and broadcast recovery still require implementation and review.
- New Meteora configuration confirmations reject incomplete or inconsistent RPC evidence, use actual block time, preserve terminal/pool state, compare current status on updates and sanitize upstream errors. Existing historical records were not migrated or re-certified.
- Fresh dependency, SAST and privacy scans were run during the audit. SAST and privacy scans returned no findings; dependency findings remain unresolved. Absence of static findings is not a security certification.
- These changes are local only. The public deployment remains the pre-remediation commit until the owner separately authorizes a push and redeployment.

## Checks performed

| Area                   | Evidence                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Environment validation | `lib/env-core.ts` rejects invalid execution flags, missing RPC for live execution, mainnet without `MAINNET_RELEASE_APPROVED`, short session secrets, malformed ClawPump keys, and incomplete OpenAI config.             |
| Secret exposure        | Server-only keys are not under `NEXT_PUBLIC_*`; `.env*` is ignored by git.                                                                                                                                               |
| Wallet auth replay     | Nonce/session tests cover challenge verification, expiry, and domain-bound signatures.                                                                                                                                   |
| Wallet auth origin     | Only development may derive preview origin from the exact runtime `REPLIT_DEV_DOMAIN`. Production blocks until explicit HTTPS `NEXT_PUBLIC_APP_URL`; settings and health expose only a capability boolean.               |
| Runtime nonce origin   | Same-origin preview request returned HTTP 200 with `no-store` and exact HTTPS origin binding; foreign and missing origins returned HTTP 403. No secrets were printed.                                                    |
| Session CSRF           | Auth nonce, verification, agent creation, sponsor transaction routes, and session deletion require a trusted mutation origin.                                                                                            |
| Demo isolation         | Demo receipts do not contain real signatures or explorer links.                                                                                                                                                          |
| Hash anchoring honesty | Proof receipts include a `hashAnchoring` field; demo receipts must remain `offchain_only` and tests reject fake memo/signature anchoring claims.                                                                         |
| Prompt injection       | AI prompt-hardening tests reject malformed/hostile model output.                                                                                                                                                         |
| Transaction evidence   | Pending/unknown confirmation handling is covered. The original Meteora broadcast-error path is still unresolved, so not every timeout or transport path is guaranteed to persist `unknown_pending`.                      |
| Meteora signing        | Payer, hash, and signature parsing exists, but server-prepared and simulation binding plus the broadcast-error path remain unresolved. The incomplete transaction protocol was not enabled; all live flags remain false. |
| ClawPump execution     | Preflight errors are sanitized; the raw preflight token is neither persisted nor returned, only its hash. Exact terms, pair, and payment evidence is tested. Funded execution remains unsupported.                       |
| PreStocks safety       | Schema requires provider `contract_address`; ticker values cannot stand in for mints.                                                                                                                                    |
| Health endpoint        | Preview `/api/health` returned 200 with `tablesReady` and `immutabilityGuardsReady` true. Public origin capability is exposed only as a boolean; no URL or secret is returned.                                           |
| Database bounds        | The pool uses a 5-second connection timeout, 10-second statement timeout, and 12-second query timeout.                                                                                                                   |
| Dependency audit       | `npm audit --omit=dev` reports 19 production advisories: 6 high, 13 moderate, and 0 critical. `docs/dependency-audit.json` contains the machine-readable result. No forced override is approved.                         |

## Latest automated local gate

- `npm run check`: fresh pass on 2026-09-20 across format, lint, typecheck, 24 test files / 113 tests, production Next.js 16.3.5 build, 11-route judge smoke including `/agents/new`, Drizzle schema validation, and submission audit.
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
