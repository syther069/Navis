# Task 2 delivery: persisted Atlas decisions and proofs

Status: delivered. Application commit `d1684dd`, follow-ups `c715042` and `055bf0b` (owner-only lists exclude public Atlas records; agent history filtered in SQL) are on
GitHub `main` and deployed on Vercel; the production check is recorded at the end.

## Reuse plan (decided before coding)

The existing persisted path (`runPersisted` in `lib/services/run-decision.ts`)
already writes a snapshot, decision, policy evaluation, terminal execution
attempt and proof receipt in one transaction, and `persistPreparedDecision`
re-checks the agent, strategy, policy and snapshot rows by id and hash. The
public Atlas run now goes through that same writer. Nothing about receipts,
hashing or assurance changes.

What the Atlas fixture lacked and how it is supplied:

- **Agent row.** The fixture agent id `demo_agent_atlas` is not a UUID and has
  no owner. Migration `0009` adds `agents.is_public_demo` with a partial unique
  index on `slug` where `is_public_demo = true`, so exactly one ownerless public
  `atlas` row can exist. The row is created idempotently on first use from the
  fixture documents (`lib/services/public-atlas.ts`); the request never
  supplies any of its content.
- **Strategy and policy rows.** The fixture documents become version 1 of the
  public agent. PreStocks-universe runs derive a new allowlist and universe per
  catalogue composition, so those documents are looked up by hash for the
  public agent and inserted as a new version only when the hash is new. The
  strategy document names the risk-policy version it was evaluated with, which
  is why the policy version is resolved first and the strategy document is
  derived from it. `persistPreparedDecision`'s hash re-check then passes and the
  receipt binds the exact evaluated documents.
- **Cluster label.** PreStocks runs are labelled `mainnet-beta` (the only
  cluster those mints exist on; receipt verification requires every context
  asset's cluster to match) while fixture runs stay on `devnet`. A demo agent
  row has one cluster column, and the schema check `agents_mode_cluster_check`
  already treats demo as cluster-agnostic, so `persistPreparedDecision` now
  enforces the cluster match for devnet and mainnet agents only. Demo mode
  never reaches execution, and the run's cluster is still recorded on the
  snapshot, the attempt and the receipt.
- **Request key.** `decisions.client_request_id` (nullable, unique per agent)
  stores the browser's request key. A retry or a concurrent twin with the same
  key gets the first stored run back.
- **Shared rate limit.** `rate_limit_windows` counts hits per hashed client
  identifier and fixed window, on top of the process-local limiter.

Order of operations for one public run: origin check, limits and validation;
request-key lookup; PreStocks catalogue read with a timeout (outside any
transaction); reference rows resolved or seeded (agent, policy version,
strategy version, all immutable mandate documents rather than run evidence);
provider evaluation (outside any transaction); one write transaction for
snapshot, decision, evaluation, status, attempt and receipt. Any failure inside
that transaction rolls the whole chain back and the API answers with an
explicit "nothing was saved" error. The in-memory map is used only when no
`DATABASE_URL` exists and such runs are labelled as not stored.

## What changed

- **Migration `0009_public_atlas_persistence`** (applied to the development
  database and to the Neon production database on 2026-09-21): `agents.is_public_demo`
  plus the partial unique index `agents_public_demo_slug_unique`;
  `decisions.client_request_id` plus the unique index
  `decisions_agent_client_request_unique`; the `rate_limit_windows` table. No
  trigger, immutability rule or existing column changed.
- **`lib/services/public-atlas.ts`**: idempotent seed of the ownerless public
  Atlas agent, version rows resolved by document hash, the request-key lookup.
- **`lib/services/run-decision.ts`**: `runPublicAtlasDecision` (request-key
  replay, PreStocks read with a 6-second timeout, one write transaction,
  `DecisionNotStoredError` on any failure; memory is used only without
  `DATABASE_URL`). `loadDecisionRun` reads public records with no session
  and owner records only for the owner; memory is never consulted when a
  database exists.
- **`lib/services/decision-records.ts`**: `listDecisions`, `listProofs` and
  `loadProof` take a reader (optional wallet) and return public Atlas records
  plus the reader's own; the owner-only wrappers remain for existing callers.
- **`app/api/decisions/run/route.ts`**: strict schema with a bounded
  `requestKey`, 2 KiB body cap (413), `maxDuration = 30`, database-backed
  shared limit (12 per client per minute, keyed by an HMAC of the address,
  `Retry-After` on 429) on top of the in-memory limiter, and failure
  responses that never carry driver text. The public path can only select the
  Atlas agent and never reaches execution code.
- **Pages**: `/decisions/[id]` and `/proofs/[id]` open public Atlas records
  without a session (still inside the route group without `loading.tsx`, so
  unknown ids are HTTP 404); `/decisions` and `/proofs` list public records
  for everyone and add owner records for a session.
- **Run panel**: Decision ID, timestamp, asset and proposed action, policy
  result (stated as policy approval only, distinct from wallet authorization
  and onchain settlement), simulation status, what the receipt proves
  (offchain integrity evidence), receipt verification, Proof ID, and Open
  Decision / View Proof / Copy Proof Link. One request key per submission is
  kept in sessionStorage until the server confirms the run
  (`components/decisions/run-request-key.ts`).
- **Smoke**: `scripts/smoke-judge-flow.mjs` now exercises the stored path when
  `/api/health` reports the database as `ok`: public record, proof id, no
  onchain claim, anonymous 200 on both pages, and a replayed request key
  returning the same record.

## Tests

`tests/public-atlas-persistence.test.ts` (real database, each test inside a
rolled-back transaction, skipped without `DATABASE_URL`): idempotent seed and
owner-scope isolation; Balanced stored as a public record, read back
anonymously with the same receipt hash and a passing verification from the
stored row; Oversized stored as rejected with a rejected attempt; PreStocks
runs against versioned documents with hash reuse; repeated request key returns
the same record and adds no row; a failing proof insert leaves no snapshot,
decision or receipt row and surfaces `DecisionNotStoredError`; owner records
invisible to anonymous and other-wallet readers while Atlas records are
visible; request input cannot alter policy or strategy; shared rate limit
blocks the fourth hit in a window and stores only a hash.
`tests/decisions-run-route.test.ts` covers the route: public record response
with the browser key and no wallet, 429 with `Retry-After`, malformed key,
unknown field and oversized body rejections, and a not-stored failure without
database detail. Existing suites were updated where the Atlas fixture used to
be refused. Totals at the application commit: 53 files, 419 tests; `npm run check`
passes (format, lint, typecheck, tests, lockfile, build, judge smoke against
the development database, migration check, submission audit).

## Production check

Verified on 2026-09-21 against https://navis-gilt.vercel.app with no wallet session, first at application commit `d1684dd` (`feat(proofs): persist Atlas decisions and verifiable receipts`, GitHub `main`, authored and committed by the owner) and again after the follow-up deployment of `c715042` (run-panel amount formatting and the stored-page screenshot step). Machine log: `docs/evidence/task2-atlas-persistence-production.json`.

| Check                                        | Result                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Balanced run, PreStocks universe, anonymous  | 200, approved, execution `simulated`, `persisted.store = database`, `visibility = public`; decision `06e530b8-f75f-4fcc-b8bb-8e7dfd32f06d`, proof `663a59af-9865-4d4b-a237-69cff03d5a49`, receipt hash `4223c1e1...cbcac9`                                                                                                                                     |
| Oversized run, PreStocks universe, anonymous | 200, rejected (max trade bps, min reserve bps), execution `rejected`, stored the same way; decision `edfaaa08-8d29-4a28-86f7-5d1873007502`, proof `d8e92904-9c98-4b97-9046-a8b80505d21c`, receipt hash `58ed53d4...e0f184`                                                                                                                                     |
| Public URLs                                  | https://navis-gilt.vercel.app/decisions/06e530b8-f75f-4fcc-b8bb-8e7dfd32f06d, https://navis-gilt.vercel.app/proofs/663a59af-9865-4d4b-a237-69cff03d5a49, https://navis-gilt.vercel.app/decisions/edfaaa08-8d29-4a28-86f7-5d1873007502, https://navis-gilt.vercel.app/proofs/d8e92904-9c98-4b97-9046-a8b80505d21c                                               |
| Fresh session and fresh instance             | All four URLs 200 from a separate cookie-less client; `GET /api/decisions/<id>` returned the same receipt hash and `receiptVerified: true` from the stored rows (no regenerated receipt)                                                                                                                                                                       |
| After a new deployment (`c715042`)           | Both decisions and both proofs still 200, same hashes, still verified                                                                                                                                                                                                                                                                                          |
| Retry with the same request key              | Second POST with the same `requestKey` returned the same decision and proof ids for both scenarios                                                                                                                                                                                                                                                             |
| Unknown ids                                  | `/decisions/<random uuid>`, `/proofs/<random uuid>`, `/decisions/not-a-uuid`, `/proofs/not-a-uuid`: HTTP 404                                                                                                                                                                                                                                                   |
| Endpoint bounds                              | Malformed request key: 400; 5 KB body: 413                                                                                                                                                                                                                                                                                                                     |
| No onchain claim                             | `transactionSignature` and `explorerUrl` null, `hashAnchoring = offchain_only`, receipt labelled offchain integrity evidence, demo simulation                                                                                                                                                                                                                  |
| Real browser (headless Chromium, no cookies) | Atlas run panel clicked on the public site: Decision ID, timestamp, asset and proposed action, policy result, simulation status, receipt verified, Proof ID, Open Decision / View Proof / Copy Proof Link (`docs/evidence/task2-agent-run-*.png`); the panel's own links opened after clearing cookies (`task2-stored-decision.png`, `task2-stored-proof.png`) |
| Migration `0009`                             | Applied to the Neon production database and the development database with `npm run db:migrate` (10 journal entries); `agents.is_public_demo` and `rate_limit_windows` confirmed present                                                                                                                                                                        |
| Gates at the application commit              | `npm run check`: format, lint, typecheck, 53 files / 419 tests, lockfile, build, judge smoke against the development database (stored path), `db:check`, submission audit                                                                                                                                                                                      |

Known limits: the shared rate limit (429 after 12 runs per client per minute) was proven by the route and database tests, not provoked on the public site, to avoid filling the public list with throwaway runs. The public site records every Atlas click, so the public decisions list grows with judge use; that is by design.
