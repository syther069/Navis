# Navis

Navis is a governed Solana equity-agent workspace for the Stocklana hackathon. It shows one constrained agent lifecycle: a mandate, token universe, deterministic risk checks, explicit wallet authority boundaries, sponsor launch surfaces, and hash-verifiable proof receipts.

Navis is not a brokerage UI and does not claim that demo assets or PreStocks tokens are legal shares. Demo receipts are simulations. Explorer links and signatures appear only when Navis has stored real submitted transaction evidence.

## What is implemented

- Premium dark “Proof Terminal” product shell with demo Atlas agent.
- Deterministic demo decision, policy ledger, treasury snapshot, proof timeline, and public receipt verifier.
- Wallet Standard connection and nonce-based wallet authentication.
- PostgreSQL/Drizzle schema for agents, strategies, policies, decisions, execution attempts, events, proofs, market launches, and external calls.
- AI provider abstraction with deterministic demo provider and OpenAI-compatible provider guards.
- ClawPump integration for server-side agent linking, live pair discovery, and exact self-funded launch preflight.
- Meteora DBC integration with official SDK config preview, config transaction prepare/simulate/submit/confirm, pool creation prepare/simulate/submit, and pool monitor.
- PreStocks read-only catalogue adapter with schema validation and explicit economic-exposure/eligibility disclosure.
- Transaction ledger route for persisted execution attempts and sponsor launch records.

## Honest limitations

- No live ClawPump launch has been submitted from this checkout. `INT-04` requires configured `CLAWPUMP_API_KEY`, authenticated wallet, funding, provider acceptance, and chain confirmation.
- No live Meteora config/pool proof is present in this checkout. The builder is implemented, but live proof requires `SOLANA_RPC_URL`, devnet/mainnet execution flags, wallet approval, funding, and confirmation.
- No hosted preview URL or production database is configured in the local workspace.
- PreStocks is read-only. Navis does not expose buy/sell or launch actions for PreStocks assets.
- The production build prints `bigint: Failed to load bindings, pure JS will be used` on this Windows environment; the build still completes.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

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

| Variable                         | Purpose                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`            | Domain used for wallet auth messages.                                |
| `NEXT_PUBLIC_SOLANA_CLUSTER`     | `devnet` or `mainnet-beta`.                                          |
| `NAVIS_EXECUTION_MODE`           | `demo`, `devnet`, or `mainnet`.                                      |
| `ENABLE_DEMO_MODE`               | Allows deterministic demo fixtures.                                  |
| `ENABLE_DEVNET_EXECUTION`        | Enables devnet value-moving flows when RPC is set.                   |
| `ENABLE_MAINNET_EXECUTION`       | Enables mainnet only when explicitly true and cluster matches.       |
| `MAINNET_RELEASE_APPROVED`       | Additional server-only mainnet release checklist gate.               |
| `SOLANA_RPC_URL`                 | Server-side RPC for reads, simulation, submission, and confirmation. |
| `DATABASE_URL`                   | PostgreSQL-compatible persistence.                                   |
| `SESSION_SECRET`                 | At least 32 characters for signed wallet sessions.                   |
| `CLAWPUMP_API_KEY`               | Server-only ClawPump key, expected `cpk_` prefix.                    |
| `PRESTOCKS_API_URL`              | Defaults to `https://prestocks.com/api/prestocks`.                   |
| `AI_PROVIDER`                    | `demo` or `openai`.                                                  |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Required only for `AI_PROVIDER=openai`.                              |

## Database

Generate or check migrations with Drizzle:

```bash
npm run db:check
```

Apply the SQL migrations in `drizzle/` to the configured PostgreSQL database before using persistent routes.

## Validation

The current local validation set is:

```bash
npm run check
```

To run the judge-flow smoke against a deployed origin instead of local `next start`:

```bash
NAVIS_SMOKE_BASE_URL=https://your-deployed-origin.example npm run smoke:judge
```

Set `NAVIS_SMOKE_REPORT=docs/deployed-smoke-report.json` to write a JSON evidence report for submission review.

To inspect the submission package for missing evidence rows, TODO markers, and unsupported live claims:

```bash
npm run submission:audit
```

Latest local result on 2026-09-19:

- Full check: passed format, lint, typecheck, 22 test files / 103 tests, production build, clean-session judge-flow smoke, Drizzle schema validation, and submission audit. The submission audit reports one expected warning for TODO markers that require external deployment/repository/video/live-evidence inputs.

## Demo route map

- `/agents/atlas` — public demo workspace.
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
- [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md)
- [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)
- [docs/SUBMISSION_DRAFT.md](docs/SUBMISSION_DRAFT.md)
- [docs/ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md)
