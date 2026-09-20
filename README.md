# Navis

Navis is a governed Solana equity-agent workspace for the Stocklana hackathon. It shows one constrained agent lifecycle: a mandate, token universe, deterministic risk checks, explicit wallet authority boundaries, sponsor launch surfaces, and hash-verifiable proof receipts.

Navis is not a brokerage UI and does not claim that demo assets or PreStocks tokens are legal shares. Demo receipts are simulations. Explorer links and signatures appear only when Navis has stored real submitted transaction evidence.

Independent review: [judge audit](docs/STOCKLANA_JUDGE_AUDIT.md) and [separate remediation report](docs/REMEDIATION_REPORT.md). Final local checks pass with 143 tests in 26 files. Local hardening is not yet pushed or deployed; the public demo remains the separately verified baseline commit.

## What is implemented

- Premium dark “Proof Terminal” product shell with demo Atlas agent.
- Deterministic demo decision, policy ledger, treasury snapshot, proof timeline, and public receipt verifier.
- Fresh Atlas decision runs with balanced and deliberately oversized scenarios, policy evaluation, and a newly hashed receipt on every run.
- Wallet Standard connection and nonce-based wallet authentication with environment-specific origin enforcement.
- PostgreSQL/Drizzle schema for agents, strategies, policies, decisions, execution attempts, events, proofs, market launches, and external calls.
- AI provider abstraction with deterministic demo provider and OpenAI-compatible provider guards.
- ClawPump integration for server-side agent linking, live pair discovery, and exact self-funded launch preflight.
- Meteora DBC integration with official SDK config preview, config transaction prepare/simulate/submit/confirm, pool creation prepare/simulate/submit, and pool monitor.
- PreStocks read-only catalogue adapter with schema validation and explicit economic-exposure/eligibility disclosure.
- Transaction ledger route for persisted execution attempts and sponsor launch records.

## Honest limitations

- Fresh demo decisions do not execute onchain. Without `DATABASE_URL`, the latest 50 runs are kept in process memory and disappear when the server instance restarts.
- Fresh decisions for persistent agents are not enabled yet because persisted snapshots do not contain every market fact required for an honest policy evaluation. The API returns 409 rather than inventing missing values.
- No live ClawPump launch has been submitted from this checkout. `INT-04` requires configured `CLAWPUMP_API_KEY`, authenticated wallet, funding, provider acceptance, and chain confirmation.
- ClawPump funded launch is unsupported in the current demo/devnet posture. The documented self-funded route has no devnet selector, and Navis currently implements preflight only.
- No live Meteora config/pool proof is present in this checkout. The builder is implemented, but live proof requires `SOLANA_RPC_URL`, devnet/mainnet execution flags, wallet approval, funding, and confirmation.
- Meteora live submission remains disabled until signed caller input is server-bound to the exact previously prepared proposal and the protocol is retested.
- The Vercel demo is publicly available at https://navis-gilt.vercel.app and is read-only deterministic demo mode. Replit `getDeploymentInfo` still reports NOT published; this is distinct from the Vercel deployment. No demo video URL, pitch video URL, technical video URL, or production database migration evidence is recorded.
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

To run the judge-flow smoke against a deployed origin instead of local `next start`:

```bash
NAVIS_SMOKE_BASE_URL=https://your-deployed-origin.example npm run smoke:judge
```

Set `NAVIS_SMOKE_REPORT=docs/deployed-smoke-report.json` to write a JSON evidence report for submission review.

To inspect the submission package for missing evidence rows, TODO markers, and unsupported live claims:

```bash
npm run submission:audit
```

Baseline result on 2026-09-20 (final counts may be updated by the main release pass):

- Fresh `npm run check` passed all eight baseline gates: format verification, ESLint, strict TypeScript, 24 test files / 113 tests, production Next.js 16.3.5 build, 11-route judge smoke including `/agents/new`, Drizzle schema validation, and submission audit.
- Independently verified real-Chromium QA passed the public Atlas → Inspect decision → public verifier journey and 10 UI routes at 375/768/1440 px with no overflow or missing input labels. Valid new-agent review created no write, auth-create remained disabled, Escape/focus return passed, contrast checks had no failures, reduced motion was effective, and Atlas at 200% CSS zoom had no overflow. Full screen-reader testing and actual wallet signing remain unverified.
- The Vercel deployment is READY at the same GitHub main commit (`ac26e54089154c872f117a54cc73af2a8fc6ff2b`). Public `/api/health` reports demo/devnet and the read-only deterministic posture described above.
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
