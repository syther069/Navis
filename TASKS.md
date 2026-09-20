# Navis Engineering Task Plan

**Status:** Implementation in progress. Safe local product functionality is being closed out against this plan.  
**Priority:** P0 = required for the judge flow, P1 = important, P2 = optional.  
**Mode rule:** No task is complete if it displays invented onchain data as real.

**Implementation progress:** `SET-01`, `SET-02`, `SET-03`, `DOC-01`, `DOC-02`, `UI-01`, and `UI-02` completed on 2026-09-16. `UI-03`, `DS-01`, `DS-02`, `DATA-01`, `DATA-02`, `DATA-03`, `PRF-01`, `PRF-02`, `PRF-03`, `AGT-01`, `AGT-02`, `AGT-03`, `SOL-01`, `SOL-02`, `SOL-03`, `TRS-01`, `TRS-02`, `TRS-03`, `AI-01`, `AI-02`, `AI-03`, `AI-04`, `RSK-01`, `RSK-02`, `RSK-03`, `INT-01`, `INT-02`, `INT-03`, `EXE-01`, `EXE-02`, `DEM-01`, `DEM-02`, `DEM-03`, `DOC-03`, `MET-01`, `MET-02`, `MET-03`, and `MET-04` completed locally on 2026-09-17. `PRE-01`, `PRE-02`, read-only `PRE-03` disclosure, `EXE-03`, `DS-03`, local demo-mode `TST-03` smoke, `TST-04`, `DEP-02`, `DEP-03`, `SUB-01`, and `SUB-02` completed locally on 2026-09-19. The local release gate was tightened on 2026-09-19 so `npm run check` now includes production build, judge-flow smoke, Drizzle validation, and submission audit; a deployment runbook, submission draft, and attributions were also added. The proof receipt contract now includes explicit `hashAnchoring` status so the demo proof is machine-verified and visibly labelled `offchain_only`. A public `/disclosures` route now covers risk, privacy, eligibility, wallet-authority, and evidence-claim boundaries. Session deletion now shares the trusted-origin mutation guard used by other auth/execution routes. The judge-flow smoke now supports deployed-origin verification and JSON evidence reports for `DEP-01`/`SUB-03`. `TST-03` devnet rehearsal, `DEP-01`, `SUB-03`, and `SUB-04` cannot be complete without deployed URL/video/live sponsor evidence. Live Meteora and ClawPump submission proof remains externally blocked on configured provider/RPC credentials, authenticated wallet approval, funding, and chain confirmation. `INT-04` remains a live external execution item and `INT-05` is optional P1 swap work.

**Restoration update, 2026-09-20:** The canonical npm and Next.js application is restored at the repository root. `npm install` retained every existing dependency version and normalized lock peer metadata: 157 peer/optional package paths were added, including React Native peer paths, and 4 optional paths were removed. The lock remains derived from the original; no core dependency version was upgraded or downgraded. Fresh `npm run check` passed all eight gates, including 24 test files / 113 tests, a Next.js 16.3.5 production build, and the 11-route smoke including `/agents/new`. The agent create/read ownership fix and focused sponsor corrections passed their tests. Local browser QA passed the clean unauthenticated deterministic flow, responsive/accessibility checks, and runtime nonce-origin checks; real wallet extension/signing remains unverified. Fresh proposal generation remains deferred and archived. `npm audit --omit=dev` reports 19 production advisories, 6 high and 13 moderate with no critical findings; they are not resolved.

## 1. Project setup

| ID     | Task                   | Goal                                                                                         | Files likely affected                                     | Acceptance criteria                                                               | Priority | Dependencies           |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- | ---------------------- |
| SET-01 | Initialize Navis app   | Create a strict Next.js/TypeScript/Tailwind workspace without replacing these planning docs. | `package.json`, `app/*`, `tsconfig.json`, Tailwind config | App runs, type-checks, and is named Navis in metadata and package config.         | P0       | Documentation approval |
| SET-02 | Configure environments | Validate server/public variables and execution flags at startup.                             | `.env.example`, `lib/env.ts`                              | Missing required values fail clearly; no secret is exposed under `NEXT_PUBLIC_*`. | P0       | SET-01                 |
| SET-03 | Add quality gates      | Add type-check, format, test, and build commands.                                            | `package.json`, CI config                                 | Clean checkout can install and run all documented checks.                         | P0       | SET-01                 |

## 2. Documentation

| ID     | Task                        | Goal                                                                          | Files likely affected                                | Acceptance criteria                                                 | Priority | Dependencies                     |
| ------ | --------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- | -------- | -------------------------------- |
| DOC-01 | Approve planning baseline   | Resolve open assumptions and bounty target before code.                       | `PRD.md`, `ARCHITECTURE.md`, `TASKS.md`, `PHASES.md` | Owner explicitly approves or edits scope.                           | P0       | None                             |
| DOC-02 | Create design specification | Translate supplied design skills and references into Navis-specific UI rules. | `DESIGN.md`                                          | Covers all requested design sections and anti-slop checks.          | P0       | Complete; pending owner approval |
| DOC-03 | Maintain integration ledger | Record tested endpoints, clusters, addresses, and proof links.                | `docs/INTEGRATIONS.md`                               | Every sponsor claim maps to a tested artifact or is marked planned. | P1       | INT-01, MET-01                   |

## 3. Frontend shell

| ID    | Task                          | Goal                                                                  | Files likely affected                           | Acceptance criteria                                                                       | Priority | Dependencies        |
| ----- | ----------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- | ------------------- |
| UI-01 | Build app shell               | Provide compact navigation, mode/cluster identity, and wallet entry.  | `app/layout.tsx`, `components/shell/*`          | Core action is visible in first viewport; mode and cluster are never ambiguous.           | P0       | SET-01, DOC-02      |
| UI-02 | Add application routes        | Establish agent, decision, proof, market launch, and settings routes. | `app/agents/*`, `app/proofs/*`, `app/markets/*` | Routes have useful loading, empty, and error states.                                      | P0       | UI-01               |
| UI-03 | Responsive/accessibility pass | Make core flow usable on mobile and by keyboard.                      | Shared components/styles                        | No horizontal overflow at 375px; focus, labels, contrast, and reduced motion pass review. | P1       | Feature UI complete |

## 4. Design system

| ID    | Task                     | Goal                                                                        | Files likely affected                | Acceptance criteria                                                          | Priority | Dependencies       |
| ----- | ------------------------ | --------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- | -------- | ------------------ |
| DS-01 | Implement tokens         | Encode approved color, type, spacing, radius, border, and motion rules.     | `app/globals.css`, font/layout files | All product screens use shared tokens and remain readable at 200% text zoom. | P0       | DOC-02             |
| DS-02 | Build domain primitives  | Create source, status, mode, address, amount, and policy-result components. | `components/shared/*`                | Demo/devnet/mainnet and pass/fail/warn cannot be confused by color alone.    | P0       | DS-01              |
| DS-03 | Visual consistency audit | Remove generic dashboard filler and inconsistent one-off styles.            | Product components                   | UI matches DESIGNS anti-AI-slop checklist.                                   | P1       | All frontend tasks |

## 5. Agent data model

| ID      | Task                          | Goal                                                              | Files likely affected                 | Acceptance criteria                                                         | Priority | Dependencies             |
| ------- | ----------------------------- | ----------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- | -------- | ------------------------ |
| DATA-01 | Define domain schemas         | Type Agent, StrategyVersion, RiskPolicyVersion, Asset, and modes. | `lib/domain/*`                        | Schemas enforce mint, cluster, version, and limit invariants.               | P0       | DOC-01                   |
| DATA-02 | Create persistence schema     | Store immutable versions, decisions, attempts, and proofs.        | `lib/db/schema.*`, migrations         | Constraints prevent duplicate hashes and parallel active executions.        | P0       | DATA-01, database choice |
| DATA-03 | Add repositories and fixtures | Isolate DB and demo data behind the same interfaces.              | `lib/db/repositories/*`, `fixtures/*` | Fixture IDs/sources are visibly demo; production cannot silently fall back. | P0       | DATA-02                  |

## 6. Agent launch flow

| ID     | Task                     | Goal                                                                          | Files likely affected                        | Acceptance criteria                                                       | Priority | Dependencies    |
| ------ | ------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- | -------- | --------------- |
| AGT-01 | Build focused agent form | Capture objective, asset allowlist, cadence, and numeric limits.              | `app/agents/new/*`, `components/agent/*`     | Cross-field validation works and review precedes creation.                | P0       | DATA-01, DS-01  |
| AGT-02 | Persist versioned agent  | Atomically create agent, strategy, and policy versions.                       | `app/api/agents/*`, `lib/services/agents.ts` | Partial records are rolled back; hashes are stable.                       | P0       | DATA-02, AGT-01 |
| AGT-03 | Link ClawPump agent      | Create/link external agent with minimum skills and preserve request metadata. | `lib/integrations/clawpump/*`, agent API     | Failure leaves an honest local draft, never a fabricated external wallet. | P0       | INT-01, AGT-02  |

## 7. AI decision engine

| ID    | Task                           | Goal                                                                    | Files likely affected                     | Acceptance criteria                                                                | Priority | Dependencies  |
| ----- | ------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- | -------- | ------------- |
| AI-01 | Define decision contract       | Create strict context and proposal schemas.                             | `lib/domain/decision.ts`                  | Only supported actions and valid amounts/mints parse.                              | P0       | DATA-01       |
| AI-02 | Implement provider abstraction | Support configured AI and deterministic demo fixture.                   | `lib/integrations/ai/*`                   | Provider can be swapped; raw prose or invalid JSON is rejected.                    | P0       | AI-01, SET-02 |
| AI-03 | Build decision orchestration   | Snapshot inputs, call provider, hash, store, and expire.                | `lib/services/decisions.ts`, decision API | Stored decision references exact strategy, policy, portfolio, and market versions. | P0       | AI-02, TRS-02 |
| AI-04 | Prompt-injection hardening     | Separate external content from system instructions and constrain tools. | AI adapter/prompts                        | Untrusted metadata cannot request tools or alter policy.                           | P1       | AI-02         |

## 8. Risk validation engine

| ID     | Task                          | Goal                                                                                                      | Files likely affected       | Acceptance criteria                                                   | Priority | Dependencies   |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- | -------- | -------------- |
| RSK-01 | Implement pure rule runner    | Evaluate allowlist, size, concentration, reserve, turnover, cooldown, freshness, liquidity, and slippage. | `lib/policy/*`              | Each rule returns observed value, threshold, status, and explanation. | P0       | AI-01, TRS-01  |
| RSK-02 | Add decimal-safe calculations | Prevent floating-point errors in amounts and weights.                                                     | `lib/math/*`, policy tests  | Boundary and token-decimal tests pass.                                | P0       | RSK-01         |
| RSK-03 | Enforce execution gate        | Block rejected, stale, altered, or already-pending decisions.                                             | `lib/services/execution.ts` | API cannot bypass UI validation state.                                | P0       | RSK-01, EXE-01 |

## 9. Treasury dashboard

| ID     | Task                       | Goal                                                      | Files likely affected                 | Acceptance criteria                                                    | Priority | Dependencies    |
| ------ | -------------------------- | --------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- | -------- | --------------- |
| TRS-01 | Read treasury balances     | Fetch token accounts/balances at a known slot.            | `lib/integrations/solana/*`           | Results include mint, raw amount, decimals, cluster, slot, and source. | P0       | SOL-01          |
| TRS-02 | Create immutable snapshots | Store balances and valuations used by decisions.          | `lib/services/treasury.ts`, DB schema | Later refresh does not rewrite earlier decision inputs.                | P0       | TRS-01, DATA-02 |
| TRS-03 | Build treasury UI          | Show allocation, reserve, unvalued assets, and freshness. | `components/treasury/*`, agent page   | Unknown/unpriced assets are visible and do not produce false totals.   | P0       | TRS-02, DS-02   |

## 10. Solana wallet integration

| ID     | Task                      | Goal                                                              | Files likely affected          | Acceptance criteria                                              | Priority | Dependencies    |
| ------ | ------------------------- | ----------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- | -------- | --------------- |
| SOL-01 | Configure RPC/cluster     | Centralize connections, commitment, explorer mapping, and health. | `lib/integrations/solana/*`    | Every address/signature is paired with an explicit cluster.      | P0       | SET-02          |
| SOL-02 | Add wallet connection     | Connect supported browser wallets without storing keys.           | wallet provider/components     | Connect, disconnect, account change, and mobile states work.     | P0       | SET-01          |
| SOL-03 | Add wallet authentication | Verify nonce-bound wallet signature and issue secure session.     | `app/api/auth/*`, `lib/auth/*` | Replay, expired nonce, wrong domain, and wrong key are rejected. | P0       | SOL-02, DATA-02 |

## 11. ClawPump integration

| ID     | Task                       | Goal                                                                                                  | Files likely affected                 | Acceptance criteria                                                                  | Priority | Dependencies                                               |
| ------ | -------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------- |
| INT-01 | Build safe API client      | Add server-only bearer auth, timeouts, schemas, request IDs, and error mapping.                       | `lib/integrations/clawpump/client.ts` | Uses apex host; handles 401/402/403/422/5xx without leaking the key.                 | P0       | SET-02                                                     |
| INT-02 | Discover live stock pairs  | Fetch `/pump-pairs` and identify supported stock-related choices without hard-coding execution mints. | Pair API/UI                           | UI displays returned mint, decimals, and fee range with refresh time.                | P0       | INT-01                                                     |
| INT-03 | Implement launch preflight | Show cost/payment/payout/pair/fee implications before authorization.                                  | launch API and components             | Changing pair invalidates preflight; 402 becomes a review state.                     | P0       | INT-02, SOL-03                                             |
| INT-04 | Execute and record launch  | Submit one guarded launch and persist the real result.                                                | launch service, `MarketLaunch` repo   | Mint, tx hash, payout wallet, pair metadata, and request ID are verified and stored. | P0       | Owner-approved mainnet release and new safe execution code |
| INT-05 | Optional swap path         | Quote/build a policy-approved swap with ClawPump safety gates.                                        | swap adapter/execution service        | High-risk acknowledgement is never auto-set; stale quote is blocked.                 | P1       | RSK-03, INT-01                                             |

## 12. Meteora integration

| ID     | Task                               | Goal                                                                                | Files likely affected                 | Acceptance criteria                                                                                                                     | Priority | Dependencies                                      |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------- |
| MET-01 | Add official DBC SDK adapter       | Initialize client and typed config builders.                                        | `lib/integrations/meteora/*`          | Read calls work on devnet and program/cluster are explicit.                                                                             | P0       | SOL-01, SDK compatibility check                   |
| MET-02 | Design equity-like DBC config      | Define and justify curve, fee, quote, graduation, LP distribution, and authorities. | config module, `docs/INTEGRATIONS.md` | Values are shown exactly; assumptions and estimated capital are disclosed.                                                              | P0       | MET-01, organizer/sponsor constraints             |
| MET-03 | Build config/pool transaction flow | Prepare, decode, simulate, sign, confirm, and persist.                              | Meteora service/API/UI                | Server binds every signed payload to its previously prepared proposal before submission; real evidence appears only after confirmation. | P0       | MET-02, SOL-02, protocol hardening, funded wallet |
| MET-04 | Monitor pool/graduation            | Read reserves, threshold, progress, and migration status.                           | pool API/components                   | Status is sourced from chain with slot/timestamp and failure states.                                                                    | P1       | MET-03                                            |

## 13. PreStocks integration, if used

| ID     | Task                       | Goal                                                                          | Files likely affected                | Acceptance criteria                                                     | Priority             | Dependencies    |
| ------ | -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- | -------------------- | --------------- |
| PRE-01 | Verify API and terms       | Confirm response contract, allowed usage, mint fields, and eligibility rules. | research notes/adapter schema        | No implementation claim until live responses and terms are recorded.    | P1                   | Provider access |
| PRE-02 | Build catalogue adapter    | Validate/cache assets and preserve source timestamps.                         | `lib/integrations/prestocks/*`       | Ticker is never substituted for mint; stale/unavailable state is clear. | P1                   | PRE-01          |
| PRE-03 | Add eligibility disclosure | Gate applicable actions and explain economic-exposure limitations.            | disclosure components/session record | Acknowledgement is recorded and restricted users cannot proceed.        | P0 if PreStocks used | PRE-01, SOL-03  |

**PreStocks local status (2026-09-20):** Navis consumes the live catalogue read-only through a strict schema that requires `contract_address`; the UI and `GET /api/assets/prestocks` surface economic-exposure and eligibility disclosures and expose no PreStocks value-moving action. Because no PreStocks action can proceed in this build, there is no acknowledgement session record yet.

## 14. Proof timeline

| ID     | Task                      | Goal                                                                 | Files likely affected    | Acceptance criteria                                                   | Priority | Dependencies          |
| ------ | ------------------------- | -------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------- | -------- | --------------------- |
| PRF-01 | Canonicalize and hash     | Produce stable strategy, policy, decision, and receipt hashes.       | `lib/proofs/*`           | Same semantic document hashes identically; changed version does not.  | P0       | DATA-01               |
| PRF-02 | Build timeline projection | Show snapshot, proposal, checks, signature, confirmation, and delta. | proof service/components | Each event has source, timestamp, mode, and evidence link where real. | P0       | AI-03, RSK-01, EXE-02 |
| PRF-03 | Add public verifier       | Render a read-only receipt without wallet/session.                   | `app/proofs/[id]/*`      | Clean browser can verify hashes and real explorer links.              | P1       | PRF-02                |

## 15. Transaction history

| ID     | Task                            | Goal                                                                   | Files likely affected           | Acceptance criteria                                                         | Priority | Dependencies   |
| ------ | ------------------------------- | ---------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- | -------- | -------------- |
| EXE-01 | Implement attempt state machine | Make execution transitions idempotent and auditable.                   | execution service/schema        | Invalid transitions and second active attempt are rejected.                 | P0       | DATA-02        |
| EXE-02 | Confirm and reconcile           | Retrieve receipt/slot/fees and compute pre/post deltas.                | Solana/execution/proof services | Timeout becomes pending/unknown, not false failure; balances come from RPC. | P0       | SOL-01, EXE-01 |
| EXE-03 | Build history UI                | Present confirmed, failed, rejected, cancelled, and simulated records. | transaction components          | Filters work and simulation never has an explorer link.                     | P1       | EXE-02         |

## 16. Demo mode

| ID     | Task                   | Goal                                                                                      | Files likely affected      | Acceptance criteria                                                      | Priority | Dependencies      |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------ | -------- | ----------------- |
| DEM-01 | Create judge fixture   | Supply one coherent agent, snapshots, approved/rejected proposals, and simulated receipt. | `fixtures/*`               | Data is realistic, internally consistent, timestamped, and visibly demo. | P0       | DATA-03, RSK-01   |
| DEM-02 | Enforce mode isolation | Prevent demo adapters from producing real-looking signatures or mainnet state.            | env/mode guards/tests      | Automated tests prove demo output cannot be labelled devnet/mainnet.     | P0       | DEM-01            |
| DEM-03 | Add capability status  | Explain what is live, configured, unavailable, or simulated.                              | settings/status components | Judges can identify real sponsor/onchain functionality in one view.      | P0       | Integration tasks |

## 17. Testing

| ID     | Task              | Goal                                                                         | Files likely affected | Acceptance criteria                                                | Priority | Dependencies     |
| ------ | ----------------- | ---------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------ | -------- | ---------------- |
| TST-01 | Unit tests        | Cover policies, math, hashes, schemas, and state transitions.                | `tests/unit/*`        | Boundaries, decimals, stale data, and deny-by-default cases pass.  | P0       | Domain services  |
| TST-02 | Integration tests | Test routes and external adapters with recorded sanitized fixtures.          | `tests/integration/*` | Error/status mapping and idempotency behavior are verified.        | P0       | API/integrations |
| TST-03 | Judge-flow E2E    | Rehearse full demo in demo and devnet modes.                                 | `tests/e2e/*`         | Flow completes on desktop/mobile and proof opens in clean session. | P0       | Feature complete |
| TST-04 | Security review   | Check bundle secrets, transaction decode, auth replay, and prompt injection. | tests/checklist       | No P0 findings remain.                                             | P0       | Feature complete |

## 18. Deployment

| ID     | Task                         | Goal                                                               | Files likely affected       | Acceptance criteria                                              | Priority | Dependencies    |
| ------ | ---------------------------- | ------------------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------- | -------- | --------------- |
| DEP-01 | Provision preview deployment | Host app, DB, RPC, and secrets with devnet/demo defaults.          | platform config, migrations | Public URL works from clean browser; secrets remain server-only. | P0       | SET-03, DATA-02 |
| DEP-02 | Add production safety gates  | Keep mainnet off until an explicit release checklist passes.       | env/platform config         | Mainnet route returns disabled without approved flag/config.     | P0       | TST-04          |
| DEP-03 | Observability and recovery   | Add safe logs, request IDs, health, and pending-tx reconciliation. | logging/health/jobs         | Sponsor failures can be diagnosed without exposing secrets.      | P1       | Integrations    |

## 19. Submission materials

| ID     | Task                       | Goal                                                                                 | Files likely affected  | Acceptance criteria                                                                         | Priority | Dependencies       |
| ------ | -------------------------- | ------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------- | -------- | ------------------ |
| SUB-01 | Write project README       | Explain problem, demo, architecture, integrations, setup, modes, and limitations.    | `README.md`            | New reviewer can run demo and distinguish real vs simulated features.                       | P0       | Feature freeze     |
| SUB-02 | Prepare judge script/video | Tell one concise end-to-end story with proof.                                        | `docs/DEMO_SCRIPT.md`  | Pitch is at most 3 minutes, technical walkthrough at most 5, and every claim is verifiable. | P0       | TST-03             |
| SUB-03 | Capture evidence manifest  | List deployed URL, repo, video, real signatures, mints, pools/configs, and clusters. | `docs/EVIDENCE.md`     | Every address/link resolves and matches the product.                                        | P0       | Sponsor executions |
| SUB-04 | Final compliance pass      | Verify eligibility, disclosures, attributions, and deadline.                         | README/submission form | One team submission, original work stated, OSS credited, no false claims.                   | P0       | All tasks          |

## Critical path

`DOC-01 → DOC-02 → SET-01 → DATA-01/DS-01/SOL-01 → AGT-02/TRS-02/AI-03 → RSK-03 → EXE-02 → PRF-02 → INT-04 + MET-03 → TST-03/TST-04 → DEP-01 → SUB-04`

If time compresses, cut P2 work, PreStocks, scheduled automation, public strategy templates, and optional swap execution before weakening the proof chain or sponsor launch path.
