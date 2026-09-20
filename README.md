# Navis

Navis is a governed Solana equity-agent workspace for the Stocklana hackathon. It shows one constrained agent lifecycle: a mandate, token universe, deterministic risk checks, explicit wallet authority boundaries, sponsor launch surfaces, and hash-verifiable proof receipts.

Navis is not a brokerage UI and does not claim that demo assets or PreStocks tokens are legal shares. Demo receipts are simulations. Explorer links and signatures appear only when Navis has stored real submitted transaction evidence.

## What is implemented

- Premium dark “Proof Terminal” product shell with demo Atlas agent.
- Deterministic demo decision, policy ledger, treasury snapshot, proof timeline, and public receipt verifier.
- Wallet Standard connection and nonce-based wallet authentication with environment-specific origin enforcement.
- PostgreSQL/Drizzle schema for agents, strategies, policies, decisions, execution attempts, events, proofs, market launches, and external calls.
- AI provider abstraction with deterministic demo provider and OpenAI-compatible provider guards.
- ClawPump integration for server-side agent linking, live pair discovery, and exact self-funded launch preflight.
- Meteora DBC integration with official SDK config preview, config transaction prepare/simulate/submit/confirm, pool creation prepare/simulate/submit, and pool monitor.
- PreStocks read-only catalogue adapter with schema validation and explicit economic-exposure/eligibility disclosure.
- Transaction ledger route for persisted execution attempts and sponsor launch records.

## Honest limitations

- The verified judge walkthrough uses the recorded deterministic Atlas fixtures. Fresh proposal generation is deferred; unfinished restoration experiments are archived and are not part of the active product.
- No live ClawPump launch has been submitted from this checkout. `INT-04` requires configured `CLAWPUMP_API_KEY`, authenticated wallet, funding, provider acceptance, and chain confirmation.
- ClawPump funded launch is unsupported in the current demo/devnet posture. The documented self-funded route has no devnet selector, and Navis currently implements preflight only.
- No live Meteora config/pool proof is present in this checkout. The builder is implemented, but live proof requires `SOLANA_RPC_URL`, devnet/mainnet execution flags, wallet approval, funding, and confirmation.
- Meteora live submission remains disabled until signed caller input is server-bound to the exact previously prepared proposal and the protocol is retested.
- No published application URL, demo video URL, pitch video URL, technical video URL, or production database migration evidence is recorded.
- PreStocks is read-only. Navis does not expose buy/sell or launch actions for PreStocks assets.
- Browser-based real-wallet authentication remains unverified in the final manual QA pass.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

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

Latest local result on 2026-09-20:

- Fresh `npm run check` passed all eight gates: format verification, ESLint, strict TypeScript, 24 test files / 113 tests, production Next.js 16.3.5 build, 11-route judge smoke including `/agents/new`, Drizzle schema validation, and submission audit.
- Local browser QA passed the clean unauthenticated Atlas-to-verifier flow, `/agents/new` no-write review, 375 px responsive checks, keyboard focus, reduced motion, and 200% zoom. Runtime nonce checks passed same-origin binding and rejected foreign or missing origins. A real wallet extension and signing remain unverified.
- `npm audit --omit=dev` reports 19 production advisories: 6 high, 13 moderate, and no critical. The machine-readable result is `docs/dependency-audit.json`; this is not a claim that warnings are resolved or that the application is security-certified.

## Demo route map

- `/agents/atlas` — public demo workspace.
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
