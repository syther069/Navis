# Navis Evidence Manifest

Updated: 2026-09-21 (evening IST): public Atlas decisions and proofs are stored in PostgreSQL and publicly readable; see "Public Atlas decisions and proofs (Task 2)".

This manifest records what can be proven from the current `main` and the public deployment, and what remains externally blocked. Everything in the "Final state" section was measured on 2026-09-20 against the commit named there. Earlier baselines are listed under History at the end.

## Final state

| Item                        | Value                                                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final application commit    | `a41c10a` (GitHub `main`, pushed 2026-09-21 authored and committed by the owner); the docs-only follow-up that records the public smoke against it is the next commit on `main` (it changes only `docs/EVIDENCE.md`, `docs/SUBMISSION_READINESS.md` and `docs/evidence/*`)                               |
| Repository URL              | https://github.com/syther069/Navis                                                                                                                                                                                                                                                                       |
| Deployed URL                | https://navis-gilt.vercel.app (Vercel production, project `navis`, production branch `main`)                                                                                                                                                                                                             |
| Deployed commit before push | `6aa5f32` (Vercel READY at 16:58 UTC); it failed the current judge smoke only at the new "fresh decision reports an honest asset universe" step because the PreStocks universe work was not deployed yet                                                                                                 |
| Deployed commit after push  | `a41c10a` (Vercel production deployment READY on 2026-09-21, same commit as GitHub `main`)                                                                                                                                                                                                               |
| Public judge smoke          | Passed on 2026-09-21 from a clean session against https://navis-gilt.vercel.app: 12 page routes, PreStocks API, real 404 for unknown decision and proof ids, fresh oversized decision on the PreStocks universe. Report: `docs/evidence/final-public-smoke.json`                                         |
| Public health output        | See "Public health" below                                                                                                                                                                                                                                                                                |
| Videos                      | Not recorded (owner action; scenes are listed in `docs/SUBMISSION_DRAFT.md`)                                                                                                                                                                                                                             |
| Screenshots                 | `docs/evidence/final-agent-run-verdict.png`, `final-agent-run-receipt-hash.png`, `final-agent-run-full.png`, `final-proof-page.png`, `final-markets-launch.png`, `final-landing.png` (captured from https://navis-gilt.vercel.app at commit `a41c10a` on 2026-09-21 with `npm run evidence:screenshots`) |

## Local build evidence

All gates were run on 2026-09-20 at the final application commit.

| Gate                        | Result                                                                                                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`      | Passed                                                                                                                                                                                                                                                                |
| `npm run lint`              | Passed, zero warnings                                                                                                                                                                                                                                                 |
| `npm run typecheck`         | Passed                                                                                                                                                                                                                                                                |
| `npm test`                  | Passed: 46 files / 340 tests                                                                                                                                                                                                                                          |
| `npm run check:lockfile`    | Passed: every `package-lock.json` resolved URL is on `registry.npmjs.org`                                                                                                                                                                                             |
| `npm run build`             | Passed: production Next.js 16.3.5 build                                                                                                                                                                                                                               |
| `npm run smoke:judge`       | Passed against a local `next start` in the locked demo posture with no database: 12 page routes, PreStocks API, real 404 for unknown decision and proof ids, and a fresh oversized decision on the PreStocks universe. Report: `docs/evidence/final-local-smoke.json` |
| `npm run db:check`          | Passed (Drizzle schema matches migrations `0000` to `0009`)                                                                                                                                                                                                           |
| `npm run submission:audit`  | Passed with zero warnings                                                                                                                                                                                                                                             |
| `npm run check`             | Passed: all nine gates in sequence                                                                                                                                                                                                                                    |
| Production dependency audit | `npm audit --omit=dev`: 19 advisories (6 high, 13 moderate, 0 critical), all transitive through the Solana and Meteora chains: `docs/evidence/stocklana-v2-dependency-audit.json`. Unresolved; not a security certification                                           |

## Public URLs

| Item                | Value                                       |
| ------------------- | ------------------------------------------- |
| Deployed demo URL   | https://navis-gilt.vercel.app               |
| Repository URL      | https://github.com/syther069/Navis          |
| Demo video URL      | Not recorded                                |
| Pitch video URL     | Not recorded; official maximum is 3 minutes |
| Technical video URL | Not recorded; official maximum is 5 minutes |

## Public health

`GET https://navis-gilt.vercel.app/api/health` on 2026-09-21 at 11:07 UTC, deployed commit `7c33c43` (saved as `docs/evidence/final-public-health.json`), returned HTTP 200 with `status=ok`, `mode=demo`, `cluster=devnet` and these services: `database` ok (16 tables and 7 immutability triggers present), `authenticationOrigin` configured, `solanaRpc` configured (public devnet endpoint, read-only slot probe), `walletSessions` configured, `clawpump` not configured, `meteora` configured (SDK reads only), `prestocks` configured, `ai` configured (deterministic demo provider). No secret values are returned.

On 2026-09-21 the owner set a real `DATABASE_URL` (Neon PostgreSQL, pooled endpoint) on the Vercel project; `SESSION_SECRET` (64 random characters) and `NEXT_PUBLIC_APP_URL=https://navis-gilt.vercel.app` were set the same day and the site was redeployed so the values applied. Migrations `0000` through `0007` were applied to that database with `drizzle-kit migrate` (8 journal entries, `npm run db:check` clean); `0008` (agent request idempotency) was applied the same day once it reached `main`, so the database holds all nine. Before this, all three names existed on Vercel with empty values and health reported them as `not_configured` (the earlier output is kept in git history).

Public persistence and wallet sign-in were then exercised end to end against https://navis-gilt.vercel.app (log: `docs/evidence/final-public-persistence-flow.json`):

- Wallet sign-in: `POST /api/auth/nonce` for a fresh ed25519 keypair returned a challenge whose first line names `navis-gilt.vercel.app`; the signed challenge posted to `/api/auth/verify` returned 200 with a `navis_session` cookie; replaying the same signature returned 401; `GET /api/auth/session` returned the wallet and an 8-hour expiry; a nonce request from a foreign origin returned 403. The keypair was created in a script and signed with tweetnacl, so this proves the server side of the flow, not a browser wallet extension.
- Agent creation: `POST /api/agents` returned 201 with slug `judge-verify-agent-5b0a886e`; `GET /api/agents` listed it for that wallet only.
- Persisted run: `POST /api/decisions/run` for that agent (Balanced) returned 200 with `persisted.store = "database"`, decision `bd50e402-9517-4ed2-a3f7-4de23f619876`, proof `4c262113-93bd-41f0-8967-83e72e921110`, all 12 checks passed, receipt verified.
- Real browser: in headless Chromium holding that session cookie, `/agents` listed the new agent (`docs/evidence/final-agents-list-signed-in.png`), the decision link on the agent page was clicked and `/decisions/bd50e402-...` rendered from the database with the `database` badge and the text "Stored for the connected wallet; the detail page reloads it from the database" (`docs/evidence/final-persisted-decision.png`); the proof page opened from it. Without the cookie the same decision and proof URLs return HTTP 404.

## Demo evidence

### Fresh decision evidence

`POST /api/decisions/run` creates a fresh proposal, runs the deterministic policy engine, and returns every check, the execution eligibility, and a receipt that the browser verifies locally with the same code as `/proofs/<id>`. Three paths exist:

- **Atlas (public demo).** No wallet or database is needed. The default asset universe is the live PreStocks catalogue (allowlist from the validated `contract_address` values, token price as the research price, freshness from the read time, liquidity left unavailable so the rule warns instead of inventing a figure). Balanced is approved with 10 of 11 checks passed and 1 warned; Oversized is rejected on max trade bps and min reserve bps. With a database (the public site) every run is stored as a public record with stable `/decisions/<id>` and `/proofs/<id>` links that need no wallet; without one the run is kept in bounded process memory only, the panel says so, and no detail link is offered.
- **Owner-created agents in demo mode.** With `DATABASE_URL`, `SESSION_SECRET` and a wallet session, a run is persisted in one transaction: portfolio snapshot, decision, policy evaluation, execution attempt (simulated) and proof receipt. The decision and proof pages are owner-scoped; unknown ids return a real HTTP 404. Exercised on the public site on 2026-09-21 (see "Public health").
- **Owner-created agents in devnet or mainnet mode.** Refused with HTTP 409, because a persisted snapshot does not hold every market fact an honest evaluation needs and Navis will not invent them.

No path executes onchain.

| Item                | Value                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing route       | `/` (one-sentence pitch, three proof points, mode and cluster banner, assurance model, entry links)                                                                                                                                                   |
| Agent list          | `/agents` (Atlas plus the signed-in owner's agents when a database is configured)                                                                                                                                                                     |
| Demo agent          | Atlas at `/agents/atlas`, with the **Run new decision** panel                                                                                                                                                                                         |
| Demo decision route | `/agents/atlas/decisions/demo-decision`                                                                                                                                                                                                               |
| Demo proof route    | `/proofs/demo-proof`                                                                                                                                                                                                                                  |
| Disclosure route    | `/disclosures`                                                                                                                                                                                                                                        |
| Assurance labels    | Every receipt, decision detail, run result and ledger row carries an assurance badge: offchain integrity, wallet authorization or onchain settlement, plus demo simulation or live. The public demo never leaves offchain integrity / demo simulation |
| Receipt type        | Deterministic simulation; no onchain signature                                                                                                                                                                                                        |
| Hash anchoring      | Offchain-only decision hash; no memo instruction or transaction signature                                                                                                                                                                             |
| Devnet slot probe   | `GET /api/solana/slot` live on production (`SOLANA_RPC_URL` = public devnet endpoint); the Atlas intro shows "DEVNET RPC live read: slot N" (`docs/evidence/v2-devnet-slot-live.png`). Read only; no transaction                                      |

## Sponsor evidence

### ClawPump

| Item                                | Value                                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API adapter                         | Implemented under `lib/integrations/clawpump/*`                                                                                                                                                                               |
| Local support                       | Provider verification record, owner agent link (create or attach), annotated stock-pair discovery, launch preflight with prerequisites (`/api/integrations/clawpump/launch/preflight`). See `docs/TASK3_CLAWPUMP_DELIVERY.md` |
| Live launch mint                    | Not available                                                                                                                                                                                                                 |
| Live launch transaction             | Not available                                                                                                                                                                                                                 |
| Provider request ID for live launch | Not available                                                                                                                                                                                                                 |
| Public site                         | `CLAWPUMP_API_KEY` not configured; Markets Launch shows the explicit "Not configured" state                                                                                                                                   |
| Blocker                             | Preflight only. The official self-funded launch has no devnet selector; safe owner-approved mainnet execution code does not exist. The ClawPump track requires a real stock-paired launch, so it is not recommended           |

### Meteora DBC

| Item                   | Value                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK                    | `@meteora-ag/dynamic-bonding-curve-sdk` (resolves `1.5.12`)                                                                                                                                                                                                                                                                                                    |
| Program                | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`                                                                                                                                                                                                                                                                                                                  |
| Quote profiles         | Server allowlist: `navis-equity-v1` (wrapped SOL, devnet and mainnet) and `navis-stock-exposure-v1` (PreStocks catalogue mint, mainnet only, gated on a Meteora DBC token badge that no live PreStocks mint has as of 2026-09-20; unavailable on devnet, no substitute mint). Clients send a profile id, never a mint. Both are shown on `/markets/launch`     |
| Quote verification     | PreStocks quote mints are read from the live catalogue and checked onchain (token program, 9 decimals, Token-2022 extensions, Meteora token badge) at prepare time; pool preparation re-reads the onchain config and refuses a quote mint mismatch                                                                                                             |
| Intent binding         | Submit routes accept only a server-prepared intent ID plus signed bytes; owner, cluster, expiry, message hash and simulation are checked; the signature is derived from the signed bytes and the launch persisted as `submitting` before any send; confirm labels `protocol_verified`, `signature_confirmed` or `evidence_incomplete` from the decoded account |
| Config transaction     | Builder implemented; no signature on any cluster                                                                                                                                                                                                                                                                                                               |
| Pool transaction       | Builder implemented; no signature on any cluster                                                                                                                                                                                                                                                                                                               |
| Pool address/base mint | Not available                                                                                                                                                                                                                                                                                                                                                  |
| Devnet rehearsal       | Not run by the owner as of this manifest; if it is run later, record the signatures here and in `docs/INTEGRATIONS.md`                                                                                                                                                                                                                                         |
| Blocker                | Broadcast is hard-blocked in every mode (submit routes return 503 before any send) pending a review on a real cluster; migrations `0006` (execution intents) and `0007` (submitting status) are applied to both the development and the public site's database; all live flags remain false                                                                    |

### PreStocks

| Item             | Value                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API URL          | `https://prestocks.com/api/prestocks`                                                                                                                                                                                                                                                                                                                                           |
| Navis API route  | `/api/assets/prestocks`                                                                                                                                                                                                                                                                                                                                                         |
| Adapter          | `lib/integrations/prestocks/client.ts`, `research.ts`, `allocation.ts`, `lib/decisions/universe.ts`                                                                                                                                                                                                                                                                             |
| Live universe    | The Atlas demo run defaults to the live PreStocks catalogue: allowlist from the validated `contract_address` values, freshness from the read time, token price as the research price, no liquidity or quote invented. Receipt `dataSource.universe=prestocks`; the run is labelled `mainnet-beta` because that is where the mints live. Verified locally and by the judge smoke |
| Research view    | `/markets/launch` and each run result show premium or discount to mark, mark vs implied valuation gap, supply, allocation concentration, read time and source URL; labelled research data, not execution quotes                                                                                                                                                                 |
| Allocation maths | Proposal amount, token price, trade value and post-trade positions reconcile exactly; proposals exceeding the holding are refused. Covered by `tests/prestocks-universe.test.ts`                                                                                                                                                                                                |
| Fallback         | Catalogue unreachable or invalid: fixture universe with a visible note; the route tests run offline and assert the fallback                                                                                                                                                                                                                                                     |
| Execution path   | None. PreStocks tokens are described as economic exposure, not shares                                                                                                                                                                                                                                                                                                           |

## Compliance notes

- Demo and live modes are labelled separately, and every receipt carries an assurance level.
- PreStocks are described as economic exposure, not shares.
- No secret values are documented here.
- No external live address is claimed without a corresponding signature/address row.
- Deployment steps are in `docs/DEPLOYMENT_RUNBOOK.md`; copy-ready submission language is in `docs/SUBMISSION_DRAFT.md`; open-source and sponsor credits are in `docs/ATTRIBUTIONS.md`.
- Sponsor tracks are optional and judged by the sponsors. Recommended: Main, PreStocks, Meteora DBC. Not ClawPump (no launch), not Pyth (not used).
- No funded-wallet action, live launch, video, or final submission is claimed.

## Database evidence

| Item                 | Verified value                                                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development database | Migrations `0000` through `0009` applied with journal SHA tracking (verified by the real-database test suite); logical backup taken before `0006`                                                                                                                                   |
| Production database  | Neon PostgreSQL attached to the public Vercel demo on 2026-09-21 with migrations `0000` through `0009` applied (`0009` on 2026-09-21 via `npm run db:migrate`); wallet sign-in, agent creation and a persisted demo run with a working detail link verified there ("Public health") |
| Immutability         | Evidence rows are append-only; database tests run inside rolled-back transactions                                                                                                                                                                                                   |
| Deployment lookup    | Navis is deployed on Vercel; it is not published through Replit                                                                                                                                                                                                                     |

### Public idempotent creation check (deployed commit `f1d078e`)

Run on 2026-09-21 at 11:29 UTC against `https://navis-gilt.vercel.app`, whose production deployment at that time was commit `f1d078e` (Vercel deployment list; `f1d078e` differs from `49d0f7e` only in a test file). A fresh ed25519 keypair signed the server challenge and posted it from the site origin; the session cookie was then used for the agent requests. Recorded in `docs/evidence/final-public-idempotency.json`:

| Step                                            | Result                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /api/agents` with a new `clientRequestId` | 201, `replayed: false`, slug `replay-check-cb43d435-673cddef`                  |
| Same request again (retry)                      | 200, `replayed: true`, same slug                                               |
| Same key, changed name                          | 409 `duplicate_request`; body contains no SQL, host, provider or wallet text   |
| `GET /api/agents` in a fresh request            | exactly one matching agent                                                     |
| `GET /api/agents/<slug>` without the session    | 401 (ownership isolation)                                                      |
| `GET /api/health`                               | `database.status = ok`, tables and guards ready, `walletSessions = configured` |

A real wallet extension and signing remain unverified (the public sign-in check used a scripted keypair). See `docs/STOCKLANA_JUDGE_AUDIT_V2.md` for the round 2 audit and its evidence list.

### Browser reload mid-save check (deployed commit `047e989`)

The check above exercised the API directly. This one drives the real create-agent form in headless Chromium (`npm run check:browser-replay`, `scripts/browser-replay-check.mjs`, DevTools protocol, no Playwright) so the browser's own localStorage record, the session cookie and the live route are all involved. Run on 2026-09-21 at 14:28 UTC against `https://navis-gilt.vercel.app`, production deployment `047e989`. Sign-in again used a scripted ed25519 keypair whose session cookie was placed in the browser's cookie jar; everything after that was clicks in the page. Recorded in `docs/evidence/browser-replay-check.json`, screenshots `docs/evidence/browser-replay-restore-offer.png` and `browser-replay-agent-page.png`:

| Step                                                           | Result                                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Open `/agents/new` with the session cookie                     | Header reports "Wallet-authenticated draft"                                                                                |
| Fill a unique mandate, press "Review mandate"                  | `localStorage` holds a pending record with a request key scoped to the signed-in wallet                                    |
| Press "Create agent"; response held at the network layer       | `POST /api/agents` reached the server and answered 201; the browser showed "Saving…" and never received the answer         |
| Reload the page while the save was pending                     | Form shows "An earlier save of browser-replay-e5c4d8 was not confirmed" with a "Restore that mandate" button               |
| "Restore that mandate", "Review mandate", "Create agent" again | Second `POST /api/agents` carried the same `clientRequestId`; 200, `replayed: true`, slug `browser-replay-e5c4d8-07507669` |
| After the answer                                               | Browser navigated to `/agents/browser-replay-e5c4d8-07507669`; the pending record was removed from `localStorage`          |
| `GET /api/agents` in a fresh request with the same session     | exactly one agent with that name, same slug                                                                                |

The held first response is the worst case for duplication: the server had already committed the agent when the page reloaded. A blocked or failed first request is a weaker case of the same path (no agent yet, same key on the retry) and is covered by the unit tests in `tests/agent-request-key.test.ts`.

### Browser closed mid-save and wallet signed in again (deployed commit `da70260`)

The same script now runs three scenarios, each with its own throwaway keypair and agent name (`--scenarios=reload,restart,resignin`, `--user-data-dir=DIR` to keep the Chromium profile on disk between processes). Run on 2026-09-21 at 15:10 UTC against `https://navis-gilt.vercel.app`, production deployment `da70260`; all three passed. Recorded in `docs/evidence/browser-replay-check.json` (one `scenarios` entry each), screenshots `docs/evidence/browser-replay-restart-restore-offer.png`, `browser-replay-other-wallet-no-offer.png` and `browser-replay-resignin-restore-offer.png`:

| Scenario   | What was done after the held first save                                                                                                                                                                                               | Result                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reload`   | Page reloaded in the same process (the check above, repeated)                                                                                                                                                                         | Restore offer shown; retry replayed `browser-replay-reload-6e0b4d-e98332dc` with the same `clientRequestId`; one agent listed                                                                                                                                                                                                                                                                     |
| `restart`  | Whole Chromium process closed (pid 3189) while "Saving…" was on screen; a new process (pid 3319) started on the same profile directory; the same session cookie put back (session cookies do not survive a restart)                   | `/agents/new` showed "An earlier save of browser-replay-restart-34c1ab was not confirmed" with "Restore that mandate"; the pending record was read back from the profile's localStorage; retry answered 200 `replayed: true`, slug `browser-replay-restart-34c1ab-8993d5e0`; record cleared; `GET /api/agents` listed exactly one agent                                                           |
| `resignin` | Browser closed (pid 3426) and restarted (pid 3554) on the same profile. First a different keypair signed in and opened `/agents/new`; then the original keypair signed in again with a fresh nonce and a fresh `navis_session` cookie | Other wallet (`CB18oEPg…`) saw no notice and no "Restore that mandate" button while the record for `BpxNaov5…` stayed in localStorage untouched. After the second sign-in (cookie value changed) the offer came back for the original wallet; retry answered 200 `replayed: true`, slug `browser-replay-resignin-9b0b2a-13b6bf40`; record cleared; exactly one agent listed under the new session |

Two details matter for reading the script. The browser is closed through the DevTools `Browser.close` command, which is what a user quitting the browser does and lets Chromium flush localStorage to disk; a plain `SIGKILL` loses a write made a moment earlier, so it is only the fallback. The page session stays attached until the process is gone, because detaching it first would release the held response, the page would learn about the save and clear the record, which is not the case being tested.

### Public Atlas decisions and proofs (Task 2)

Every Atlas run on the public site is now stored in PostgreSQL as a public record (portfolio snapshot, decision, policy evaluation, simulated or rejected execution attempt and proof receipt, written in one transaction) and readable at `/decisions/<id>` and `/proofs/<id>` with no wallet session. Private owner records still need the owner's session and are otherwise a real 404. Details, design and test list: `docs/TASK2_ATLAS_PERSISTENCE_DELIVERY.md`.

Verified on the public site on 2026-09-21 without a session, at application commit `d1684dd` and again after the deployment of `c715042` (log: `docs/evidence/task2-atlas-persistence-production.json`; screenshots `docs/evidence/task2-*.png`):

| Item                           | Value                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Balanced (approved, simulated) | https://navis-gilt.vercel.app/decisions/06e530b8-f75f-4fcc-b8bb-8e7dfd32f06d and https://navis-gilt.vercel.app/proofs/663a59af-9865-4d4b-a237-69cff03d5a49; receipt hash `4223c1e1...cbcac9`         |
| Oversized (rejected)           | https://navis-gilt.vercel.app/decisions/edfaaa08-8d29-4a28-86f7-5d1873007502 and https://navis-gilt.vercel.app/proofs/d8e92904-9c98-4b97-9046-a8b80505d21c; receipt hash `58ed53d4...e0f184`         |
| Fresh session, after redeploy  | All four URLs 200 with the same stored receipt hash and a passing verification; unknown ids 404 on both routes; same request key replays the same record; 400 on a malformed key, 413 on a 5 KB body |
| Assurance                      | Offchain integrity evidence, demo simulation; no signature, no explorer link, `hashAnchoring = offchain_only`                                                                                        |
| Migration `0009`               | Applied to the development and the Neon production database                                                                                                                                          |

## History

- Baseline, 2026-09-20 morning, commit `ac26e54`: 24 files / 113 tests; first Vercel publish; Chromium QA of the deterministic journey (`docs/evidence/stocklana-browser-audit.json`).
- Remediation pass, same day: 26 files / 143 tests; local smoke in `docs/evidence/stocklana-local-smoke.json`.
- Hardening push, commit `a335681`: fresh decision flow, Meteora intent binding, persist-before-broadcast, same-origin fix; public smoke `docs/evidence/stocklana-v2-public-smoke.json`; real Chromium walk at 1440/375 px with no console errors.
- Commit `085e779` and `8d2b5db`: lockfile registry fix, Atlas intro, live devnet slot probe.
- Commit `c319e92` to `6aa5f32`: CI pipeline, `/agents` list and persisted runs for created agents, adversarial test sweep, landing screen, assurance badges, MIT licence, real 404s for unknown decisions and proofs.
- Final application commit: PreStocks verified asset universe with research view and proposal-consistent allocation; this manifest.
