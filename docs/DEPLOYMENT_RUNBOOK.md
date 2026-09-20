# Navis deployment and submission runbook

Updated: 2026-09-20.

This runbook is the handoff checklist for moving the current local Navis build into a public Stocklana submission. It is intentionally strict: do not claim a deployed demo, ClawPump launch, Meteora pool, or PreStocks execution unless the evidence row is filled with a real URL, address, or signature.

## 1. Preflight gate

Run the full root npm gate after installing from the lockfile:

```bash
npm install
npm run check
npm audit --omit=dev
```

Expected local state as of this runbook:

- Fresh `npm run check` passed on 2026-09-20 across all eight gates, 24 test files / 113 tests, production Next.js 16.3.5 build, and the 11-route smoke including `/agents/new`.
- `npm audit --omit=dev` reports 19 production advisories: 6 high, 13 moderate, and 0 critical. The unresolved machine-readable result is `docs/dependency-audit.json`.
- Local browser QA passed the clean unauthenticated flow, responsive/accessibility review, and runtime nonce-origin checks. Real wallet extension/signing remains unverified.
- Do not use `npm audit fix --force` without a compatibility pass because it can change core chain dependencies.

## 2. Replit application shape

Navis is the npm application at the repository root. The only active artifact descriptor is `artifacts/navis/.replit-artifact/artifact.toml`; it routes `/` to the root Next.js application and invokes root `npm run dev`, `npm run build`, and `npm run start`. It is preview metadata, not a second application source.

The Next.js scripts bind to `0.0.0.0` and use Replit's supplied `PORT`. `NEXT_PUBLIC_APP_URL` remains unset until `getDeploymentInfo` yields the real published HTTPS origin. Only when `NODE_ENV=development` may wallet auth derive the preview origin from the exact runtime `REPLIT_DEV_DOMAIN`. Production auth blocks until an explicit HTTPS `NEXT_PUBLIC_APP_URL` is configured. Settings and `/api/health` expose only a public-capability origin boolean, never the origin value or secrets.

## 3. Required deployment inputs

Provision these before a public deployment:

| Input                                             | Required for                                                       | Notes                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                             | Wallet auth and public callbacks                                   | Leave unset for the first Publish; after verifying the origin, set the exact HTTPS URL through Secrets and Republish. |
| `NEXT_PUBLIC_SOLANA_CLUSTER`                      | Public cluster labelling                                           | Use `devnet` for rehearsal; only use `mainnet-beta` after release approval.                                           |
| `NAVIS_EXECUTION_MODE`                            | Runtime safety posture                                             | Use `demo`, `devnet`, or `mainnet`.                                                                                   |
| `ENABLE_DEMO_MODE`                                | Demo fixtures                                                      | Keep true for judge demo unless live-only deployment is desired.                                                      |
| `ENABLE_DEVNET_EXECUTION`                         | Devnet signing/submission                                          | Requires RPC, wallet, and funding.                                                                                    |
| `ENABLE_MAINNET_EXECUTION`                        | Mainnet signing/submission                                         | Must stay false until final approval.                                                                                 |
| `MAINNET_RELEASE_APPROVED`                        | Mainnet release gate                                               | Must stay false until an owner has completed all live checks.                                                         |
| `SOLANA_RPC_URL`                                  | Treasury reads, transaction simulation/submission, Meteora monitor | Use a rate-limited production-grade endpoint for a public demo.                                                       |
| `DATABASE_URL`                                    | Persistent agents, decisions, proofs, external calls, transactions | Development has `0000` through `0005`; Replit production migrates through Publish.                                    |
| `SESSION_SECRET`                                  | Wallet-auth sessions                                               | At least 32 characters; server-only.                                                                                  |
| `CLAWPUMP_API_KEY`                                | ClawPump agent/pair/preflight/launch calls                         | Server-only; expected `cpk_` prefix.                                                                                  |
| `PRESTOCKS_API_URL`                               | PreStocks read-only catalogue                                      | Defaults to `https://prestocks.com/api/prestocks`.                                                                    |
| `AI_PROVIDER` / `OPENAI_API_KEY` / `OPENAI_MODEL` | Non-demo AI proposals                                              | Keep `AI_PROVIDER=demo` for deterministic judge flow unless live provider testing is complete.                        |

## 4. Recommended deployment shape

Navis is a server-backed Next app, not a static export. Deploy it on a platform that supports:

- Next.js App Router server routes.
- Server-only environment variables.
- Long enough API timeouts for RPC, ClawPump, and Meteora simulations.
- PostgreSQL connectivity.
- A stable public HTTPS origin for wallet signing messages.

Do not deploy it as a static-only site unless the API routes, database-backed ledgers, wallet session routes, and execution endpoints are intentionally disabled or replaced.

## 5. Database setup

The development database has migrations `0000` through `0005` applied in order with journal SHA tracking. The pool uses a 5-second connection timeout, 10-second statement timeout, and 12-second query timeout. For Replit production, provision and migrate managed PostgreSQL through the user Publish flow.

Do not add startup or deploy-time DDL. Do not prescribe manual SQL against Replit managed production.

After Publish completes, run:

```bash
npm run db:check
```

Then open `/api/health` on the published origin and verify database readiness without exposing connection details.

## 6. Exact Replit Publish sequence

Current deployment lookup returned `success=true`, `isDeployed=false`, and an empty `primaryUrl`. Do not set or invent a public URL before publishing.

1. Click **Publish** in Replit.
2. Keep the safe posture: `NAVIS_EXECUTION_MODE=demo`, `ENABLE_DEMO_MODE=true`, `ENABLE_DEVNET_EXECUTION=false`, `ENABLE_MAINNET_EXECUTION=false`, `MAINNET_RELEASE_APPROVED=false`, and `NEXT_PUBLIC_SOLANA_CLUSTER=devnet`.
3. Leave `NEXT_PUBLIC_APP_URL` unset for this first Publish.
4. Accept the Replit production database schema prompt. Do not run manual production SQL.
5. Wait for Publish to finish and verify the actual HTTPS primary URL.
6. Add that exact origin as production `NEXT_PUBLIC_APP_URL` through Replit Secrets.
7. Click **Republish** so production wallet authentication uses the explicit origin.
8. Verify public `/api/health`, the 11 judge routes, nonce/origin rejection and acceptance behavior, and the deployed smoke report.

## 7. Devnet rehearsal

Use devnet before any mainnet submission:

```env
NAVIS_EXECUTION_MODE=devnet
ENABLE_DEMO_MODE=true
ENABLE_DEVNET_EXECUTION=true
ENABLE_MAINNET_EXECUTION=false
MAINNET_RELEASE_APPROVED=false
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

Rehearsal evidence to capture:

| Evidence                                     | Where to record it                               |
| -------------------------------------------- | ------------------------------------------------ |
| Public deployed URL                          | `docs/EVIDENCE.md` public URLs table             |
| `/api/health` readiness snapshot             | `docs/EVIDENCE.md` or submission notes           |
| Judge-flow smoke result against deployed URL | `docs/EVIDENCE.md` local/deployed build evidence |
| Wallet used for devnet rehearsal             | `docs/INTEGRATIONS.md`                           |
| Devnet transaction signatures, if any        | `docs/INTEGRATIONS.md` and `docs/EVIDENCE.md`    |

Run the same judge-flow smoke against the deployed origin before recording the URL as submission-ready:

```bash
NAVIS_SMOKE_BASE_URL=https://your-deployed-origin.example npm run smoke:judge
```

To save a machine-readable evidence artifact:

```bash
NAVIS_SMOKE_BASE_URL=https://your-deployed-origin.example NAVIS_SMOKE_REPORT=docs/deployed-smoke-report.json npm run smoke:judge
```

The report includes the checked origin, `/api/health` response, timestamp, and every route assertion. Review it before committing or attaching it; it should not contain secrets because `/api/health` is designed to return only readiness state.

## 8. Sponsor evidence capture

Only fill these rows after live external confirmation:

### ClawPump

Current app supports preflight only. The official self-funded endpoint does not document devnet or cluster selection. Do not attempt a funded launch from demo/devnet. Any future flow requires explicit owner-approved mainnet release plus reviewed paid retry, signature, and persistence code.

- Agent/link request ID.
- Pair metadata response timestamp.
- Launch preflight response.
- Launch mint.
- Launch transaction signature.
- Payout wallet.
- Provider request ID.

### Meteora DBC

Do not enable live submission until caller-supplied signed input is server-bound to the exact previously prepared proposal and the protocol is retested.

- Config profile used (`navis-equity-v1` unless intentionally changed).
- Config transaction signature.
- Pool creation transaction signature.
- Pool address.
- Base mint.
- Quote mint.
- Monitor slot/timestamp.

### PreStocks

The current product surface is read-only. Record catalogue response timing and schema status, but do not claim buy/sell/issuance support.

## 9. Mainnet release checklist

Mainnet is blocked unless every row below is true:

| Check                        | Required state                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| Owner approval               | Explicit approval recorded outside the app.                                              |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `mainnet-beta`.                                                                          |
| `NAVIS_EXECUTION_MODE`       | `mainnet`.                                                                               |
| `ENABLE_MAINNET_EXECUTION`   | `true`.                                                                                  |
| `MAINNET_RELEASE_APPROVED`   | `true`.                                                                                  |
| RPC                          | Production endpoint configured and tested.                                               |
| Wallet                       | Funded and intentionally selected.                                                       |
| Database                     | Migrations applied and backups configured.                                               |
| Audit                        | Known transitive advisories accepted or remediated with compatibility testing.           |
| ClawPump protocol            | Owner-approved mainnet release and reviewed paid-retry, signature, and persistence code. |
| Meteora protocol             | Signed input bound to the exact server-prepared proposal and full protocol retested.     |
| Evidence policy              | No demo signatures or simulated receipts shown as live proof.                            |

## 10. Stocklana submission package

Before submission, update:

- `docs/EVIDENCE.md` with the deployed URL, repository URL, demo video URL, and any real signatures/addresses.
- `docs/INTEGRATIONS.md` with current provider responses and chain evidence.
- `docs/SECURITY_REVIEW.md` with final audit status and accepted-risk notes.
- `README.md` if the hosted environment differs from the local setup.

Minimum package:

- Repository URL.
- Public demo URL after the user publishes.
- Pitch video no longer than three minutes.
- Technical walkthrough no longer than five minutes.
- One-paragraph product summary.
- Clear disclosure that demo receipts are simulations unless a real signature is present.
- Sponsor integration evidence for every sponsor claim.

Planned entry: the main Stocklana track plus at most three sponsor tracks, ClawPump, Meteora DBC, and PreStocks. The user must review the authenticated form and perform the final submission.
