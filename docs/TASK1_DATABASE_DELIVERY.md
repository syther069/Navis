# Task 1 delivery: production database persistence

Date: 2026-09-21. Baseline commit before this work: `39ade82`.

## What changed

| Area              | Change                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migrations        | `0006` and `0007` applied to the development database after a logical `pg_dump` backup. New additive `0008_agent_request_idempotency` adds `agents.client_request_id` and a unique index on `(owner_wallet, client_request_id)`.     |
| Migration tooling | `npm run db:migrate` (`drizzle-kit migrate`); `drizzle.config.ts` reads `DATABASE_URL` at run time only when it is set, so `db:generate` and `db:check` still work without a database.                                               |
| Connection layer  | `lib/db/connection.ts` decides TLS from the URL (verified for remote hosts unless `sslmode` says otherwise, off for localhost) and holds the explicit pool limits (max 8, 5 s connect, 10 s statement, 12 s query, 20 s idle).       |
| Error taxonomy    | `lib/db/errors.ts` maps pg and Drizzle failures to `database_not_configured`, `database_unreachable`, `database_schema_mismatch`, `database_timeout`, `database_transaction_failed`, `duplicate_request`, `authorization_failed`.    |
| Routes            | `/api/agents` (list, create), `/api/agents/[slug]`, `/api/auth/nonce`, `/api/auth/verify` and `/api/health` return these codes with fixed statuses; logs carry the code and SQLSTATE only, never the host, URL or SQL.               |
| Idempotency       | `createPersistentAgentIdempotent` returns the first agent for a repeated `clientRequestId` (also when two requests race and the loser hits the unique index). The route answers a replay with 200 and `replayed: true`.              |
| Create Agent form | Generates one request key per reviewed mandate, blocks double submission, and shows distinct "not saved" states for storage, sign-in and mandate failures. A retry after a storage failure cannot create a second agent.             |
| Wallet sessions   | Reviewed: nonce hashed at rest and consumed with a conditional update, signature checked against the claimed wallet, JWT bound to issuer and audience, 8-hour TTL. Cookie is now `secure` in production regardless of origin config. |
| Health            | Requires all 17 tables (including `execution_intents`) and the idempotency column; distinguishes `unreachable` (`connection` or `timeout`) from `schema_incomplete`.                                                                 |

Not touched: risk engine, execution gates, mode separation, proof generation, UI design, Vercel environment values.

## Verification

Local, on the migrated development database:

- `npm run check` passes end to end: format, lint, typecheck, 50 test files / 386 tests, lockfile registry check, production build, judge smoke, `db:check`, submission audit.
- `tests/database-persistence.test.ts` (real database, 11 tests, all writes rolled back): connection and readiness, journal hash compatibility for `0000` to `0008`, create and read back, owner isolation, replayed request key returns the first agent, second row for the same key rejected as `duplicate_request`, partial creation rolled back, challenge single use, session survives a fresh request, wrong-key signature rejected, tampered and expired tokens rejected.
- `tests/agents-create-route.test.ts` (10 tests): 201 then 200 replay, 503 `database_unreachable` without host or password text, 504 timeout, 503 schema mismatch, 400 `invalid_mandate`, 503 `database_not_configured`, 403 origin, 401 session, list route failure, service-thrown `DatabaseError`.
- `tests/database-errors.test.ts` (27 tests): TLS decisions and pool settings, SQLSTATE mapping, Drizzle wrapper unwrapping, no leakage in the public payload, retryable flags.
- `tests/database-unconfigured.test.ts`: `getDatabase()` without `DATABASE_URL` throws the typed error.
- Local `GET /api/health`: `database.status = ok`, `tablesReady` and `immutabilityGuardsReady` true, `walletSessions = configured`.
- Backup: `pg_dump` of the development database taken before `0006` (kept outside the repository).

## Production status

Completed on 2026-09-21: the owner set `DATABASE_URL` (Neon PostgreSQL) on the Vercel project, `SESSION_SECRET` and `NEXT_PUBLIC_APP_URL` were set the same day, the site was redeployed, and migrations `0000` through `0008` were applied to that database with `npm run db:migrate` (`npm run db:check` clean). `GET https://navis-gilt.vercel.app/api/health` reports `database` ok, `authenticationOrigin` and `walletSessions` configured; wallet sign-in, agent creation, `/agents` listing the new agent and a persisted run with a working detail link were verified against the public site. Details and evidence files: `docs/EVIDENCE.md`, "Public health"; procedure: `docs/DEPLOYMENT_RUNBOOK.md` section 6a.

## Rollback

All three new migrations are additive. Roll back by restoring the pre-`0006` backup, or by deploying the previous commit; the older code ignores the added table and column.
