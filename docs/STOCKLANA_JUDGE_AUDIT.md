# Navis: independent Stocklana judge audit

Audit date: 2026-09-20. This is the **pre-remediation** assessment. No source, accounts, production settings, funds, signatures, deployments, or submissions were changed during evidence collection. Recommendations and subsequent changes are recorded separately in `REMEDIATION_REPORT.md`.

## 1. Executive verdict

Navis is a credible, working **simulation-first governed-agent demonstrator**, not a verified live tokenized-equity execution product. Its strongest feature is the understandable separation between proposal, deterministic policy, wallet authority, and evidence. Its largest functional gap is that the judge follows a recorded proposal rather than generating a fresh one.

**Analytical score: 72/100. Confidence: medium. Ranking estimate: plausible, not finalist-level.** This is an independent framework, not an official Stocklana weighting or a comparison against inspected competing entries.

Fresh evidence supersedes earlier conversation and documentation: GitHub `main` contains `ac26e54089154c872f117a54cc73af2a8fc6ff2b`, and Vercel reports that commit as its ready production deployment. The public URL is https://navis-gilt.vercel.app. Its unauthenticated demo passes the judge-flow smoke test. Production wallet sessions, database, trusted authentication origin, RPC, ClawPump, and Meteora are not configured.

## 2. Eligibility verdict

**Potentially eligible, pending submission requirements.** Registration, original-work/team declarations, and completion of the authenticated submission form cannot be verified from the public repository.

The official Stocklana page was retrieved on the audit date and confirms:

- Deadline: **Friday, September 25, 2026, 4:00 p.m. ET**, equivalent to September 26 at 1:30 a.m. IST.
- Individuals and teams; one submission per team; original work; disclose open-source components.
- Register before submission; provide at least one supporting link; edits remain possible before closing.
- The general rules confirm no late submissions, up to three sponsor tracks, main-track review of all submissions, and sponsor review of selected tracks.
- Pitch and technical videos are optional supporting materials, limited to three and five minutes respectively. Their absence is a presentation gap, **not independently a formal disqualification**.
- The submission page requires sign-in, so private form requirements and registration remain unverified.

Sources: [Stocklana](https://hackathons.solana.com/hackathons/stocklana), [How it works](https://hackathons.solana.com/how-it-works), [submission form](https://hackathons.solana.com/hackathons/stocklana/submit).

The event-specific “one week” description takes precedence over the general platform's “14 days” description. None of the formal rules inspected requires a live funded transaction for the main track.

## 3. Current project understanding

- Canonical root Next.js App Router, TypeScript, React, npm and `package-lock.json`; not the previous generated scaffold.
- Root `app/` routes, server components, client wallet/forms, thin API handlers, domain/service/integration layers.
- PostgreSQL through Drizzle for persistent ownership, immutable versions/evidence, nonces, sessions and execution state. Fixtures support the credential-free demo.
- Six migration files, `0000` through `0005`, including immutability triggers. The development health endpoint reports tables and all required guards ready. No production migration was run.
- `.migration-backup` is an older Navis copy; `.restoration` retains recovery material. Neither is active application source.
- Replit's artifact descriptor routes to root npm commands on port 19732, binds `0.0.0.0`, and defines server-backed production build/start and health. Replit itself is not published.
- Vercel is linked to GitHub `main`; its production deployment is the prepared canonical commit, not a Replit preview.
- Local branch `main` has local checkpoint history divergent from `origin/main` (five ahead, one behind at collection). Only the two new instruction uploads were initially untracked. No Git operation changed history during this audit.
- Development: demo mode, devnet cluster, all execution/release flags false, demo AI, database/session available, no RPC/ClawPump/OpenAI credential.
- Production: healthy **demo**, not transaction-ready. Database, wallet sessions, authentication origin, RPC, ClawPump and Meteora all report `not_configured`.

## 4. What is genuinely working

“Verified” below names the verification boundary; unit tests do not substitute for wallet or chain execution.

| Feature                                 | Classification and evidence                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Dark Proof Terminal UI                  | Verified in a real Chromium browser at desktop, tablet and 375px                              |
| Atlas public mandate and asset universe | Verified public fixture journey and rendered constraints                                      |
| Strategy and risk-policy versions       | Implemented, schema/unit-tested; displayed with recorded evidence                             |
| Treasury snapshot                       | Verified demo-only; unpriced balances visibly unknown                                         |
| Structured AI proposal                  | Recorded demo verified; provider adapter implemented, fresh user-triggered generation missing |
| Deterministic policy and explanations   | Verified unit tests and proposal/constraint UI                                                |
| Execution gate                          | Implemented/unit-tested; current deployment deliberately does not execute                     |
| Wallet connection                       | UI implemented; real extension connection/signing unverified                                  |
| Nonce wallet authentication             | Implemented/unit-tested; production unavailable without origin/session/database setup         |
| Trusted-origin mutations                | Implemented/unit-tested; no live authenticated mutation attempted                             |
| Demo/devnet/mainnet separation          | Verified safe current configuration; non-demo paths remain release-gated                      |
| Proof generation and hash verification  | Verified demo; context-linkage gap noted in section 11                                        |
| Offchain-only hash anchoring            | Verified correctly labelled; no transaction signature or explorer link                        |
| Transaction ledger                      | Implemented, rendered; live transaction lifecycle unverified                                  |
| PostgreSQL/Drizzle                      | Development health and schema check verified; production not configured                       |
| ClawPump agent linkage                  | Adapter implemented; credential-backed operation unverified                                   |
| ClawPump live pairs                     | Adapter implemented; not configured on audited production                                     |
| ClawPump preflight                      | Implemented/unit-tested; not a launch                                                         |
| Meteora DBC configuration preview       | SDK-backed implementation/unit tests; no live deployment evidence                             |
| Meteora transaction preparation         | Gated implementation; real RPC/wallet operation unverified                                    |
| Meteora simulation/monitoring           | Implemented routes/services; actual transaction evidence absent                               |
| PreStocks catalogue                     | Live read-only route verified in smoke/browser; upstream response schema tested               |
| PreStocks schema validation             | Implemented/unit-tested; no ticker-to-contract substitution                                   |
| Risk/eligibility disclosures            | Verified public page and smoke assertions                                                     |
| Health/readiness                        | Verified local and public responses; no credential values returned                            |
| Settings/capabilities                   | Verified public page; unavailable services explicitly identified                              |
| Submission audit                        | Freshly passed with 16 honest TODO markers warned about                                       |
| Judge-flow smoke                        | Fresh local and public passes: ten HTML routes and the PreStocks API, plus health readiness   |

Fresh `npm run check` passed all eight gates: formatting, lint, strict TypeScript, **113 tests in 24 files**, production build, judge smoke, Drizzle validation and submission audit. No dependency changes were made during the audit.

## 5. What is simulated or demo-only

Atlas assets, balances, decision, policy context and receipt are deterministic fixtures, not a claim to hold or trade actual stock tokens. The simulated receipt has no signature, no explorer link, and `offchain_only` anchoring.

The proposal demonstrates structured output and deterministic validation, but is not evidence that a judge can request a new model decision. Meteora configuration preview and ClawPump preflight are not funded execution. A checksum proves consistency of supplied data, not independent truth, authorship or chain settlement.

## 6. What is externally blocked

- Registration and final authenticated submission: owner action and declarations.
- Production persistence and wallet authentication: approved database/session/origin configuration and real-wallet verification.
- Live RPC and chain evidence: correct RPC, separately reviewed execution readiness, wallet approval and funding where applicable.
- ClawPump: credential-backed discovery/preflight and explicit owner-authorized paid launch; no safe launch evidence supplied.
- Meteora: exact prepared/simulated/signed transaction binding, race-safe pool lifecycle and reviewed broadcast recovery, followed by explicit owner approval and actual chain verification.
- Pitch/technical videos: recording and publication by the owner; optional formally, useful competitively.
- The token pasted in the earlier conversation must be revoked by its owner. This audit did not use, reproduce, store or test that token, and cannot attest to revocation.

Fresh proposal generation and the transaction-safety backlog are **internal implementation gaps**, not merely missing credentials.

## 7. Main-track score

| Category                                 | Score      | Evidence and strengths                                                    | Weakness / judge concern                                                   | Improvement required                                                                          |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Real user and problem                    | 16/20      | Bounded equity-agent mandate and risk-policy accountability               | Target customer and recurring workflow need sharper validation             | Explain the small portfolio operator's specific decision-review job                           |
| End-to-end working product               | 17/25      | Public Atlas to policy to receipt journey works                           | Recorded proposal only; production cannot persist or authenticate          | Fresh governed proposal flow, then verified persistence/auth                                  |
| Solana necessity and correctness         | 9/15       | Wallet authority, RPC adapters, explicit cluster and transaction concepts | Current useful proof is offchain; generic database could support this demo | Show why composable tokenized stocks and wallet settlement matter, without inventing evidence |
| Product quality and UX                   | 13/15      | Responsive dark UI, real links, review boundary, visible unknowns         | Dense technical proof; freshness and verification scope need clarity       | Explain what receipt checks do and do not establish                                           |
| Safety, transparency, evidence integrity | 10/15      | Honest simulations, origin/nonce protections, immutable DB events         | Receipt linkage and latent live-path issues; vulnerable dependencies       | Harden local checks and maintain non-bypassable broadcast block until reviewed                |
| Originality and continuation             | 7/10       | Coherent governed-agent wedge rather than generic price dashboard         | No demonstrated users or fresh/live repeatable loop                        | Validate the wedge and finish one repeatable governed workflow                                |
| **Total**                                | **72/100** | **Plausible**                                                             | **Medium confidence**                                                      | **Not a prediction of placement**                                                             |

Three highest-impact improvements: close receipt/live-path integrity gaps without enabling execution; make the fresh governed decision workflow real; verify production persistence/authentication and complete the submission declarations/materials.

Judge summary: **A credible and transparent governed-equity-agent demo whose proof story is stronger than its currently demonstrated execution capability.**

## 8. Sponsor-bounty scorecards

These are evidence assessments, not official numerical sponsor weights.

| Sponsor   | Official requirement / focus                                                                            | Observed implementation                                                                                                                            | Verdict                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ClawPump  | Launch a token with a stock-paired liquidity pool using ClawPump and Meteora                            | Agent adapter, pair discovery and human-bound preflight; no paid launch, request ID, mint, payout, paired pool or confirmed signature              | **Technically prepared in part, but not bounty-qualified**                                            |
| Meteora   | Original DBC configuration/use case, soundness, continued utility; working mainnet stronger than slides | Official SDK 1.5.12, curve/fee/quote/graduation/migration/LP configuration and guarded transaction paths; no verified signed configuration or pool | **Configuration builder with unverified transaction paths**, not demonstrated working devnet/mainnet  |
| PreStocks | Useful product using PreStocks; non-PreStocks pre-IPO integrations disqualify                           | Real read-only API/catalogue with address schema and disclosures; no competing pre-IPO provider found; weak connection to agent decisions          | **Likely scope-compatible but technically weak/read-only**; actual judging remains sponsor's decision |
| Pyth      | Live financial data must perform meaningful product work                                                | No active implementation or claimed feed                                                                                                           | **Not applicable: absent**, not a defect                                                              |

The PreStocks API fetch time is not proof of underlying quote freshness. ClawPump quote mint/pair costs and payout require actual provider evidence. Meteora UI configuration fields do not prove the onchain program, authorities, LP distribution, migration state, mint or pool exist.

## 9. End-to-end browser findings

A fresh unauthenticated Chromium session tested the public Vercel app. Navigation used actual links from Atlas to the recorded decision to the public verifier. No application JavaScript exceptions were observed.

| Route                                   | Result                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/agents/atlas`                         | Mandate, allowed universe, constraint ledger and explicitly demo treasury visible                |
| `/agents/new`                           | Valid mandate reviewed locally; Create agent disabled without authentication; no write performed |
| `/decisions`                            | Recorded simulated proposal visible                                                              |
| `/agents/atlas/decisions/demo-decision` | Structured proposal, policy checks, explicit simulation and verifier link                        |
| `/proofs`                               | Demo receipt indexed                                                                             |
| `/proofs/demo-proof`                    | Published hashes match, signature None, offchain only, no Solana transaction link                |
| `/markets/launch`                       | ClawPump/Meteora/PreStocks surfaces render; no live launch was attempted                         |
| `/transactions`                         | Explicit simulation ledger                                                                       |
| `/settings`                             | Capabilities and blockers visible                                                                |
| `/disclosures`                          | Risk, exposure, eligibility and private-key boundaries visible                                   |
| `/api/health`                           | HTTP 200, demo/devnet; unavailable production services truthfully listed                         |
| `/api/assets/prestocks`                 | Read-only contract and disabled value movement passed smoke                                      |

No broken critical-journey link, route rendering failure or unlabelled input was found. Persistent create/edit/delete, wallet extension signing, chain polling, recovery under network failure, and every possible loading/empty/error state were **not** browser-verified.

## 10. Architecture and code findings

- Root app and npm lockfile are canonical. Recovery copies are not evidence of features present in the active app.
- Fresh proposal generation described in the PRD remains absent from the active judge journey.
- Database immutability is actually implemented: `0005_execution_events.sql:15-21` protects execution events and policy evaluations. An initial static suspicion about missing triggers was rejected after migration inspection.
- Package metadata uses `latest` in several direct dependencies. `npm ci` remains reproducible through the committed lockfile; unlocked installs or regeneration can change tested versions.
- No project `LICENSE` file was found despite the PRD's release checklist. Dependency attribution exists. Selecting a project license is an owner/legal decision, not an automatic code fix.
- The PRD's anza wallet-adapter statement is terminology about upstream ownership; installed package names remain `@solana/wallet-adapter-*`. Documentation should not imply a package rename or completed migration.

## 11. Security findings

Severity reflects impact **if the stated preconditions hold**. There was no finding of a remotely exploitable critical issue in the current credential-free demo.

| ID / severity               | File and baseline lines                                                                                         | Impact / failure scenario                                                                                                                                                                                             | Recommended remediation                                                                                                    | Eligibility impact                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| S1 High, latent live path   | `app/api/integrations/meteora/config/confirm/route.ts:170-190`                                                  | Confirmed signature status plus null/incomplete transaction evidence can be persisted as complete confirmation; transaction metadata error is not independently checked; local time substitutes for absent block time | Require complete successful transaction evidence, reconcile contradictions conservatively and preserve unknown state       | Safety/quality, not automatic formal disqualification                           |
| S2 High, latent live path   | `app/api/integrations/meteora/pool/submit/route.ts:12-18,111-153`; `lib/integrations/meteora/client.ts:401-432` | Authenticated, signed requests can supply unrelated pool/mint metadata; the message hash is also supplied by the caller rather than persisted server-approved preparation                                             | Keep broadcasting hard-disabled until server-persisted preparation/simulation and semantic account binding are implemented | Live release and sponsor evidence blocker                                       |
| S3 High, latent live path   | `app/api/integrations/meteora/pool/submit/route.ts:111-153`                                                     | Concurrent owner requests can both broadcast before either writes pool evidence                                                                                                                                       | Hard-disable pending operation-key/CAS locking, append-only attempts and timeout recovery                                  | Live release blocker                                                            |
| S4 Medium                   | `lib/proofs/receipt.ts:162-192`                                                                                 | Rehashing a document with mismatched context/reference hashes can pass independent component-hash checks; a nonempty signature/link is not RPC verification                                                           | Verify context/document/mode/cluster/policy relationships and explain checksum versus chain attestation                    | Evidence quality                                                                |
| S5 Medium, latent live path | `lib/policy/runner.ts:207-250`                                                                                  | Missing liquidity generates only warning, and warnings still approve; future executor may not recheck                                                                                                                 | Fail closed for live modes; preserve explicitly disclosed demo warning                                                     | Live execution correctness                                                      |
| S6 Medium, release risk     | `package-lock.json`; fresh npm audit                                                                            | 19 affected production package entries: 6 high, 13 moderate; bigint-buffer, toml and transitive RPC/UUID packages                                                                                                     | Review reachable exposure and compatible upstream fixes; do not force broad chain-SDK upgrades                             | Quality/safety, not formal disqualification                                     |
| S7 Low                      | `lib/auth/server.ts:181-203`                                                                                    | Signed session payload checks a string rather than the wallet schema                                                                                                                                                  | Validate wallet syntax and JWT subject/user binding                                                                        | Defense in depth; requires trusted signing path compromise or programming error |
| S8 Informational            | `lib/proofs/receipt.ts:49-55,175-183`                                                                           | Current receipt schema cannot express submitted unknown state or preserve a failed chain signature                                                                                                                    | Extend versioned receipt/state design when live workflow is implemented, not by relabelling as confirmed                   | Future completeness                                                             |

Positive controls: nonce randomness and expiry, signed domain/URI/cluster binding, atomic replay consumption, pinned JWT algorithm/issuer/audience, HttpOnly/SameSite sessions, exact mutation origins, schema-bound model output, deterministic fixed-point policy, stale/rejected/altered decision checks, execution idempotency, immutable evidence triggers, explicit unknown balances and multiple mainnet configuration gates. These controls are inspected/tested, not a proof that all attacks are impossible.

Session-secret existence was checked without reading its value. The code enforces minimum length; entropy cannot be certified from existence. No secret was requested or reproduced. A missing Origin correctly fails closed and is not itself a security defect.

Fresh scanners: SAST completed with zero findings; privacy/dataflow scan completed with zero findings; dependency scanner reported six advisory findings (four high, two moderate, including development scope). `npm audit --omit=dev` reported 19 affected package entries. These tools count different scopes and units; their totals must not be combined or treated as comprehensive proof of safety.

## 12. Solana/onchain findings

Real Solana libraries, wallet adapters, RPC methods and Meteora builders exist. Active mode is demo with devnet selected, but no production RPC is configured. No funded transaction, signer/payer validation against a real wallet, simulation-to-submission binding, signature confirmation, real treasury balance or live token account was established during this audit.

The demo truthfully has no chain anchoring. Solana is necessary to the intended wallet-controlled composable tokenized-equity workflow, but not technically necessary for the already demonstrated offchain checksum/fixture workflow. That distinction costs competitiveness points without making the demo dishonest.

No mainnet flags were enabled. No transaction was prepared with a real wallet, signed, funded, broadcast or submitted.

## 13. Evidence and submission findings

Verified current evidence: GitHub prepared commit, Vercel ready commit, public HTTPS origin, public health and smoke, real browser route/viewport checks, fresh local check and dependency scan.

Stale evidence: README, evidence manifest, local QA and submission draft still describe no public deployment or blocked GitHub push. Historical local QA is valid as historical evidence, not a substitute for this fresh deployment check.

Missing: registration/team declarations, optional pitch/technical videos, production persistence/authentication evidence, live ClawPump request/mint/pool/signature/payout/cluster, Meteora configuration/pool signatures/accounts, and actual wallet transactions.

Correct labels: simulation, offchain-only, missing signature, unknown balance and unavailable integration. No fabricated chain evidence was observed.

The submission audit is a string/disclosure check. Passing it with TODO warnings cannot establish formal eligibility, URL availability, registration or chain truth. Video durations cannot be verified before videos exist.

## 14. Accessibility and design findings

- All ten UI routes were checked at **375px, 768px and 1440px** with no horizontal document overflow.
- All inspected form inputs had labels.
- The mobile navigation dialog focuses Close navigation; Escape closes it and returns focus to Open navigation.
- Reduced-motion preference produces effectively zero transition duration.
- Atlas remained readable without horizontal overflow at 200% CSS zoom on a 375px viewport. This is a targeted approximation, not comprehensive browser text-only zoom certification.
- Computed foreground/background contrast for 61 text leaves on the desktop proof page had no WCAG AA threshold failures. This does not certify all pages, transparent/composited states or every focus/hover state.
- Keyboard focus styling exists. The first immediate skip-link measurement occurred during its transition and was not sufficient to certify final visibility.
- No real screen-reader session was performed; semantic structure/labels were inspected only.
- No fake price charts or decorative metrics were observed. The visible portfolio subtotal excludes unpriced holdings and is explicitly a fixture.

The best UX improvement is clearer evidence provenance, not more dashboard cards or decorative animation.

## 15. Critical blockers

1. Final registration, original-work/team declarations and authenticated submission remain owner-controlled.
2. Production cannot currently persist agents or authenticate wallets; the public experience is the read-only demo.
3. Live Meteora paths must not be enabled until binding, duplicate-broadcast and recovery gaps are closed.
4. ClawPump launch evidence required by its bounty does not exist.
5. Fresh governed proposal generation is missing from the repeatable product loop.
6. Dependency risk and exposed-token revocation require explicit follow-through.

These are not all “Critical” vulnerability findings. They are the most consequential submission, operational and product blockers.

## 16. Recommended fixes ordered by impact

1. Add safe, non-bypassable broadcast guard and stricter confirmation evidence; preserve all disabled execution flags.
2. Strengthen receipt cross-reference verification and live unknown-liquidity rejection with regression tests.
3. Replace stale deployment/push claims with the independently observed production commit, health and smoke evidence, while distinguishing unconfigured production services.
4. Clarify proof/checksum scope and PreStocks capture time versus quote freshness.
5. Review production auth/persistence setup with the owner, then verify it without moving funds.
6. Finish one fresh governed proposal flow rather than adding unrelated dashboard features.
7. Resolve compatible dependency updates after reachability review; retain explicit residual-risk disclosure.
8. Owner chooses a license, completes registration/declarations and prepares optional videos.

Implementation, approvals, file ownership and verification commands belong in the separate remediation report.

## 17. Submission readiness checklist

- [x] Original canonical Navis app and reproducible npm lockfile present.
- [x] Fresh local check passes.
- [x] GitHub supporting link and public Vercel demo resolve.
- [x] Clean public demo journey works at relevant viewport sizes.
- [x] Simulation/unknown/unavailable boundaries are honest.
- [x] Existing dependency and integration attribution provided.
- [ ] Registration, original-work and one-team/one-submission declarations verified.
- [ ] Owner-selected project license settled.
- [ ] Fresh proposal workflow implemented.
- [ ] Production authentication/persistence verified if advertised.
- [ ] Remediation and dependency risk reviewed before any live activation.
- [ ] Optional videos recorded and durations checked, if supplied.
- [ ] Sponsor tracks selected with evidence-appropriate claims.
- [ ] Final authenticated form reviewed and submitted manually before deadline.

## 18. Final judge recommendation

Present Navis as a **deployed, transparent governed-equity-agent simulation**, not a live stock-trading agent or confirmed sponsor launch. It is reasonable to enter the main track once the owner completes formal requirements, even without optional videos or funded transactions. Competitive strength would improve materially with a fresh repeatable proposal workflow and verified production wallet/persistence behavior.

Do not claim “winner,” guaranteed eligibility, confirmed live ClawPump/Meteora execution, independently verified chain settlement from a checksum, or complete production readiness.

## 19. Files and line references used as evidence

The required Markdown specifications were read completely: `AGENTS.md`, `README.md`, `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `PHASES.md`, `TASKS.md`, `docs/INTEGRATIONS.md`, `docs/EVIDENCE.md`, `docs/SECURITY_REVIEW.md`, `docs/DEPLOYMENT_RUNBOOK.md`, `docs/DEMO_SCRIPT.md`, `docs/SUBMISSION_DRAFT.md`, `docs/ATTRIBUTIONS.md`.

Key baseline references:

- `package.json:5-18,20-53`; `next.config.ts:3-8`; `tsconfig.json:1-32`; `.env.example:1-25`.
- `PRD.md:123-137,172-178,211,259-280,312-323`.
- `ARCHITECTURE.md:31-61,83-104,228-286,336-351`.
- `README.md:19-28,84-110`; `docs/EVIDENCE.md:7-44,70-107`.
- `docs/INTEGRATIONS.md:18-41,72-99`; `docs/SECURITY_REVIEW.md:11-45`.
- `docs/DEPLOYMENT_RUNBOOK.md:28-37,76-87,112-124,158-175`.
- `docs/SUBMISSION_DRAFT.md:15-29,41-76,98-105`; `docs/ATTRIBUTIONS.md:26-65`.
- `lib/auth/core.ts:62-83,112-151`; `lib/auth/server.ts:54-85,122-150,171-214`; `lib/auth/request.ts:5-13`.
- `lib/integrations/ai/openai.ts:131-184`; `lib/policy/runner.ts:68-110,207-252`.
- `lib/services/execution.ts:107-218,300-410`; `lib/services/reconciliation.ts`; `lib/services/launch-preflight.ts`.
- `lib/proofs/receipt.ts:64-158,162-199`; `lib/db/schema.ts:308-360`; `drizzle/0000_init.sql` through `0005_execution_events.sql`.
- `app/api/integrations/meteora/config/confirm/route.ts:170-190`; `pool/submit/route.ts:12-18,111-153`; `lib/integrations/meteora/client.ts:248-275,371-432`.
- `lib/integrations/prestocks/client.ts:15-33`; `schemas.ts:3-20`; `app/api/health/route.ts:28-50`.
- `components/workspace-shell.tsx:122-218`; active workspace route pages and market/wallet components.
- `vitest.config.mts`, all active tests, `scripts/smoke-judge-flow.mjs:12-76,145-234`, `scripts/submission-audit.mjs:3-31,54-107`.

Line references describe the pre-remediation baseline. The companion remediation report identifies changed files and new tests. No archived implementation was counted as active functionality.
