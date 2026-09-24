# Navis Architecture

**Status:** Canonical Next.js implementation restored at the repository root.  
**Goal:** A realistic, auditable end-to-end hackathon demo with safe fallback modes.

## 1. High-level system architecture

```text
Browser
  ├─ Next.js UI + Wallet Adapter
  ├─ reads public agent/receipt data
  └─ signs explicitly approved Solana transactions
          │
          ▼
Next.js server (route handlers / server actions)
  ├─ Agent service
  ├─ Decision orchestrator ── AI provider adapter
  ├─ Deterministic policy engine
  ├─ Execution orchestrator ── Solana RPC
  ├─ ClawPump adapter ───────── clawpump.tech/api/v1
  ├─ Meteora DBC adapter ────── official TypeScript SDK
  ├─ PreStocks adapter (optional)
  └─ Proof service
          │
          ▼
Postgres-compatible database
```

Trust boundary: AI and external APIs propose or report; only deterministic Navis code authorizes a state transition. The browser wallet signs user-funded transactions. Sponsor keys and AI keys remain server-side.

## 2. Frontend architecture

Use Next.js App Router with server components for initial reads and client components only for wallet state, forms, proposal interaction, and signing.

Suggested routes:

- `/` — judge-ready agent overview and primary flow, not a marketing-only hero.
- `/agents/new` — guided agent configuration.
- `/agents/[agentId]` — profile, treasury, current strategy, and proof timeline.
- `/agents/[agentId]/decisions/[decisionId]` — proposal, validation, and receipt.
- `/markets/launch` — guarded ClawPump launch and Meteora DBC configuration.
- `/proofs/[proofId]` — public read-only verification page.
- `/settings` — cluster, provider health, and demo-mode status.

Prefer URL-backed route state and server-fetched data. Use local component state for drafts and disclosure acknowledgements. Do not put authoritative execution status in browser storage.

## 3. Backend/API architecture

Route handlers are thin boundary layers. Domain services own orchestration and repositories own persistence.

```text
app/api/*               authentication, validation, response mapping
lib/domain/*            types and invariants
lib/services/*          use-case orchestration
lib/integrations/*      ClawPump, Meteora, Solana, AI, PreStocks
lib/policy/*            deterministic rules
lib/proofs/*            canonicalization, hashes, receipts
lib/db/*                schema and repositories
```

All external responses are parsed with Zod. Sponsor calls include a timeout, correlation ID, redacted structured logging, and explicit retry policy. Writes are never blindly retried.

## 4. AI decision-engine architecture

1. Build a versioned `DecisionContext` from portfolio, market snapshot, strategy, and policy.
2. Reject missing or stale inputs before calling the model.
3. Send a prompt that permits only the typed action schema.
4. Parse strict JSON and reject extra actions, unknown mints, or malformed amounts.
5. Canonicalize the proposal and compute `decisionHash`.
6. Run the deterministic policy engine.
7. Store model/provider metadata, input-source references, result, and hash.

Provider interface:

```ts
interface DecisionProvider {
  propose(context: DecisionContext): Promise<TradeProposal>;
}
```

Implement an OpenAI-compatible adapter plus a deterministic fixture adapter. The fixture adapter is labelled `demo` and produces a known proposal for the judge flow. The model never receives private keys and never directly signs or submits.

## 5. Solana integration architecture

- `Connection` is created server-side for reads/confirmation and client-side only where wallet signing requires it.
- Use explicit `devnet` or `mainnet-beta`; never infer cluster from a transaction string.
- Fetch blockhash immediately before signing.
- Simulate supported transactions before wallet prompt.
- Store signatures only after RPC submission and update status after confirmation.
- Reconcile balances from RPC after confirmation instead of trusting optimistic UI.
- Use integer base units and mint decimals; display conversion happens at the edge.

## 6. Wallet flow

1. User connects a supported wallet.
2. Navis stores only the public key and a short-lived signed nonce session.
3. Server verifies domain-bound sign-in message, nonce, expiry, and public key.
4. User requests execution.
5. Server verifies ownership/session, decision approval, expiry, cluster, and idempotency.
6. Server or sponsor builds the transaction; browser displays a human-readable summary.
7. Wallet signs; client submits or returns the signed payload according to integration needs.
8. Server confirms by signature and creates the receipt.

ClawPump agent wallets are distinct from a connected user wallet. Their addresses and funding state are displayed explicitly. Navis never implies the user controls a ClawPump-held creator wallet.

## 7. Agent creation flow

1. Choose the single MVP template.
2. Set name, objective, allowed mints, cadence, and numeric limits.
3. Validate cross-field invariants, for example `maxTradeWeight <= maxPositionWeight`.
4. Review risk and product disclosures.
5. Create Navis `Agent`, `StrategyVersion`, and `RiskPolicyVersion` atomically.
6. If ClawPump is configured, create a linked agent through `POST /agents` with minimum required skills.
7. Persist external ID, returned wallet address, model, and request ID.
8. If the external call fails, retain a local draft with `integrationStatus=failed`; do not invent an external ID.

## 8. Agent treasury model

The treasury is an observed view, not an internal ledger of truth.

- `TreasuryAccount`: cluster, owner public key, custody type (`user_wallet` or `clawpump_agent`), last sync.
- `TreasuryBalance`: mint, token account, raw amount, decimals, UI amount, slot, source.
- `PortfolioSnapshot`: immutable set of balances and valuations used for a decision.
- `Valuation`: price, currency, provider, provider timestamp, received timestamp, confidence/quality.

Unknown tokens are visible but not tradable until allowlisted. Missing prices produce `unvalued` exposure and block rules that require total portfolio value.

## 9. Strategy and risk-constraint model

`StrategyVersion` contains objective, horizon, cadence, universe, signals, and allowed actions. `RiskPolicyVersion` contains typed limits. Both are immutable after use.

Use discriminated constraints such as:

```ts
type Constraint =
  | { type: "allowed_mints"; mints: string[] }
  | { type: "max_trade_bps"; value: number }
  | { type: "max_position_bps"; value: number }
  | { type: "min_reserve_bps"; value: number }
  | { type: "max_slippage_bps"; value: number }
  | { type: "max_daily_turnover_bps"; value: number }
  | { type: "cooldown_seconds"; value: number }
  | { type: "max_data_age_seconds"; value: number };
```

Hashes are computed from canonical JSON, excluding database IDs and display-only text.

## 10. Decision validation model

Validation is pure and ordered:

1. schema and numeric sanity;
2. strategy/policy version match;
3. allowed action and mints;
4. data and quote freshness;
5. treasury sufficiency;
6. trade-notional and post-trade concentration;
7. reserve, turnover, cooldown, liquidity, and slippage;
8. cluster/mode gate;
9. duplicate or pending-execution gate.

Each rule returns `ruleId`, `status`, `observed`, `limit`, and `message`. Any `fail` blocks execution. `unavailable` blocks only where the policy declares the datum mandatory; otherwise it produces a visible warning.

## 11. Transaction execution model

State machine target:

```text
draft → proposed → validated_approved → awaiting_signature
      ↘ rejected
awaiting_signature → submitted → confirmed
                   ↘ cancelled | expired | failed
simulation_requested → simulated | simulation_failed
```

Execution endpoints accept an idempotency key. The server locks the decision row while creating an execution attempt. Only one active attempt is allowed. A background reconciliation call may update submitted transactions, but the judge flow also polls confirmation directly.

## 12. ClawPump integration plan

Use the stable Partner API at `https://clawpump.tech/api/v1` with `Authorization: Bearer cpk_…`; never call the redirecting `agents.clawpump.tech` host. The key is server-only.

MVP endpoints:

- `GET /skills` — verify available skills.
- `POST /agents` and `GET /agents/{id}` — agent lifecycle/linkage.
- `GET /pump-pairs` — authoritative supported launch pairs.
- `GET /launch/self-funded` — cost discovery.
- `POST /launch` or `POST /launch/self-funded` — guarded launch.
- `POST /swap/quote` — quote only.
- `POST /swap/execute` — unsigned swap construction if required.

Rules:

- Set 120-second timeouts for chat/launch operations.
- Log `meta.requestId`.
- Parse 402 responses as structured payment/preflight states, not generic failure.
- Do not blindly retry non-idempotent writes.
- Confirm pair mint, fixed creator fee, payout wallet, payment wallet, and initial buy before signing.
- Treat `/agents/{id}/chat` as side-effect-capable; do not use it for decision prose unless the linked agent has no value-moving tools.
- Surface ClawPump safety denials instead of auto-sending acknowledgement flags.

## 13. Meteora integration plan

Use `@meteora-ag/dynamic-bonding-curve-sdk` with compatible `@solana/web3.js`, `@solana/spl-token`, and `bn.js`. The documented DBC program ID is the same on devnet and mainnet, but all addresses and transactions must still carry their cluster.

Separate flows:

- **Configuration preview:** exact quote mint, curve mode, market-cap/price parameters, fee scheduler, supply, authorities, graduation threshold, and DAMM migration target.
- **Create config:** build, simulate, wallet-sign, submit, confirm, persist config address.
- **Create pool/token:** use a confirmed config, simulate, sign, persist base mint and pool.
- **Monitor:** read pool state, quote reserve, threshold progress, and migration status.

Devnet is default. Mainnet requires an explicit feature flag and confirmation. Funding estimates shown in third-party skill references are planning hints, not guaranteed costs; Navis must compute current estimates before execution.

## 14. PreStocks integration plan

Treat PreStocks as optional until the public API response contract and regional eligibility are verified. Adapter responsibilities:

- fetch and validate the catalogue server-side;
- retain canonical mint/address, symbol, referenced company, price fields, and timestamps only when provided;
- cache briefly with stale-state labels;
- preserve product disclosures;
- block action for users who affirm an ineligible jurisdiction;
- never substitute company ticker text for an onchain mint.

If the endpoint is unavailable, use a checked-in fixture with `source=demo_fixture`, omit execution, and do not claim bounty completion.

## 15. Data model

Core entities:

- `User`: wallet public key and terms/disclosure timestamps.
- `Agent`: Navis identity, owner, status, mode, linked provider IDs.
- `StrategyVersion`: canonical document and hash.
- `RiskPolicyVersion`: typed constraints and hash.
- `Asset`: mint, cluster, symbol, decimals, issuer/source, verification state.
- `AgentAssetPermission`: allowed actions and maximum exposure override.
- `TreasuryAccount` and `PortfolioSnapshot`.
- `MarketSnapshot`: source values and timestamps.
- `Decision`: structured proposal, model metadata, hash, expiry.
- `PolicyEvaluation` and `PolicyCheck`.
- `ExecutionAttempt`: state, idempotency key, transaction details, error.
- `ProofReceipt`: immutable projection for public verification.
- `MarketLaunch`: ClawPump/Meteora details and proof.
- `ExternalCall`: provider, request ID, status, latency, safe error.

## 16. Database schema suggestion

Use PostgreSQL with Drizzle. The runtime pool applies a 5-second connection timeout, 10-second statement timeout, and 12-second query timeout. Important constraints:

- unique `(owner_wallet, slug)` for agents;
- unique hash for strategy and policy versions per agent;
- unique `decision_hash`;
- unique `(decision_id, active=true)` enforced transactionally for active attempts;
- unique sponsor request/idempotency keys;
- append-only proof records after finalization;
- JSONB only for provider payload fragments and canonical version documents; queryable state remains typed columns.

The verified demo baseline uses versioned deterministic fixtures and an in-memory write overlay for the Atlas demo agent. Fresh proposal wiring is live: `POST /api/decisions/run` generates a proposal, evaluates it with the deterministic policy runner and hashes a receipt. For Atlas the run is held in bounded process memory (no database needed) and the asset universe defaults to the live PreStocks catalogue (`lib/decisions/universe.ts`) with a fixture fallback. For owner-created agents in demo mode the same run is written in one transaction as a portfolio snapshot, decision, policy evaluation, simulated execution attempt and proof receipt, all owner-scoped; devnet and mainnet agents are refused with 409 because a persisted snapshot does not hold every market fact an honest evaluation needs. Every receipt, decision detail, run result and ledger row carries an assurance level (`lib/assurance.ts`): offchain integrity, wallet authorization or onchain settlement, plus demo simulation or live. Migrations `0000` to `0007` ship in `drizzle/`; `0006` adds execution intents and `0007` the Meteora `submitting` status. Demo mode must never share the production database URL or represent fixture output as an onchain result.

## 17. API route structure

```text
GET  /api/agents
POST /api/agents
GET  /api/agents/:id
POST /api/agents/:id/sync
POST /api/agents/:id/decisions
GET  /api/decisions/:id
POST /api/decisions/:id/validate
POST /api/decisions/:id/simulate
POST /api/decisions/:id/prepare
POST /api/executions/:id/confirm
GET  /api/proofs/:id
GET  /api/integrations/clawpump/pairs
POST /api/integrations/clawpump/launch/preflight
POST /api/integrations/clawpump/launch
POST /api/integrations/meteora/configs/prepare
POST /api/integrations/meteora/pools/prepare
GET  /api/integrations/meteora/pools/:address
GET  /api/assets/prestocks
POST /api/auth/nonce
POST /api/auth/verify
```

Prepare endpoints return bounded transaction data and a human-readable summary; they do not accept arbitrary instructions from the client.

## 18. Component structure

```text
components/
  agent/AgentHeader, MandateCard, ModeBadge
  strategy/StrategySummary, PolicyChecks
  treasury/TreasuryTable, AllocationView, SnapshotMeta
  decision/DecisionComposer, ProposalCard, ValidationReport
  execution/ApprovalSummary, ExecutionStatus, ProofReceipt
  market/PairPicker, LaunchPreflight, DbcConfigReview
  wallet/WalletControl, ClusterGuard
  shared/SourceLabel, AddressLink, EmptyState, ErrorNotice
```

## 19. State management approach

- Server state: server components plus a small query cache library only if client revalidation becomes necessary.
- Form state: React Hook Form + Zod.
- Wallet state: Wallet Adapter context.
- Ephemeral UI: local React state.
- No global store in the first pass; introduce one only if cross-route draft state proves necessary.
- Execution truth always comes from database/RPC refresh, never optimistic global state.

## 20. Authentication and wallet connection

Use Sign-In With Solana semantics: server-generated nonce, domain/audience, statement, wallet address, issued-at, expiry, and chain context. Verify signature server-side and issue an HTTP-only, `Secure`, `SameSite=Lax` session cookie. CSRF-protect mutations. Public proof pages require no session. Only in development may the origin derive from the exact runtime `REPLIT_DEV_DOMAIN`; production blocks auth until an explicit HTTPS `NEXT_PUBLIC_APP_URL` is set. Redacted settings and health responses expose only an origin-capability boolean.

## 21. Environment variables

```dotenv
DATABASE_URL=
SESSION_SECRET=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=
CLAWPUMP_API_KEY=
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
PRESTOCKS_API_URL=https://prestocks.com/api/prestocks
ENABLE_DEMO_MODE=true
ENABLE_DEVNET_EXECUTION=false
ENABLE_MAINNET_EXECUTION=false
MAINNET_RELEASE_APPROVED=false
```

Only `NEXT_PUBLIC_*` values may enter browser bundles. Validate environment variables at startup and expose a redacted capability-status object to the UI.

## 22. Error handling

Classify errors as validation, policy denial, user cancellation, insufficient funds, stale quote, sponsor/API, RPC, confirmation timeout, and internal. Return stable codes plus safe messages. Preserve provider request IDs. Pending/unknown confirmation handling is covered, but the original Meteora broadcast-error path does not yet guarantee that every transport timeout persists as `unknown_pending`. Do not enable that protocol until the broadcast path and server-prepared/simulation binding are fixed and retested. Error screens must offer a safe retry only when idempotency permits.

## 23. Demo-mode fallback rules

| Capability  | Real mode                | Devnet mode             | Demo fallback                  |
| ----------- | ------------------------ | ----------------------- | ------------------------------ |
| Agent       | ClawPump ID/wallet       | Same if supported       | Fixture ID prefixed `demo_`    |
| Portfolio   | RPC balances             | Devnet RPC              | Timestamped fixture            |
| Decision    | Configured model         | Configured model        | Deterministic fixture provider |
| Validation  | Always real Navis engine | Same                    | Same                           |
| Swap/launch | Real signed transaction  | Real devnet transaction | Simulation receipt only        |
| Proof       | Signature + RPC data     | Signature + RPC data    | `SIMULATED`, no explorer link  |

The UI must never mix sources silently. Each snapshot and receipt carries `mode` and `source`.

## 24. Security considerations

- Keep bearer keys and AI keys server-side; redact headers and payload secrets.
- Encrypt sensitive hosted secrets through the deployment platform.
- Use least-privilege ClawPump skills because chat can trigger side effects.
- Allowlist program IDs, endpoint hosts, clusters, mints, and transaction instruction types.
- Decode and summarize every prepared transaction before user signature.
- Reject unexpected writable accounts, fee payers, or transfer destinations.
- Use decimal-safe math and base-unit integers.
- Rate-limit decision generation and write endpoints.
- Bind idempotency keys to user, decision, and normalized request.
- Sanitize external metadata and image URLs.
- Protect against prompt injection by treating news/metadata as quoted data, never instructions.
- Do not log raw signed transactions longer than necessary.
- Review Meteora audits, but do not present an audit as a guarantee of safety.

## 25. Deployment plan

- Deploy the Next.js application to a platform supporting server routes and secret storage.
- Use managed Postgres for production. In Replit, production migration is handled through the user Publish flow. Do not add startup DDL or prescribe manual SQL against managed production.
- Configure a dedicated RPC endpoint and health check.
- Use preview environment with devnet and demo mode; production mainnet execution remains disabled until rehearsal passes.
- Seed only public fixture data; no private keys.
- Add uptime/provider capability panel for judge transparency.

## 26. Testing plan

### Unit

- Every policy rule, canonical hash, amount conversion, state transition, and disclosure gate.

### Integration

- Route validation and auth.
- ClawPump response parsing for 200/401/402/403/5xx and pair changes.
- Meteora transaction construction against devnet/local fixtures.
- RPC confirmation and pre/post balance reconciliation.
- Demo adapters cannot emit signatures or mainnet mode.

### End to end

- Create/inspect agent.
- Generate approved and rejected decisions.
- Cancel signature and recover.
- Simulate and inspect receipt.
- Run devnet execution when funded.
- Load public proof in a clean session.
- ClawPump launch preflight and guarded execution.

### Manual release gates

- Verify every explorer link.
- Inspect client bundle for secrets.
- Test 375px mobile and keyboard navigation.
- Rehearse the judge flow on a clean wallet/browser.
- Confirm current sponsor API behavior and deadline before submission.

## Architecture decision summary

- No custom program for MVP.
- Browser wallet for user authorization; no user key custody.
- AI proposes; deterministic code validates.
- Append-only versioned proofs connect strategy to execution.
- ClawPump and Meteora are separate adapters with separate evidence.
- PreStocks is optional and gated by API/eligibility verification.
