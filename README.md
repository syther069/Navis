# Navis

[![CI](https://github.com/syther069/Navis/actions/workflows/ci.yml/badge.svg)](https://github.com/syther069/Navis/actions/workflows/ci.yml)

Navis is a governed Solana equity-agent workspace for the Stocklana hackathon. It shows one constrained agent lifecycle: a mandate, token universe, deterministic risk checks, explicit wallet authority boundaries, sponsor launch surfaces, and hash-verifiable proof receipts.

Navis is not a brokerage UI and does not claim that demo assets or PreStocks tokens are legal shares. Demo receipts are simulations. Explorer links and signatures appear only when Navis has stored real submitted transaction evidence.

Public demo: https://navis-gilt.vercel.app (Vercel production, built from GitHub `main`; the deployed commit and the public smoke result are recorded in [docs/EVIDENCE.md](docs/EVIDENCE.md)). Independent reviews, newest first: [judge audit round 2](docs/STOCKLANA_JUDGE_AUDIT_V2.md) (72/100, 20 September 2026), [remediation report](docs/REMEDIATION_REPORT.md), [first judge audit](docs/STOCKLANA_JUDGE_AUDIT.md). The full local gate (`npm run check`) passes at the current commit with 340 tests in 46 files.

## What changed since the first audit

- The fresh decision journey is live on the public site: `POST /api/decisions/run` with a **Balanced** or **Oversized** scenario returns a fresh proposal, policy evaluation, execution eligibility and a newly hashed receipt; the Atlas page has a **Run new decision** panel that shows the full result inline. In-memory runs (no database) offer no detail link, because on Vercel a later request can land on another serverless instance; unknown decision and proof ids return a real HTTP 404.
- The Atlas run uses the live PreStocks catalogue as its asset universe by default: allowlist from the validated contract addresses, token price as the research price, read time as data age, no liquidity or quote invented (the liquidity rule warns). Each check shows the PreStocks fact it used, and a research view under the result shows premium or discount to mark, valuation gap, supply and allocation impact. If the catalogue is unreachable the run falls back to the fixture universe with a visible note.
- Owners can create agents (`/agents/new`) and see them on `/agents`. With a database and wallet session, each demo-mode run is persisted in one transaction as a portfolio snapshot, decision, policy evaluation, simulated execution attempt and proof receipt, with owner-scoped decision and proof pages. Devnet and mainnet agents are refused with 409 because a persisted snapshot does not hold every market fact an honest evaluation needs.
- A landing screen at `/` states the one-sentence pitch, the three proof points, the mode and cluster banner and the assurance model. Every receipt, decision detail, run result and ledger row carries an assurance badge: offchain integrity, wallet authorization or onchain settlement, plus demo simulation or live. A "Why this passed / failed" panel lists every check with observed value, limit and fact source.
- Meteora config and pool submission are bound to a server-prepared execution intent (owner, cluster, expiry, message hash, simulation result). The submit routes accept only an intent ID plus signed bytes, and the launch record is persisted as `submitting` with the derived transaction signature before any send, so a repeated submit replays the record instead of sending twice and a timeout after send stays `unknown_pending` until reconciled. Confirmation then decodes the onchain config or pool account and labels the launch `protocol_verified`, `signature_confirmed` or `evidence_incomplete`. Broadcast itself remains hard-blocked in every mode until a separate security review.
- Same-origin mutation requests are trusted behind the deployment proxy (`x-forwarded-host`), so public decision runs work on Vercel; foreign origins still receive 403. Wallet authentication remains unavailable in production because it needs a database, session secret and configured app origin, none of which the public demo has.
- The Atlas page opens with a short intro (problem, what Navis does, what to try) and an optional read-only devnet slot probe gated on `SOLANA_RPC_URL`. Production has `SOLANA_RPC_URL` set to the public devnet endpoint, execution flags stay false, and the probe only reads the current slot.
- Meteora DBC has a second server-approved quote profile, `navis-stock-exposure-v1`, quoted in a PreStocks exposure token chosen from the live catalogue and verified onchain at prepare time (token program, decimals, Token-2022 extensions, Meteora token badge). It is mainnet only and currently gated because no live PreStocks mint carries the badge; no substitute mint is ever used.
- Repository documentation was refreshed so every claim matches the deployed commit. Historical baselines are kept in clearly labelled history sections.
- Still open: nothing on the public site writes to Solana (the only chain read is the devnet slot probe); the public site's persisted runs are demo-mode simulations (no devnet or mainnet run is persisted); no videos. The code is released under the MIT licence (see `LICENSE`).

## What is implemented

- Premium dark “Proof Terminal” product shell with demo Atlas agent.
- Deterministic demo decision, policy ledger, treasury snapshot, proof timeline, and public receipt verifier.
- Landing screen, agent list, and fresh decision runs: Atlas in public on the live PreStocks universe with balanced and deliberately oversized scenarios; owner agents persisted as a full evidence chain when a database and session exist.
- Assurance badges (offchain integrity, wallet authorization, onchain settlement; demo or live) and a per-check explanation panel with observed value, limit and fact source.
- Wallet Standard connection and nonce-based wallet authentication with environment-specific origin enforcement; same-origin requests are trusted behind the deployment proxy, foreign origins get 403.
- PostgreSQL/Drizzle schema for agents, strategies, policies, decisions, execution attempts, events, proofs, market launches, and external calls.
- AI provider abstraction with deterministic demo provider and OpenAI-compatible provider guards.
- ClawPump integration for server-side agent linking, live pair discovery, and exact self-funded launch preflight.
- Meteora DBC integration with official SDK config preview, two server-approved quote profiles (SOL-quoted and stock-paired on a PreStocks mint), config transaction prepare/simulate/submit/confirm, pool creation prepare/simulate/submit, and pool monitor. Submit routes are bound to server-prepared execution intents; broadcast is hard-blocked in every mode pending review.
- PreStocks read-only catalogue adapter with schema validation, research view (premium or discount, valuation gap, allocation impact), use as the Atlas asset universe, and explicit economic-exposure/eligibility disclosure.
- Transaction ledger route for persisted execution attempts and sponsor launch records.

## Honest limitations

- Fresh demo decisions do not execute onchain. Atlas runs are kept in bounded process memory by design, even with a database attached, and disappear when the server instance restarts.
- Fresh decisions for owner agents are persisted only in demo mode. Devnet and mainnet agents get a 409 because persisted snapshots do not contain every market fact required for an honest policy evaluation; Navis does not invent missing values.
- No live ClawPump launch has been submitted from this checkout. `INT-04` requires configured `CLAWPUMP_API_KEY`, authenticated wallet, funding, provider acceptance, and chain confirmation.
- ClawPump funded launch is unsupported in the current demo/devnet posture. The documented self-funded route has no devnet selector, and Navis currently implements preflight only.
- No live Meteora config/pool proof is present in this checkout. The builder is implemented, but live proof requires `SOLANA_RPC_URL`, devnet/mainnet execution flags, wallet approval, funding, and confirmation.
- Meteora signed input is now server-bound to the exact prepared intent, but broadcast stays hard-blocked (the submit routes return 503 before any send) until the protocol is retested against a real cluster.
- The Vercel demo at https://navis-gilt.vercel.app runs in demo mode. Since 2026-09-21 it has a Neon PostgreSQL database, a session secret and an explicit origin, so wallet sign-in, owner agents and persisted demo runs with a working detail link are available there (`docs/EVIDENCE.md`, "Public health"). Fresh Atlas runs still stay in the memory of the serverless instance that produced them, so no detail link is offered for them; the inline result panel shows the full run. No demo video URL, pitch video URL or technical video URL is recorded.
- Both databases carry migrations `0000` through `0008`: the development database (journal hashes verified by `tests/database-persistence.test.ts`) and the public site's Neon database (applied with `npm run db:migrate` on 2026-09-21).
- PreStocks is read-only. Navis does not expose buy/sell or launch actions for PreStocks assets.
- The public health mode is `demo` on `devnet`: database, authentication origin, wallet sessions, PreStocks, the demo AI provider, Meteora SDK reads and a read-only public devnet RPC are configured; ClawPump is not. The public app is deterministic and, for owner agents, persistent; a browser wallet extension has not yet been exercised against it.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

### Fresh decision path

Open `/agents/atlas`, choose **Balanced** or **Oversized**, and select **Run
decision**. Balanced demonstrates approval while Oversized demonstrates a policy
rejection. Both produce a fresh ID, timestamp, and locally verifiable receipt on
the live PreStocks universe (fixture fallback with a note when the catalogue is
unreachable). Demo mode is simulation only and never submits an onchain
transaction. With `DATABASE_URL` and `SESSION_SECRET` set, sign in with a wallet,
create an agent at `/agents/new`, and run it: the run is persisted with its
snapshot, decision, evaluation, simulated attempt and proof receipt.

Navis is the root npm application. Replit development, build, and start use `npm run dev`, `npm run build`, and `npm run start` from the repository root. The Next.js server binds to `0.0.0.0` and uses the platform-provided `PORT`.

The default configuration is locked demo mode:

```env
NAVIS_EXECUTION_MODE=demo
ENABLE_DEMO_MODE=true
ENABLE_DEVNET_EXECUTION=false
ENABLE_MAINNET_EXECUTION=false
MAINNET_RELEASE_APPROVED=false
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

## Environment variables

| Variable                         | Purpose                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`            | Explicit production HTTPS origin for wallet auth; leave unset before first Publish. |
| `NEXT_PUBLIC_SOLANA_CLUSTER`     | `devnet` or `mainnet-beta`.                                                         |
| `NAVIS_EXECUTION_MODE`           | `demo`, `devnet`, or `mainnet`.                                                     |
| `ENABLE_DEMO_MODE`               | Allows deterministic demo fixtures.                                                 |
| `ENABLE_DEVNET_EXECUTION`        | Enables devnet value-moving flows when RPC is set.                                  |
| `ENABLE_MAINNET_EXECUTION`       | Enables mainnet only when explicitly true and cluster matches.                      |
| `MAINNET_RELEASE_APPROVED`       | Additional server-only mainnet release checklist gate.                              |
| `SOLANA_RPC_URL`                 | Server-side RPC for reads, simulation, submission, and confirmation.                |
| `DATABASE_URL`                   | PostgreSQL-compatible persistence.                                                  |
| `SESSION_SECRET`                 | At least 32 characters for signed wallet sessions.                                  |
| `CLAWPUMP_API_KEY`               | Server-only ClawPump key, expected `cpk_` prefix.                                   |
| `PRESTOCKS_API_URL`              | Defaults to `https://prestocks.com/api/prestocks`.                                  |
| `AI_PROVIDER`                    | `demo` or `openai`.                                                                 |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Required only for `AI_PROVIDER=openai`.                                             |

## Database

Generate or check migrations with Drizzle:

```bash
npm run db:check
```

The repository ships migrations `0000` through `0008`; all of them are additive (`0008` adds `agents.client_request_id` and a unique index per owner for idempotent creation). The development database has all nine applied in order with journal SHA tracking. Navis does not run startup DDL. To migrate a database you control, run `npm run db:migrate` with `DATABASE_URL` set, then `npm run db:check` (see `docs/DEPLOYMENT_RUNBOOK.md`).

Storage failures are classified in `lib/db/errors.ts` into stable codes (`database_not_configured`, `database_unreachable`, `database_schema_mismatch`, `database_timeout`, `database_transaction_failed`, `duplicate_request`, `authorization_failed`) with fixed HTTP statuses; responses never carry hosts, SQL or driver text. `POST /api/agents` accepts a `clientRequestId`; a retry with the same key returns the first agent (`replayed: true`) instead of creating a twin. TLS to the database is decided from the URL (`lib/db/connection.ts`): verified for remote hosts unless `sslmode` says otherwise, off for localhost.

Real-database tests (`tests/database-persistence.test.ts`, `tests/persisted-decision-run.test.ts`) run only when `DATABASE_URL` is set and roll back every write; they are skipped with a warning otherwise.

The database pool uses a 5-second connection timeout, 10-second statement timeout, and 12-second query timeout.

## Validation

The baseline local validation set is:

```bash
npm run check
```

The same gate runs on GitHub for every push and every pull request (`.github/workflows/ci.yml`): lockfile registry check, format, lint, typecheck, tests, production build, judge smoke against the built app in the locked demo posture, Drizzle schema check, submission audit, and a report-only `npm audit --omit=dev`. It needs no secrets. The smoke report is uploaded as a workflow artifact.

To run the judge-flow smoke against a deployed origin instead of local `next start`:

```bash
NAVIS_SMOKE_BASE_URL=https://your-deployed-origin.example npm run smoke:judge
```

Set `NAVIS_SMOKE_REPORT=docs/deployed-smoke-report.json` to write a JSON evidence report for submission review.

To inspect the submission package for missing evidence rows, TODO markers, and unsupported live claims:

```bash
npm run submission:audit
```

Current result (20 September 2026, current `main`):

- `npm run check` passes all nine gates: format verification, zero-warning ESLint, strict TypeScript, 46 test files / 340 tests, lockfile registry check, production Next.js build, judge smoke (12 page routes, PreStocks API, real 404s and a fresh oversized decision on the PreStocks universe), Drizzle schema validation, and submission audit with zero warnings. Local smoke report: `docs/evidence/final-local-smoke.json`.
- The public site was walked in a real Chromium session on 20 September 2026 at 1440 px and 375 px: Balanced run approved, Oversized run rejected on max trade bps and min reserve bps, receipt verified, no console errors, no horizontal overflow. Screenshots of the final build: `docs/evidence/final-*.png`. Actual wallet extension signing remains unverified.
- The deployed commit, the public smoke result and the public `/api/health` output are recorded in `docs/EVIDENCE.md`.
- `npm audit --omit=dev` reports 19 production advisories: 6 high, 13 moderate, no critical, all transitive through the Solana and Meteora dependency chains. Machine-readable result: `docs/evidence/stocklana-v2-dependency-audit.json`. This is not a claim that the warnings are resolved.

### History

- First baseline, 20 September 2026 morning: 24 test files / 113 tests at commit `ac26e54`, the commit the Vercel demo was first published from. Real-Chromium QA at that commit covered the Atlas to public-verifier journey and 10 UI routes at 375/768/1440 px with no overflow, no missing labels, working focus return and no contrast failures.
- Remediation pass, same day: 26 test files / 143 tests after the receipt, confirmation and liquidity fixes described in `docs/REMEDIATION_REPORT.md`.

## Demo route map

- `/` — landing screen: the one-sentence pitch, three proof points, mode and cluster banner, the assurance model (offchain integrity, wallet authorization, onchain settlement) and entry links to the Atlas demo, agent creation and Markets Launch.
- `/agents` — agent list: Atlas plus the signed-in owner's agents.
- `/agents/atlas` — public demo workspace with the **Run new decision** panel (Balanced approves, Oversized is rejected) on the PreStocks universe.
- `/agents/<slug>` — owner agent page with the same run panel; runs are persisted in demo mode.
- `/decisions/<id>` and `/api/decisions/<id>` — persisted decision result (owner-scoped); unknown ids return HTTP 404.
- `/api/decisions/run` — `POST { agentSlug, scenario: "balanced" | "oversized", universe?: "prestocks" | "fixture" }`; same-origin only.
- `/agents/new` — focused agent creation route covered by the judge smoke and create/read ownership tests.
- `/decisions` — demo decision ledger.
- `/agents/atlas/decisions/demo-decision` — decision detail and proof link.
- `/proofs` and `/proofs/<id>` — hash-verifiable receipts with assurance badges; unknown ids return HTTP 404.
- `/markets/launch` — ClawPump preflight, Meteora DBC builder/monitor with both quote profiles, PreStocks research view.
- `/api/assets/prestocks` — read-only validated PreStocks catalogue API with eligibility/action disclosures.
- `/transactions` — persisted execution and market-launch ledger when `DATABASE_URL` is configured.
- `/settings` — capability and safety posture.
- `/disclosures` — risk, privacy, tokenized-exposure, wallet-authority, and evidence-claim boundaries.
- `/api/health` — non-secret readiness summary for mode, cluster, database, RPC, wallet sessions, and integrations.

## Submission evidence

See:

- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
- [docs/EVIDENCE.md](docs/EVIDENCE.md)
- [docs/LOCAL_QA.md](docs/LOCAL_QA.md)
- [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md)
- [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)
- [docs/IMPLEMENTATION_AUDIT.md](docs/IMPLEMENTATION_AUDIT.md)
- [docs/SUBMISSION_DRAFT.md](docs/SUBMISSION_DRAFT.md)
- [docs/SUBMISSION_READINESS.md](docs/SUBMISSION_READINESS.md)
- [docs/ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md)

## Licence

MIT. See [LICENSE](LICENSE). Third-party dependency notices are listed in [docs/ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md).
