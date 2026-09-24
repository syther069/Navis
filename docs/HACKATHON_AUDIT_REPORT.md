# Navis Stocklana Judge Audit and Winning Plan

Updated: 2026-09-20.

## Executive verdict

Navis is a credible Stocklana hackathon project with a strong concept: an AI equity-agent workspace where the agent proposes, deterministic policy code checks the action, and the wallet remains the final authority for value movement.

As a judge, I would currently score the project as a strong technical demo, not yet a finished end-to-end product. The UI direction, proof-terminal concept, Solana orientation, policy engine, sponsor-integration scaffolding, and documentation are good. The main weakness is that the fresh user journey still relies too much on deterministic demo fixtures and prepared examples. For a higher score, Navis needs one clean live-feeling path where a user creates or selects an agent, receives a fresh proposal, sees policy approval or rejection, prepares sponsor-related execution, and receives a trustworthy receipt with clear evidence boundaries.

Estimated judge readiness: 61 / 100. This is an internal estimate, not an official Solana scoring rubric.

| Category                |   Score | Judge read                                                                                                  |
| ----------------------- | ------: | ----------------------------------------------------------------------------------------------------------- |
| Real user/problem       | 17 / 20 | Strong governed-agent problem. The target user and first use case still need sharper focus.                 |
| Working end-to-end demo |  9 / 25 | The fixture flow works locally, but a newly created agent cannot reach a fresh decision and receipt.        |
| Solana fit              | 12 / 20 | Wallet, receipt, PreStocks, ClawPump, and DBC choices fit Solana, but live sponsor proof is absent.         |
| Engineering quality     | 18 / 25 | Solid TypeScript, tests, schemas, and safety gates; transaction binding and proof semantics need hardening. |
| Evidence and polish     |  5 / 10 | Strong visual direction, but the public deploy is stale and final links/video/evidence remain incomplete.   |

## Verified audit evidence

The following checks were verified against the local workspace during the audit:

| Check                                                | Result                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                      | Passed format, lint, typecheck, 22 test files / 103 tests, production build, local smoke, Drizzle schema check, and submission audit. |
| `npm audit --omit=dev`                               | 19 production advisories remain: 6 high and 13 moderate, all with no non-forced fix available in the current dependency graph.        |
| Public smoke against `https://navis-gilt.vercel.app` | Failed at `/proofs/demo-proof`: the deployed page did not contain the locally required `All published hashes match` evidence text.    |
| Public health mode                                   | `demo` / `devnet`; RPC, Meteora, PreStocks, and AI configured; database, auth origin, wallet sessions, and ClawPump not configured.   |

Important version note: local `main` and `origin/main` both point to `198cee6`, so the repository is synchronized. The public deployment is not synchronized with the locally verified artifact and the evidence/submission documents still contain stale link placeholders.

## Official Stocklana requirements

Source links:

- Stocklana hackathon page: https://hackathons.solana.com/hackathons/stocklana
- Solana hackathon guide: https://hackathons.solana.com/how-it-works

Current official deadline:

- September 25, 2026 at 4:00 p.m. ET.
- In India time, that is September 26, 2026 at 1:30 a.m. IST.

Eligibility summary:

- Individuals and teams are allowed.
- One submission per team.
- Work must be original.
- Open-source components are allowed when disclosed.
- Submission requires at least one GitHub, live-demo, or video link.
- General Solana hackathon guidance allows selecting up to three sponsor tracks.
- Late submissions are not accepted.

Sponsor-fit summary:

| Track                | Navis status                             | What judges will look for                                                                                                                |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Main Stocklana track | Good fit                                 | Real user problem, working end-to-end demo, clear Solana reason, strong execution.                                                       |
| ClawPump             | Requirement not yet met                  | The official requirement is a token launch with a stock-paired pool using ClawPump and Meteora. Navis stops at preflight.                |
| Meteora DBC          | Good engineering, incomplete track proof | The current builder hardcodes wrapped SOL as quote mint; a verified stock-paired DBC profile and onchain proof would be stronger.        |
| PreStocks            | Eligible direction, shallow current use  | The validated read-only catalogue is honest, but PreStocks should become central to research, policy, or simulation to compete strongly. |
| Pyth                 | Not clearly satisfied                    | Needs central live financial data integration if targeting this sponsor track.                                                           |

## High-priority findings

### 1. Fresh end-to-end user journey is not fully wired

Severity: High for judging.

The product has strong services and demo artifacts, but the main experience still leans on the Atlas demo flow. A judge should be able to create or select an agent, generate a fresh proposal, run policy checks, prepare execution, and inspect a receipt without the project feeling like a static proof fixture.

Recommended fix:

- Add a clear "run new decision" path from the agent page.
- Use the deterministic provider as the safe default when live AI is unavailable.
- Persist the generated proposal, policy evaluation, execution eligibility, and proof receipt.
- Show at least one approved and one rejected example so judges understand that policy code can say no.

### 2. Meteora signed transaction submit path is not bound tightly enough to a server-prepared intent

Severity: High before real funds/live mode.

The submit routes validate payer, message hash, and signatures, but the client can provide the signed transaction and expected message hash. That proves the owner signed the transaction, but it does not fully prove the transaction matches a previously prepared server intent, simulation result, expiry, target cluster, and expected program/account semantics.

Recommended fix:

- Persist a server-created intent ID during prepare.
- Store expected message hash, accounts, instruction summary, simulation result, cluster, owner wallet, and expiry.
- Submit only by intent ID.
- Recompute and compare the signed message against the stored intent.
- Reject expired, mismatched, or already-used intents.

### 3. Broadcast occurs before durable persistence

Severity: High before live execution.

The current submit path can broadcast a transaction before the database records the attempt. If the process times out or persistence fails after send, Navis may lose the tracking record for a real transaction.

Recommended fix:

- Create a durable attempt record before broadcast.
- Derive or record the transaction signature before send.
- Mark uncertain network states as `unknown_pending`, not failed.
- Add reconciliation that checks signatures after timeout or restart.
- Make submit idempotent by intent ID.

### 4. Receipt verification needs stronger cross-document consistency checks

Severity: High for trust claims.

Receipt verification currently checks embedded document hashes and receipt integrity, but it should also prove that the embedded strategy, policy, portfolio, proposal, context, and policy evaluation all refer to the same facts. A malicious or buggy receipt could include individually valid pieces that do not belong together.

Recommended fix:

- Verify that context references match the embedded strategy, risk policy, and portfolio documents.
- Recompute the policy evaluation input hash from the included policy facts.
- Separate "offchain integrity", "wallet authorization", and "onchain settlement" in the receipt assurance model.
- Add tests for receipts that are internally hashed but semantically mismatched.

### 5. Unknown liquidity can still pass policy in demo-style flows

Severity: High before public live claims.

Missing liquidity data currently creates a warning rather than a hard block. That is acceptable for a labelled demo, but live trading decisions should not approve when liquidity is unknown, stale, or unavailable.

Recommended fix:

- Keep demo mode permissive only when clearly labelled.
- In live mode, block non-HOLD actions when liquidity is missing or stale.
- Add tests for live missing-liquidity rejection.

## Medium-priority findings

### 6. Meteora confirmation should distinguish confirmed signature from verified protocol result

Severity: Medium.

A confirmed transaction signature is not the same as proof that the expected Meteora config or pool was created with expected accounts. The app should not overstate protocol success when transaction evidence is partial.

Recommended fix:

- Fetch and validate transaction/account evidence before marking protocol-level success.
- Store account addresses, slots, fees, and confirmation status separately.
- Use labels such as `signature_confirmed`, `protocol_verified`, and `evidence_incomplete`.

### 7. Documentation and deployment evidence are inconsistent

Severity: Medium.

Some local docs still include placeholders or older statements, while the public deployment exists and the GitHub repository has newer changes. Judges punish inconsistency because it makes claims harder to trust.

Recommended fix:

- Update `docs/EVIDENCE.md` with the final deployed URL, GitHub URL, smoke result, and final commit hash.
- Update `docs/SUBMISSION_DRAFT.md` with final public links.
- Remove or resolve stale TODOs before final submission.
- Add a license file and keep `docs/ATTRIBUTIONS.md` complete.
- Add final screenshots or a short demo video link.

## Product improvements

### Re-audit findings that materially affect track selection

#### Public deployment drift is now a P0 submission blocker

The local judge-flow smoke passes, but the same smoke against `https://navis-gilt.vercel.app` fails on the public proof verifier. The public health endpoint also reports no database, authentication origin, wallet sessions, or ClawPump configuration. A judge cannot complete the persistent agent flow on that deployment.

Before any feature work is presented:

- Deploy the exact final commit.
- Configure `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, and `SESSION_SECRET` if persistent creation is part of the demo.
- Apply database migrations.
- Run the public smoke suite from a clean/incognito session.
- Record the deployed commit and smoke result in `docs/EVIDENCE.md`.

#### Newly created agents are a dead end

`POST /api/agents` can create a persistent demo agent, but the success UI only displays identifiers and hashes. There is no persisted agent list/detail route, and no API/UI path that generates a new decision, persists the policy evaluation, creates a simulated execution, and builds a receipt for that agent. Meanwhile, the visible Atlas, decisions, and proofs pages remain fixture based.

The highest-value product fix is:

1. Add `/agents` and `/agents/[agentId]` backed by persistence.
2. Link the creation success state to the new agent.
3. Add **Generate decision** using the deterministic provider when live AI is unavailable.
4. Persist proposal and policy evaluation.
5. Show a policy-approved and a policy-rejected run.
6. Generate a new demo receipt from the same stored records.
7. Link that receipt through decisions, proofs, and the evidence ledger.

#### The current ClawPump surface cannot satisfy its bounty

The official requirement is a token launch with a stock-paired liquidity pool using ClawPump and Meteora. Navis currently implements discovery and self-funded preflight, but the visible **Authorize payment** control is disabled and there is no paid retry/launch submission route. No mint, launch transaction, provider request, or payout-wallet proof is stored.

Official ClawPump documentation describes the required sequence: request a self-funded preflight, transfer the exact quoted amount, repeat the same request with the payment signature and preflight token, and verify the returned mint, launch transaction, quote asset, fee, and payout wallet.

Only select this track if Navis completes that flow safely and records matching onchain/provider evidence. Otherwise present it as honest preflight infrastructure in the main-track demo and do not claim bounty completion.

#### The current Meteora builder is SOL-paired, not stock-paired

`lib/integrations/meteora/config.ts` defines `WRAPPED_SOL_MINT`, and `lib/integrations/meteora/client.ts` uses it for configuration creation and pool-address derivation. The current `navis-equity-v1` profile is therefore SOL-quoted.

To improve both Meteora and ClawPump track fit:

- Replace the hardcoded quote mint with a server-approved allowlist.
- Add a verified stock-exposure quote-mint profile.
- Explain why the curve is equity-like: price band, fee schedule, graduation threshold, locked-liquidity policy, and intended issuer/treasury behavior.
- Produce devnet or mainnet config/pool signatures, addresses, explorer links, and decoded account verification.

#### PreStocks should become the core data wedge

The official PreStocks API currently exposes contract address, mark price, token price, mark valuation, implied valuation, and supply. Navis validates and displays the catalogue but does not yet use those facts in the agent decision.

A stronger bounty entry would make PreStocks the verified universe for a **Pre-IPO Treasury Analyst**:

- compute token-price premium/discount to mark price;
- show mark/implied valuation differences and concentration impact;
- record API freshness and source;
- feed the facts into a clearly labelled allocation simulation;
- show exactly which facts affected the policy result;
- retain the existing economic-exposure and eligibility disclosures.

Do not integrate non-PreStocks pre-IPO tokens if entering the PreStocks bounty.

### Recommended track strategy

The platform permits up to three sponsor tracks, but track count is not a judging advantage.

1. Main Stocklana track: always enter with the governed decision-to-receipt lifecycle.
2. PreStocks: enter after its live catalogue data becomes central to research, policy, or simulation.
3. Meteora DBC: enter after producing a verified stock-paired configuration/pool and explaining the curve design.

Replace Meteora with ClawPump only if the full official launch requirement is completed and evidenced. Do not select Pyth in the current state; Navis has no central Pyth integration.

### First-screen clarity

The first screen should explain the product in one fast sentence:

> Navis lets an AI equity agent propose Solana actions, but only deterministic policy checks and wallet approval can turn those proposals into verifiable receipts.

Add visible proof of three things early:

- The agent cannot bypass policy.
- Demo and live evidence are labelled differently.
- Wallet approval remains required for value movement.

### Judge-friendly demo flow

Recommended final demo path:

1. Open the public URL and show the mode/cluster banner.
2. Connect wallet or use demo mode.
3. Create or open the Atlas agent.
4. Generate a fresh decision.
5. Show policy approval or rejection.
6. Open the proof receipt.
7. Visit Markets Launch and show ClawPump, Meteora DBC, and PreStocks surfaces.
8. Show the transaction/evidence ledger.
9. End on disclosures and why this is safer than an unconstrained AI trader.

### UI polish

Keep the premium dark proof-terminal design. The visual direction is strong and web3-friendly. The biggest improvements are not cosmetic; they are workflow clarity, evidence labels, and reducing the chance that a judge mistakes a static demo for the real product.

Recommended UI changes:

- Add a compact "Current assurance level" badge on proof and transaction pages.
- Add a "Why this passed/failed" policy explanation panel.
- Add empty/loading/error states for sponsor integrations.
- Add a clear "Demo simulation" vs "Live onchain" distinction wherever receipts or signatures appear.
- Add one strong final submission screenshot showing the agent, policy result, and receipt hash together.

## Engineering improvements

Recommended implementation order:

| Priority | Improvement                                       | Why it matters                                               |
| -------- | ------------------------------------------------- | ------------------------------------------------------------ |
| P0       | Synchronize deployed artifact and evidence docs   | The public proof smoke currently fails.                      |
| P0       | Wire fresh decision-to-receipt flow               | This is the biggest scoring unlock.                          |
| P0       | Choose and complete sponsor evidence              | Current sponsor surfaces do not meet all track requirements. |
| P0       | Make the DBC quote mint configurable/stock-paired | The current Meteora profile hardcodes wrapped SOL.           |
| P0       | Bind Meteora submit to persisted server intents   | Prevents unsafe or misleading live execution.                |
| P0       | Persist attempts before broadcast                 | Prevents lost transaction evidence.                          |
| P1       | Strengthen receipt cross-checking                 | Improves proof credibility.                                  |
| P1       | Make live missing-liquidity a hard block          | Aligns policy engine with safety claims.                     |
| P1       | Improve Meteora confirmation evidence             | Prevents overstated protocol claims.                         |
| P1       | Finish evidence docs and submission links         | Reduces judging friction.                                    |
| P2       | Add CI for check/audit/smoke                      | Makes repo look production-serious.                          |
| P2       | Add license                                       | Required for clean open-source disclosure.                   |

## Suggested Replit execution prompt

Use this prompt to continue implementation in Replit:

```text
You are continuing the Navis Stocklana hackathon project. Read the repo docs first, especially README.md, PRD.md, DESIGN.md, ARCHITECTURE.md, TASKS.md, docs/EVIDENCE.md, docs/SECURITY_REVIEW.md, docs/SUBMISSION_DRAFT.md, and docs/HACKATHON_AUDIT_REPORT.md.

Goal: turn Navis from a strong demo into a judge-ready end-to-end product.

Highest priorities:
1. Deploy the exact final commit, fix the public proof smoke failure, configure persistence/authentication if the flow requires them, and record the deployed commit and smoke result.
2. Implement a fresh agent decision flow: agent -> proposal -> policy evaluation -> approved/rejected state -> receipt/proof page.
3. Keep demo mode safe and deterministic when live services are unavailable.
4. Make PreStocks data central to a useful research/policy simulation, using contract addresses and fresh price/valuation fields.
5. Replace Meteora's hardcoded wrapped-SOL quote mint with a server-approved stock-paired profile and produce verifiable onchain evidence if entering that track.
6. Bind Meteora submit routes to server-prepared persisted intents with expected message hash, owner wallet, cluster, expiry, simulation result, and account/instruction summary.
7. Persist execution attempts before broadcasting any transaction and add reconciliation for unknown_pending signatures.
8. Strengthen proof receipt verification so embedded documents are not only individually hashed but also semantically cross-checked.
9. In live mode, block non-HOLD actions when liquidity is missing, stale, or unknown.
10. Complete ClawPump's payment/paid-retry/onchain-evidence flow only if selecting that bounty; otherwise keep it labelled preflight-only.
11. Update docs/EVIDENCE.md and docs/SUBMISSION_DRAFT.md with final public links and verified smoke results.

Do not overclaim live sponsor evidence. Demo receipts must stay clearly labelled as simulations. Real ClawPump or Meteora claims require matching signatures, addresses, and evidence in docs/EVIDENCE.md.

Official Stocklana deadline: September 25, 2026 at 4:00 p.m. ET. Eligibility: individuals or teams, one submission per team, original work, open-source components allowed when disclosed, and at least one GitHub/live-demo/video link required.

Required resources:
- https://hackathons.solana.com/hackathons/stocklana
- https://hackathons.solana.com/how-it-works
- https://clawpump.tech/docs
- https://clawpump.tech/developers
- https://clawpump.tech/guide
- https://clawpump.tech/mcp
- https://github.com/Clawpump/claw-agent
- https://github.com/Clawpump/claw-agent/blob/main/skills/clawpump/SKILL.md
- https://docs.meteora.ag/developer-guides/dbc
- https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/getting-started
- https://docs.meteora.ag/resources/audits/overview
- https://github.com/MeteoraAg/docs
- https://github.com/MeteoraAg/meteora-invent/blob/main/skills/meteora/references/dbc.md
- https://github.com/MeteoraAg/meteora-invent/blob/main/studio/config/dbc_config.jsonc
- https://prestocks.com
- https://prestocks.com/products
- https://prestocks.com/ecosystem
- https://prestocks.com/api/prestocks
- https://solana.com/docs
- https://solana.com/developers
- https://solana.com/developers/guides
- https://github.com/solana-labs/wallet-adapter

Run verification before finishing:
- npm run format:check
- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run smoke:judge
- npm run submission:audit
- npm audit --omit=dev

Deliver a concise summary of changed files, verified checks, remaining risks, and exact submission links.
```

## Five-day winning plan

### Day 1 — remove submission drift

- Deploy the current candidate from the final repository commit.
- Configure the public origin, persistence, and wallet sessions needed by the demo.
- Fix the deployed proof verifier and run the judge smoke against the public URL.
- Replace stale URL placeholders in the evidence and submission files.

### Day 2 — complete the core vertical slice

- Add persisted agent list/detail.
- Generate and persist a fresh deterministic decision.
- Persist policy approval/rejection and create a fresh simulation receipt.
- Make the full journey navigable without fixture-only routes.

### Day 3 — deepen one sponsor wedge

- Recommended: make PreStocks the verified asset universe and expose a useful premium/discount and allocation simulation.
- If entering Meteora, finish persisted intents, stock-paired quote configuration, and verifiable devnet/mainnet evidence.
- If entering ClawPump, complete the exact payment and paid-retry launch flow; otherwise do not select that bounty.

### Day 4 — adversarial verification

- Test altered signed transactions, mismatched receipt documents, stale quotes, missing liquidity, replay, duplicate submission, and uncertain RPC outcomes.
- Capture final onchain/provider evidence without putting secrets in the repository or video.
- Run local and deployed quality gates.

### Day 5 — pitch and submit

- Record a three-minute pitch video.
- Record the optional five-minute technical walkthrough if time permits.
- Remove every unresolved submission TODO or label it honestly as unavailable.
- Rehearse in an incognito browser.
- Submit several hours before the deadline.

## Final recommendation

Navis should stay focused on its strongest claim: "agentic finance without agentic authority." Do not chase too many sponsor tracks if it weakens the core proof. A polished, honest, end-to-end governed decision flow with strong receipts will score better than several shallow integrations with unclear evidence.

The project is eligible as a demo if it is original, properly disclosed, and submitted with the required public links before the deadline. To be competitive, finish the fresh lifecycle, tighten live execution safety, and make the final evidence impossible to misread.
