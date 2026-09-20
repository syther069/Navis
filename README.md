# Navis

[![CI](https://github.com/syther069/Navis/actions/workflows/ci.yml/badge.svg)](https://github.com/syther069/Navis/actions/workflows/ci.yml)

Navis is a governed Solana equity-agent workspace for the Stocklana hackathon. It shows one constrained agent lifecycle: a mandate, token universe, deterministic risk checks, explicit wallet authority boundaries, sponsor launch surfaces, and hash-verifiable proof receipts.

Navis is not a brokerage UI and does not claim that demo assets or PreStocks tokens are legal shares. Demo receipts are simulations. Explorer links and signatures appear only when Navis has stored real submitted transaction evidence.

Public demo: https://navis-gilt.vercel.app (Vercel production, built from GitHub `main` commit `a335681`). Independent reviews, newest first: [judge audit round 2](docs/STOCKLANA_JUDGE_AUDIT_V2.md) (72/100, 20 September 2026), [remediation report](docs/REMEDIATION_REPORT.md), [first judge audit](docs/STOCKLANA_JUDGE_AUDIT.md). The full local gate (`npm run check`) passes at the current commit with 166 tests in 32 files.

## What changed since the first audit

- The fresh decision journey is live on the public site: `POST /api/decisions/run` with a **Balanced** or **Oversized** scenario returns a fresh proposal, policy evaluation, execution eligibility and a newly hashed receipt; the Atlas page has a **Run new decision** panel that shows the full result inline. `/decisions/<id>` re-renders it, but on the public site that link is unreliable because demo runs live in one serverless instance's memory.
- Meteora config and pool submission are bound to a server-prepared execution intent (owner, cluster, expiry, message hash, simulation result). The submit routes accept only an intent ID plus signed bytes, and the launch record is persisted as `submitting` with the derived transaction signature before any send, so a repeated submit replays the record instead of sending twice and a timeout after send stays `unknown_pending` until reconciled. Confirmation then decodes the onchain config or pool account and labels the launch `protocol_verified`, `signature_confirmed` or `evidence_incomplete`. Broadcast itself remains hard-blocked in every mode until a separate security review.
- Same-origin mutation requests are trusted behind the deployment proxy (`x-forwarded-host`), so public decision runs work on Vercel; foreign origins still receive 403. Wallet authentication remains unavailable in production because it needs a database, session secret and configured app origin, none of which the public demo has.
- The Atlas page now opens with a short intro (problem, what Navis does, what to try) and an optional read-only devnet slot probe gated on `SOLANA_RPC_URL`. Both are live on the public site as of the 20 September 2026 evening push (`085e779`); production has `SOLANA_RPC_URL` set to the public devnet endpoint, execution flags stay false, and the probe only reads the current slot.
- Repository documentation was refreshed so every claim matches the deployed commit. Historical baselines are kept in clearly labelled history sections.
- Still open (see the round 2 audit): fresh decision detail links are unreliable on Vercel because demo runs live in one server instance's memory; nothing on the public site touches Solana; PreStocks data is displayed but not consumed by the agent; no LICENSE file, no videos.

## What is implemented

- Premium dark “Proof Terminal” product shell with demo Atlas agent.
- Deterministic demo decision, policy ledger, treasury snapshot, proof timeline, and public receipt verifier.
- Fresh Atlas decision runs with balanced and deliberately oversized scenarios, policy evaluation, and a newly hashed receipt on every run.
- Wallet Standard connection and nonce-based wallet authentication with environment-specific origin enforcement; same-origin requests are trusted behind the deployment proxy, foreign origins get 403.
- PostgreSQL/Drizzle schema for agents, strategies, policies, decisions, execution attempts, events, proofs, market launches, and external calls.
- AI provider abstraction with deterministic demo provider and OpenAI-compatible provider guards.
- ClawPump integration for server-side agent linking, live pair discovery, and exact self-funded launch preflight.
- Meteora DBC integration with official SDK config preview, config transaction prepare/simulate/submit/confirm, pool creation prepare/simulate/submit, and pool monitor. Submit routes are bound to server-prepared execution intents; broadcast is hard-blocked in every mode pending review.
- PreStocks read-only catalogue adapter with schema validation and explicit economic-exposure/eligibility disclosure.
- Transaction ledger route for persisted execution attempts and sponsor launch records.

## Honest limitations

- Fresh demo decisions do not execute onchain. Without `DATABASE_URL`, the latest 50 runs are kept in process memory and disappear when the server instance restarts.
- Fresh decisions for persistent agents are not enabled yet because persisted snapshots do not contain every market fact required for an honest policy evaluation. The API returns 409 rather than inventing missing values.
- No live ClawPump launch has been submitted from this checkout. `INT-04` requires configured `CLAWPUMP_API_KEY`, authenticated wallet, funding, provider acceptance, and chain confirmation.
- ClawPump funded launch is unsupported in the current demo/devnet posture. The documented self-funded route has no devnet selector, and Navis currently implements preflight only.
- No live Meteora config/pool proof is present in this checkout. The builder is implemented, but live proof requires `SOLANA_RPC_URL`, devnet/mainnet execution flags, wallet approval, funding, and confirmation.
- Meteora signed input is now server-bound to the exact prepared intent, but broadcast stays hard-blocked (the submit routes return 503 before any send) until the protocol is retested against a real cluster.
- The Vercel demo at https://navis-gilt.vercel.app runs in demo mode without a database. Fresh decision runs work there, but a run is kept in the memory of the serverless instance that produced it, so `/decisions/<id>` may show "Decision unavailable" when a later request lands elsewhere. The inline result panel always shows the full run. No demo video URL, pitch video URL, technical video URL, or production database migration evidence is recorded.
- There is no evidence that migration `0006` (execution intents) has been applied to any database. The development database has `0000` through `0005`; the public site has no database at all.
- PreStocks is read-only. Navis does not expose buy/sell or launch actions for PreStocks assets.
- The public health mode is `demo` on `devnet`: PreStocks and the demo AI provider are configured, while database, authentication origin, wallet sessions, Solana RPC, ClawPump, and Meteora are not configured. The public app is read-only and deterministic; it is not persistent or wallet-ready.

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
rejection. Both produce a fresh ID, timestamp, and locally verifiable receipt.
Demo mode is simulation only and never submits an onchain transaction.

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

The development database has migrations `0000` through `0005` applied in order with journal SHA tracking. Replit managed PostgreSQL production migration belongs to the user Publish flow. Navis does not run startup DDL, and the runbook does not prescribe manual SQL against managed production.

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

- `npm run check` passes all eight gates: format verification, zero-warning ESLint, strict TypeScript, 32 test files / 166 tests, production Next.js build, judge smoke (11 routes, PreStocks API and a fresh oversized decision), Drizzle schema validation, and submission audit (one expected warning for the missing video rows).
- The public site was walked in a real Chromium session on 20 September 2026 at 1440 px and 375 px: Balanced run approved, Oversized run rejected on max trade bps and min reserve bps, receipt verified, no console errors, no horizontal overflow. Evidence: `docs/evidence/stocklana-v2-public-smoke.json` and the round 2 audit. Actual wallet extension signing remains unverified.
- Vercel production is READY at GitHub `main` commit `a335681`. Public `/api/health` reports demo/devnet with PreStocks and the demo AI provider configured and everything else not configured.
- `npm audit --omit=dev` reports 19 production advisories: 6 high, 13 moderate, no critical, all transitive through the Solana and Meteora dependency chains. Machine-readable result: `docs/evidence/stocklana-v2-dependency-audit.json`. This is not a claim that the warnings are resolved.

### History

- First baseline, 20 September 2026 morning: 24 test files / 113 tests at commit `ac26e54`, the commit the Vercel demo was first published from. Real-Chromium QA at that commit covered the Atlas to public-verifier journey and 10 UI routes at 375/768/1440 px with no overflow, no missing labels, working focus return and no contrast failures.
- Remediation pass, same day: 26 test files / 143 tests after the receipt, confirmation and liquidity fixes described in `docs/REMEDIATION_REPORT.md`.

## Demo route map

- `/` — landing screen: the one-sentence pitch, three proof points, mode and cluster banner, the assurance model (offchain integrity, wallet authorization, onchain settlement) and entry links to the Atlas demo, agent creation and Markets Launch.
- `/agents/atlas` — public demo workspace with the **Run new decision** panel (Balanced approves, Oversized is rejected).
- `/decisions/<id>` and `/api/decisions/<id>` — fresh decision result; in memory only when no database is configured.
- `/api/decisions/run` — `POST { agentSlug: "atlas", scenario: "balanced" | "oversized" }`; same-origin only.
- `/agents/new` — focused agent creation route covered by the 11-route smoke and create/read ownership tests.
- `/decisions` — demo decision ledger.
- `/agents/atlas/decisions/demo-decision` — decision detail and proof link.
- `/proofs` and `/proofs/demo-proof` — hash-verifiable demo receipt.
- `/markets/launch` — ClawPump preflight, Meteora DBC builder/monitor, PreStocks read-only catalogue.
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
