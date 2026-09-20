# Navis deployment and submission runbook

Updated: 2026-09-19.

This runbook is the handoff checklist for moving the current local Navis build into a public Stocklana submission. It is intentionally strict: do not claim a deployed demo, ClawPump launch, Meteora pool, or PreStocks execution unless the evidence row is filled with a real URL, address, or signature.

## 1. Preflight gate

Run the full local gate from a clean working tree after installing dependencies:

```bash
npm run check
npm run submission:audit
npm audit --omit=dev
```

Expected local state as of this runbook:

- `npm run check` should run format, lint, typecheck, tests, production build, judge-flow smoke, and Drizzle schema validation.
- `npm run submission:audit` should pass file-read checks and list any remaining external-evidence warnings.
- `npm audit --omit=dev` is expected to report unresolved transitive Solana/Meteora/Anchor/Jayson advisories. Do not use `npm audit fix --force` without a compatibility pass because it can downgrade core chain dependencies.

## 2. Required deployment inputs

Provision these before a public deployment:

| Input                                             | Required for                                                       | Notes                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                             | Wallet auth and public callbacks                                   | Must exactly match the deployed origin.                                                        |
| `NEXT_PUBLIC_SOLANA_CLUSTER`                      | Public cluster labelling                                           | Use `devnet` for rehearsal; only use `mainnet-beta` after release approval.                    |
| `NAVIS_EXECUTION_MODE`                            | Runtime safety posture                                             | Use `demo`, `devnet`, or `mainnet`.                                                            |
| `ENABLE_DEMO_MODE`                                | Demo fixtures                                                      | Keep true for judge demo unless live-only deployment is desired.                               |
| `ENABLE_DEVNET_EXECUTION`                         | Devnet signing/submission                                          | Requires RPC, wallet, and funding.                                                             |
| `ENABLE_MAINNET_EXECUTION`                        | Mainnet signing/submission                                         | Must stay false until final approval.                                                          |
| `MAINNET_RELEASE_APPROVED`                        | Mainnet release gate                                               | Must stay false until an owner has completed all live checks.                                  |
| `SOLANA_RPC_URL`                                  | Treasury reads, transaction simulation/submission, Meteora monitor | Use a rate-limited production-grade endpoint for a public demo.                                |
| `DATABASE_URL`                                    | Persistent agents, decisions, proofs, external calls, transactions | Apply the SQL migrations in `drizzle/` before exposing write paths.                            |
| `SESSION_SECRET`                                  | Wallet-auth sessions                                               | At least 32 characters; server-only.                                                           |
| `CLAWPUMP_API_KEY`                                | ClawPump agent/pair/preflight/launch calls                         | Server-only; expected `cpk_` prefix.                                                           |
| `PRESTOCKS_API_URL`                               | PreStocks read-only catalogue                                      | Defaults to `https://prestocks.com/api/prestocks`.                                             |
| `AI_PROVIDER` / `OPENAI_API_KEY` / `OPENAI_MODEL` | Non-demo AI proposals                                              | Keep `AI_PROVIDER=demo` for deterministic judge flow unless live provider testing is complete. |

## 3. Recommended deployment shape

Navis is a server-backed Next app, not a static export. Deploy it on a platform that supports:

- Next.js App Router server routes.
- Server-only environment variables.
- Long enough API timeouts for RPC, ClawPump, and Meteora simulations.
- PostgreSQL connectivity.
- A stable public HTTPS origin for wallet signing messages.

Do not deploy it as a static-only site unless the API routes, database-backed ledgers, wallet session routes, and execution endpoints are intentionally disabled or replaced.

## 4. Database setup

1. Create a PostgreSQL-compatible database.
2. Set `DATABASE_URL`.
3. Apply the SQL files in `drizzle/` in order.
4. Run:

```bash
npm run db:check
```

5. Open `/api/health` on the deployed origin and verify that the response marks database readiness without exposing secrets.

## 5. Devnet rehearsal

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

## 6. Sponsor evidence capture

Only fill these rows after live external confirmation:

### ClawPump

- Agent/link request ID.
- Pair metadata response timestamp.
- Launch preflight response.
- Launch mint.
- Launch transaction signature.
- Payout wallet.
- Provider request ID.

### Meteora DBC

- Config profile used (`navis-equity-v1` unless intentionally changed).
- Config transaction signature.
- Pool creation transaction signature.
- Pool address.
- Base mint.
- Quote mint.
- Monitor slot/timestamp.

### PreStocks

The current product surface is read-only. Record catalogue response timing and schema status, but do not claim buy/sell/issuance support.

## 7. Mainnet release checklist

Mainnet is blocked unless every row below is true:

| Check                        | Required state                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Owner approval               | Explicit approval recorded outside the app.                                    |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `mainnet-beta`.                                                                |
| `NAVIS_EXECUTION_MODE`       | `mainnet`.                                                                     |
| `ENABLE_MAINNET_EXECUTION`   | `true`.                                                                        |
| `MAINNET_RELEASE_APPROVED`   | `true`.                                                                        |
| RPC                          | Production endpoint configured and tested.                                     |
| Wallet                       | Funded and intentionally selected.                                             |
| Database                     | Migrations applied and backups configured.                                     |
| Audit                        | Known transitive advisories accepted or remediated with compatibility testing. |
| Evidence policy              | No demo signatures or simulated receipts shown as live proof.                  |

## 8. Stocklana submission package

Before submission, update:

- `docs/EVIDENCE.md` with the deployed URL, repository URL, demo video URL, and any real signatures/addresses.
- `docs/INTEGRATIONS.md` with current provider responses and chain evidence.
- `docs/SECURITY_REVIEW.md` with final audit status and accepted-risk notes.
- `README.md` if the hosted environment differs from the local setup.

Minimum package:

- Public demo URL.
- Repository URL.
- Short demo video.
- One-paragraph product summary.
- Clear disclosure that demo receipts are simulations unless a real signature is present.
- Sponsor integration evidence for every sponsor claim.
