# Navis Hackathon Phases

**Operating assumption:** Plan against the earlier September 18, 2026 deadline shown on the official page until organizers resolve the conflict with the September 25 header. Keep every phase demoable and preserve an honest fallback.

## Phase 0 — Research and Setup

### Objective

Lock one credible product wedge and sponsor path before implementation. Remove uncertainty that could invalidate the bounty submission.

### Deliverables

- Approved `PRD.md`, `ARCHITECTURE.md`, `TASKS.md`, and `PHASES.md`.
- Approved `DESIGN.md` based on the supplied design skills and references.
- Written confirmation of primary ClawPump and secondary Meteora targets.
- Verified ClawPump key acquisition, live pair catalogue, launch/payment flow, and account ownership model.
- Verified Meteora SDK compatibility, network support, program ID, transaction flow, and selected DBC parameters.
- PreStocks go/no-go decision based on API response and eligibility requirements.
- Confirmed submission deadline from organizers.
- Environment/credential checklist with no secrets committed.

### Acceptance criteria

- Every required bounty claim maps to an official resource and a planned executable artifact.
- Team can name the exact four-minute judge flow.
- Demo, devnet, and mainnet behaviors are separately defined.
- Mainnet cost/funding assumptions are documented but not represented as guarantees.
- User approves documentation before application initialization.

### Risks

- Official deadline text conflicts.
- “Using ClawPump and Meteora” may require a particular combined path not fully specified publicly.
- Stock-paired assets in `/pump-pairs` may change.
- PreStocks API contract or regional access may be unsuitable.
- SDK dependency versions may conflict with the chosen frontend wallet stack.

### Fallback plan

- Work to September 18 unless organizers say otherwise.
- Ask sponsor channels for written clarification and retain evidence.
- Query live pair support during the demo; never hard-code availability.
- Keep PreStocks out of the execution path if verification fails.
- Isolate Meteora integration in a server/domain adapter so version conflicts do not destabilize core UI.

## Phase 1 — Product Skeleton

### Objective

Create a recognizable Navis product shell and truthful demo baseline quickly, without spending the week on infrastructure.

### Deliverables

- Next.js/TypeScript/Tailwind application named Navis.
- Approved design tokens and compact product shell.
- Routes for agent profile, agent creation, decision/receipt, and market launch.
- Typed domain models and database schema.
- Demo adapter and one coherent Atlas agent fixture.
- Mode/cluster/source indicators and capability-status view.
- Wallet connection shell and RPC health read.
- Loading, empty, error, and permission states.

### Acceptance criteria

- First viewport exposes the agent mandate, constraints, treasury, and primary “Generate decision” action.
- A judge can navigate the full intended flow with static/demo data.
- Demo data is visibly labelled at every proof-sensitive point.
- The product works at 375px and desktop widths without clipping.
- No secret is present in client code or fixture data.

### Risks

- Over-designing a generic finance dashboard.
- Building too many routes before the core flow works.
- Fixture shapes diverging from real sponsor responses.

### Fallback plan

- Collapse the experience to agent profile → decision drawer/page → receipt.
- Keep one strategy and one agent.
- Validate fixtures with the same schemas used for live adapters.

## Phase 2 — Agent Core

### Objective

Make Navis's differentiator work: AI proposals bounded by versioned, deterministic policy and connected to a treasury snapshot.

### Deliverables

- Agent creation with immutable strategy and risk-policy versions.
- Solana treasury reads and snapshot persistence.
- AI provider abstraction and deterministic demo provider.
- Strict trade-proposal schema.
- Deterministic risk engine with pass/fail evidence.
- Approved and rejected proposal paths.
- Execution-attempt state machine.
- Proof timeline and simulation receipt.

### Acceptance criteria

- Model prose cannot bypass schema validation.
- Unknown mints, stale data, excess concentration, reserve breach, excess slippage, or duplicate execution block the action.
- Every decision references exact strategy, policy, portfolio, and market snapshots.
- The same inputs produce the same policy result and stable hash.
- Simulation receipts contain no fake signature or explorer link.
- One full demo-mode flow completes reliably in under four minutes.

### Risks

- Market prices are unavailable or inconsistent.
- Model output varies during a live demo.
- Valuation arithmetic or token decimals produce unsafe sizing.
- Too many policy rules obscure the story.

### Fallback plan

- Use a timestamped deterministic market/decision fixture while keeping the real policy engine.
- Show only the most meaningful six checks in summary and preserve full detail below.
- Block valuation-dependent execution when any required asset is unpriced.

## Phase 3 — Sponsor Integrations

### Objective

Produce verifiable sponsor-linked artifacts central to the product rather than decorative API logos.

### Deliverables

#### ClawPump

- Server-only Partner API client.
- Agent create/link flow.
- Live supported-pair discovery.
- Stock-paired launch preflight with payment, payout, pair, fee, and initial-buy review.
- Guarded launch result with real mint, pair metadata, request ID, and transaction hash.

#### Meteora

- Official DBC SDK adapter.
- Equity-like curve configuration with written rationale.
- Exact config preview.
- Devnet config/pool creation and monitoring; mainnet only if funded and explicitly approved.
- Graduation threshold and migration status surface.

#### PreStocks, if useful

- Validated asset catalogue and mint metadata.
- Economic-exposure and regional eligibility disclosure.
- One allowed Navis asset only if a real supported mint and executable venue are confirmed.

### Acceptance criteria

- ClawPump pair comes from the live `/pump-pairs` response.
- Launch calls use the apex domain, preserve request IDs, and handle structured 402 states.
- No write is blindly retried.
- Meteora UI displays the exact submitted curve/fee/authority parameters.
- Any shown address or signature resolves on the stated cluster.
- Product copy never merges the ClawPump launch and Meteora DBC into one unsupported API claim.
- If PreStocks is used, restricted-user gating and disclosures are visible.

### Risks

- Missing API key, unfunded agent/wallet, or provider outage.
- No stock pair is available in the live ClawPump catalogue.
- Meteora pool graduation requires much more capital than a hackathon demo can provide.
- Mainnet-only sponsor behavior makes rehearsal expensive.
- PreStocks endpoint fails or omits canonical mints.

### Fallback plan

- Record and display a real preflight plus provider error/request ID; use simulation for the unavailable final step without claiming bounty completion.
- Use devnet for Meteora creation and show threshold monitoring rather than force graduation.
- Keep a screen recording and evidence manifest of successful sponsor transactions, while the live app always refetches current status.
- Drop PreStocks from the submission target if it cannot be integrated honestly.

## Phase 4 — Onchain Execution and Proofs

### Objective

Connect an approved decision to a wallet-authorized transaction and independently verifiable portfolio change.

### Deliverables

- Wallet signature authentication.
- Transaction prepare/decode/simulate/review/sign/submit pipeline.
- Mainnet safety feature flag and cluster guard.
- Idempotent execution attempts.
- RPC confirmation and pending reconciliation.
- Pre/post balance calculation.
- Public proof receipt with strategy, policy, decision, and execution evidence.
- Transaction history with confirmed, pending, failed, cancelled, rejected, and simulated states.

### Acceptance criteria

- A failed or expired decision cannot reach a wallet prompt.
- The review shows mints, amounts, slippage, fees, programs, destination, and cluster.
- Unexpected writable accounts/programs are rejected.
- User cancellation returns safely to the approved proposal.
- Submitted-but-unconfirmed transactions are labelled pending/unknown rather than failed.
- Real receipts contain valid explorer links and RPC-derived balance deltas.
- Demo receipts cannot render real-status styling or explorer links.

### Risks

- Wallet adapter incompatibility or mobile wallet failure.
- Blockhash or quote expires during approval.
- RPC confirmation timeout produces ambiguous status.
- Sponsor returns a transaction that does not match the review summary.

### Fallback plan

- Preserve simulation as the default path and make a single pre-recorded devnet receipt available as evidence, clearly identified by time and cluster.
- Rebuild stale transactions after revalidation; never resubmit blindly.
- Decode and compare sponsor-built instructions before presenting them.
- Use a second RPC for read-only verification if primary RPC is degraded.

## Phase 5 — Polish and Hackathon Submission

### Objective

Turn the working core into a legible, reliable judge experience and submit verifiable evidence before the deadline.

### Deliverables

- Responsive and accessibility polish.
- Clear product copy and risk disclosures.
- README with architecture, setup, modes, sponsor integration, limitations, and open-source attribution.
- Three-to-five-minute demo script and video.
- Deployed application with devnet/demo safety defaults.
- Evidence manifest with repo, live URL, video, signatures, mints, config/pool addresses, clusters, and sponsor request IDs.
- Final submission form and compliance checklist.
- Clean-browser and backup-demo rehearsal.

### Acceptance criteria

- The first screen communicates capital, constraints, and track record without a long marketing preamble.
- A judge can finish the core flow in under four minutes.
- Every claim in the video can be verified in the app, repo, provider response, or explorer.
- No secret or private key appears in git history, build output, logs, video, or screenshots.
- All links work from a signed-out browser.
- Submission occurs before the confirmed deadline; if still unconfirmed, before September 18 at 4:00 p.m. ET.

### Risks

- Late visual polish breaks a tested flow.
- Live API/RPC fails during judging.
- Video or deployed app contains stale proof links.
- Submission copy overstates incomplete integration.

### Fallback plan

- Freeze features before final day and accept only blocking fixes.
- Keep deterministic demo mode plus verified historical receipts.
- Record the demo after final evidence verification.
- Cut optional screens instead of weakening the core proof chain.
- State limitations directly in README and submission copy.

## Phase gates

| Gate   | Required evidence                                                                               |
| ------ | ----------------------------------------------------------------------------------------------- |
| 0 → 1  | Documentation and bounty target approved; deadline escalation sent.                             |
| 1 → 2  | Coherent responsive shell, typed data, and honest demo fixture.                                 |
| 2 → 3  | Deterministic approved/rejected flow and simulation receipt work end to end.                    |
| 3 → 4  | At least one sponsor integration produces a real verifiable artifact; second has a tested path. |
| 4 → 5  | Wallet execution/proof flow passes devnet rehearsal and security review.                        |
| Submit | Live URL, repo, video, evidence manifest, disclosures, and compliance checklist verified.       |

## Scope-cut order if time is short

1. Cut Pyth and all unplanned integrations.
2. Cut PreStocks unless already working and eligible.
3. Cut scheduled automation and public strategy templates.
4. Cut additional agents and strategy variants.
5. Cut optional live swap execution while preserving launch proof and simulation.
6. Never cut deterministic validation, mode labels, proof integrity, or sponsor evidence.
