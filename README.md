# Navis

[![CI](https://github.com/syther069/Navis/actions/workflows/ci.yml/badge.svg)](https://github.com/syther069/Navis/actions/workflows/ci.yml)

Navis is a governance and verification layer for AI agent workflows on Solana. An agent can prepare a financial action. A deterministic policy evaluates it. The wallet owner decides whether to sign. Navis records the outcome and produces a hash-verifiable receipt at every step.

It is not a brokerage, custodial wallet, or trading platform. Agents cannot move funds on their own. Demo mode is simulation only — no transactions are submitted and no funds move.

Public demo: **[navis-gilt.vercel.app](https://navis-gilt.vercel.app)** (demo mode, devnet cluster)

---

## How it works

```
Agent proposes an action
        ↓
Policy evaluates it against deterministic rules
        ↓
Wallet owner reviews and authorises (signature required for execution)
        ↓
Navis records the result and issues a verifiable receipt
```

Each step in this chain produces an auditable artifact — a decision record, a policy evaluation, and a receipt with a hash you can verify from a clean browser. The agent cannot skip evaluation. The wallet cannot be bypassed. A demo receipt is clearly labelled as a simulation.

---

## Capabilities

| Area | What is implemented |
|---|---|
| Decision engine | Deterministic policy evaluation against configurable rule sets; per-check observed value, limit, and data source |
| Proof receipts | Hash-verifiable receipts with assurance badges (offchain integrity, wallet authorization, onchain settlement); simulation vs live clearly labelled |
| Wallet auth | Wallet Standard connection and nonce-based session authentication; same-origin trusted behind deployment proxy |
| Agent workspace | Agent creation with mandate, constraint ledger, and portfolio snapshot; decision and proof pages scoped per owner |
| PreStocks catalogue | Read-only validated catalogue adapter; live asset universe for Atlas demo decisions; premium/discount research view |
| Meteora DBC | SDK config preview, two server-approved quote profiles, prepare/simulate/submit/confirm flow; devnet-only for the SOL-quoted profile; mainnet broadcast code-blocked |
| ClawPump | Provider verification, pair discovery, launch preflight; funded launch execution not implemented |
| Database | PostgreSQL/Drizzle schema for agents, decisions, policy evaluations, execution attempts, proofs, and market launches |
| Markets surface | PreStocks research view, Meteora DBC builder, ClawPump preflight display |

---

## Demo: Atlas decision workflow

The fastest way to understand Navis is to run a decision on the Atlas agent.

**1. Open the Atlas workspace**

Go to [/agents/atlas](https://navis-gilt.vercel.app/agents/atlas). You will see the agent mandate, constraint ledger, and a demo portfolio snapshot.

**2. Run a Balanced decision**

In the *Run new decision* panel, leave the universe on *PreStocks universe*, choose *Balanced*, and press *Run decision*. The policy approves the proposal. Most checks pass; the liquidity check warns because PreStocks publishes no liquidity figure and Navis does not invent one.

<!-- docs/images/atlas-workspace.png
     Capture the /agents/atlas page on desktop after a Balanced demo decision.
     The screenshot should show the proposal, policy outcome, and proof link. -->

**3. Run an Oversized decision**

Switch to *Oversized* and run again. The policy rejects it. The *Why this failed* panel names the checks that exceeded their limits — max trade bps and min reserve bps — along with the observed value and configured limit for each.

<!-- docs/images/policy-decision.png
     Capture the Oversized decision result.
     The screenshot should clearly show a failed policy check, observed value, configured limit, and rejection reason. -->

**4. Verify the receipt**

Press *Verify receipt* on either result. Both runs produce a valid receipt regardless of outcome. The assurance badge reads *Offchain integrity* and *Demo simulation* — the public demo does not submit transactions.

<!-- docs/images/proof-verification.png
     Capture a proof or receipt verification page.
     The screenshot should show the verification status and receipt hash. -->

**5. Inspect the static decision**

[/agents/atlas/decisions/demo-decision](https://navis-gilt.vercel.app/agents/atlas/decisions/demo-decision) shows the deterministic proposal, every policy check, and the receipt hash. There is no explorer link because no transaction was submitted.

> The Atlas agent is public and requires no wallet. To create your own agent and have runs persisted with decision and proof links, connect a wallet, sign in, and create an agent at [/agents/new](https://navis-gilt.vercel.app/agents/new). Persistent runs require `DATABASE_URL` and `SESSION_SECRET` to be configured.

---

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The default configuration runs in locked demo mode — no wallet, no database, and no live execution required.

### Run a fresh decision locally

Open `/agents/atlas`, choose a scenario, and press *Run decision*. Without `DATABASE_URL` set, the result stays in process memory and disappears on restart. Set `DATABASE_URL` and `SESSION_SECRET`, run `npm run db:migrate`, connect a wallet, and runs are persisted with durable links.

### Apply database migrations

```bash
# Run migrations against your DATABASE_URL
npm run db:migrate

# Verify the schema matches the current state
npm run db:check
```

The repository ships migrations `0000` through `0008`. All are additive. Navis does not run DDL at startup.

---

## Default environment

The `.env.example` ships with these safe defaults:

```env
NAVIS_EXECUTION_MODE=demo
ENABLE_DEMO_MODE=true
ENABLE_DEVNET_EXECUTION=false
ENABLE_MAINNET_EXECUTION=false
MAINNET_RELEASE_APPROVED=false
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
AI_PROVIDER=demo
PRESTOCKS_API_URL=https://prestocks.com/api/prestocks
```

In this posture, no value-moving code path is reachable and no external credentials are required.

---

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Explicit HTTPS origin for wallet auth. Leave unset before first deploy. |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` or `mainnet-beta` |
| `NAVIS_EXECUTION_MODE` | `demo`, `devnet`, or `mainnet` |
| `ENABLE_DEMO_MODE` | Allows deterministic demo fixtures |
| `ENABLE_DEVNET_EXECUTION` | Enables devnet value-moving flows when RPC is configured |
| `ENABLE_MAINNET_EXECUTION` | Reserved flag; Meteora mainnet broadcast remains code-blocked |
| `MAINNET_RELEASE_APPROVED` | Reserved server-only flag; does not bypass the code hard-stop |
| `SOLANA_RPC_URL` | Server-side RPC for reads, simulation, submission, and confirmation |
| `DATABASE_URL` | PostgreSQL-compatible connection string |
| `SESSION_SECRET` | Minimum 32 characters; required for signed wallet sessions |
| `CLAWPUMP_API_KEY` | Server-only key (`cpk_` prefix) from [clawpump.tech/developers](https://clawpump.tech/developers) |
| `PRESTOCKS_API_URL` | Defaults to `https://prestocks.com/api/prestocks` |
| `AI_PROVIDER` | `demo` or `openai` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Required only when `AI_PROVIDER=openai` |

---

## Execution posture

Navis enforces strict boundaries between what is simulated and what executes:

- **Demo mode** — deterministic fixtures, no external calls required, no transactions submitted. All public Atlas runs are demo-mode simulations.
- **Devnet** — the `navis-equity-v1` SOL-quoted Meteora profile is the only authorised devnet path. Requires `NAVIS_EXECUTION_MODE=devnet`, `ENABLE_DEVNET_EXECUTION=true`, a configured devnet RPC, wallet authentication, and a funded devnet wallet. The mandatory sequence is prepare → wallet sign → simulate → submit → reconcile. No stage can be skipped.
- **Mainnet** — Meteora mainnet broadcast is code-blocked regardless of environment flags. ClawPump supports preflight only; funded launch execution is not implemented.

PreStocks tokens represent economic exposure, not equity ownership or voting rights. Navis exposes no PreStocks buy, sell, or launch path. The integration is read-only.

---

## Application routes

| Route | Description |
|---|---|
| `/` | Landing: one-sentence pitch, three proof points, assurance model, entry links |
| `/agents` | Agent list: Atlas plus signed-in owner agents |
| `/agents/atlas` | Public demo workspace with *Run new decision* panel |
| `/agents/new` | Agent creation (requires wallet session and database) |
| `/agents/<slug>` | Owner agent workspace; runs persisted in demo mode |
| `/decisions/<id>` | Persisted decision detail, owner-scoped; unknown IDs return 404 |
| `/proofs` | Hash-verifiable receipt list |
| `/proofs/<id>` | Receipt verification with assurance badges; unknown IDs return 404 |
| `/markets/launch` | ClawPump preflight, Meteora DBC builder, PreStocks research view |
| `/transactions` | Execution and market-launch ledger (requires database) |
| `/settings` | Capability and safety posture |
| `/disclosures` | Risk, privacy, tokenized-exposure, wallet-authority, and evidence-claim boundaries |
| `/api/health` | Non-secret readiness summary: mode, cluster, database, RPC, integrations |
| `/api/decisions/run` | `POST { agentSlug, scenario, universe }` — same-origin only |
| `/api/assets/prestocks` | Read-only validated PreStocks catalogue |

---

## Validation

Run the full local gate before pushing:

```bash
npm run check
```

This runs in sequence: format check, ESLint, TypeScript, tests, lockfile registry check, production build, judge smoke, Drizzle schema check, and submission audit. No secrets required. The same gate runs on GitHub CI for every push and pull request.

Individual commands:

```bash
npm run typecheck          # TypeScript strict check
npm run test               # Vitest test suite
npm run lint               # ESLint
npm run smoke:judge        # Judge flow smoke against built app
npm run submission:audit   # Check for missing evidence and unsupported claims
npm run db:check           # Verify Drizzle schema matches migrations
```

To run the smoke against a deployed origin:

```bash
NAVIS_SMOKE_BASE_URL=https://your-deployed-origin.example npm run smoke:judge
```

---

## Documentation

| Document | Contents |
|---|---|
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Full integration ledger: ClawPump, Meteora DBC, PreStocks — status, evidence, and audit notes |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | Step-by-step demo walkthrough and list of claims to avoid |
| [docs/EVIDENCE.md](docs/EVIDENCE.md) | Deployed commit, public smoke result, health output |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) | Migration, secrets, and deployment checklist |
| [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) | Origin enforcement, session model, and known dependency advisories |
| [docs/LOCAL_QA.md](docs/LOCAL_QA.md) | Local QA results and Chromium walkthrough notes |
| [docs/ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md) | Third-party dependency notices |

---

## License

MIT. See [LICENSE](LICENSE).
