# Navis Product Requirements Document

**Status:** Restored implementation baseline under final audit  
**Product:** Navis  
**Event:** Stocklana Solana Hackathon  
**Planning date:** 2026-09-16  
**Implementation status:** The canonical Next.js application is restored at the repository root. Its recorded deterministic demo is freshly verified; focused bug fixes, sponsor safety review, and final QA remain.

## 1. Product overview

Navis is an autonomous onchain equity-agent platform on Solana. A Navis agent has a public mandate, an allowed asset universe, machine-checkable risk limits, a treasury, and a durable record of every proposed and executed action. The product is not a stock-tip chatbot: its central object is a capital-bearing agent whose decisions can be inspected before execution and audited afterward.

The MVP turns one constrained rebalance from intent into evidence:

1. A user creates or selects an equity agent.
2. The agent produces a structured trade proposal from current portfolio and market inputs.
3. A deterministic policy engine approves or rejects the proposal.
4. The user reviews the exact action and signs, or runs an explicitly labelled simulation.
5. Navis records the decision inputs, policy result, transaction signature, and portfolio delta.

## 2. Hackathon context

The official Stocklana page describes a one-week build focused on making tokenized stocks more useful than a brokerage experience. Judges ask whether the entry serves a real user and problem, works end to end, belongs on Solana, and is well executed. The page says to pick one wedge and make it excellent.

Navis's wedge is **governed autonomous treasury management for tokenized equities**. The demo should prioritize one credible agent lifecycle over broad dashboard coverage.

### Deadline warning

Verified from the official Stocklana page on 2026-09-20: submissions close **Friday, September 25, 2026 at 4:00 p.m. ET**. The former September 18 language is obsolete.

### Official references

- Stocklana: https://hackathons.solana.com/hackathons/stocklana
- ClawPump API: https://clawpump.tech/developers
- ClawPump agent docs: https://clawpump.tech/docs
- Meteora DBC: https://docs.meteora.ag/developer-guides/dbc
- Meteora DBC TypeScript SDK: https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/getting-started
- PreStocks: https://prestocks.com/products and https://prestocks.com/api/prestocks
- Solana docs: https://solana.com/docs
- Wallet Adapter: https://github.com/anza-xyz/wallet-adapter

## 3. Target users

### Primary

- Crypto-native investors who hold tokenized equities and want automated allocation without giving an opaque model unlimited discretion.
- Small onchain treasury operators who need a visible mandate, limits, and transaction trail.
- Hackathon judges evaluating whether an AI agent controls capital safely and verifiably.

### Secondary

- Strategy authors who want to publish a reproducible mandate and track record.
- Tokenized-equity or launch partners looking for usable stock-paired markets.

## 4. Problem statement

Most AI trading demos stop at prose recommendations. Most automated trading products hide their constraints and reasoning inside an offchain service. Users cannot easily answer: What may this agent buy? How much may it risk? Which facts caused this trade? Which rule allowed it? Did the transaction actually settle? What changed afterward?

Tokenized equities make those questions more important because availability, liquidity, legal eligibility, and the relationship between a token and a referenced company vary by issuer and venue.

## 5. Navis solution

Navis binds each agent to a versioned strategy and deterministic risk policy. The AI may propose an action, but it cannot approve itself. A server-side validation engine checks the proposal against position, exposure, liquidity, slippage, turnover, and asset-allowlist limits. A user-visible receipt connects the proposal hash to the signed Solana transaction and resulting balances.

## 6. Core value proposition

**AI agents with capital, constraints, and a track record.**

Navis makes autonomy legible: every agent declares what it is trying to do, what it cannot do, and what happened when it acted.

## 7. Why this belongs on Solana

- One public ledger can hold assets, swaps, launch transactions, balances, and settlement evidence.
- Low transaction cost and fast confirmation support small, frequent, policy-bounded reallocations.
- Wallet signatures keep execution authorization with the user or a deliberately funded agent wallet.
- Transaction signatures and account deltas are independently inspectable through a block explorer.
- Solana's token and liquidity ecosystem makes stock-paired markets and composable agent treasuries possible.

## 8. Why this fits Stocklana

Navis improves the ownership and use of tokenized stocks rather than recreating a brokerage UI. Its primary experience is a governed agent treasury, and its sponsor integration can launch a token with a supported stock-paired ClawPump market while demonstrating a Meteora DBC configuration designed for thin or newly tokenized equity-like assets.

## 9. Bounty-track alignment

### Primary target: Stocknized Agent on ClawPump

The bounty explicitly requires launching a token with a stock-paired liquidity pool using ClawPump and Meteora. Navis will:

- create or connect a ClawPump agent;
- query `GET /api/v1/pump-pairs` at runtime instead of hard-coding a stock mint;
- allow only a returned supported quote mint;
- perform launch preflight and require explicit human approval before payment;
- submit `POST /api/v1/launch` or the documented self-funded flow;
- store the returned mint, pair metadata, payout wallet, request ID, and transaction hash;
- surface a Meteora-linked market or DBC proof only when a real Meteora transaction/address is available.

### Secondary target: Best Use of Meteora DBC

Navis proposes an **equity-session-aware DBC configuration** for thinly traded stock-paired agent tokens: conservative initial price discovery, explicit quote asset, bounded fee behavior, a disclosed graduation threshold, and DAMM v2 migration. Originality must live in an actual configuration and monitoring surface, not in slides. Devnet rehearsal is acceptable for development, but the bounty page says working mainnet code is stronger.

### Optional target: Best Use of PreStocks

PreStocks may supply a real pre-IPO token universe and metadata if the API is accessible and usage/eligibility conditions are confirmed. PreStocks state that their tokens provide economic exposure only, carry no ownership or voting rights, can lose all value, may lack liquidity, and are unavailable to U.S. persons and other ineligible persons. Navis must reproduce appropriate disclosures and must not describe these tokens as shares.

### Not in MVP unless credentials and time allow

- Pyth data as a decision input. It is a strong future addition, but it should not displace the required ClawPump/Meteora path.
- Custom Solana programs. The proof model can be credible with canonical hashes, signed transactions, and database records for the hackathon.

## 10. User stories

- As an investor, I can inspect an agent's mandate and limits before connecting a wallet.
- As an investor, I can see which token mints the agent is allowed to trade and why.
- As an investor, I can ask for a rebalance proposal and receive structured inputs, action, confidence, and rationale.
- As an investor, I can see every passed and failed policy check before execution.
- As an investor, I must explicitly approve any transaction that spends funds.
- As an investor, I can distinguish simulated, devnet, and mainnet activity at a glance.
- As a judge, I can follow one proposal from strategy version through transaction and portfolio delta.
- As a judge, I can verify a real signature and mint on an explorer.
- As a builder, I can swap a market-data or AI provider without changing the policy engine.
- As a market launcher, I can discover supported ClawPump pairs and launch with a selected stock-paired quote asset.

## 11. MVP scope

### Must ship

- One polished end-to-end agent experience.
- Agent creation or connection to a real ClawPump agent.
- Versioned strategy, allowed assets, and risk constraints.
- Treasury balances sourced from Solana RPC when possible.
- Structured AI decision generation.
- Deterministic validation with human-readable results.
- Simulation by default; wallet-approved transaction execution when configured.
- Decision and execution receipt with hashes, signature, cluster, timestamps, and balance delta.
- ClawPump supported-pair discovery and guarded stock-paired launch flow.
- Meteora DBC configuration preview and, when funded, a real devnet/mainnet pool/config transaction.
- Demo fixture that remains obviously labelled and never fabricates explorer links.

### Should ship

- PreStocks catalogue ingestion if the public endpoint is stable and terms are confirmed.
- Agent run history and proof timeline.
- Shareable read-only agent profile.
- Explorer deep links for real accounts and signatures.

### Could ship

- Scheduled proposal generation without autonomous signing.
- Pyth comparison between underlying equity and tokenized representation.
- Public strategy templates.

## 12. Non-goals

- Brokerage, custody, investment advice, or guaranteed returns.
- Unattended mainnet trading with unrestricted keys.
- High-frequency trading, complex order management, tax reporting, or portfolio accounting.
- Claiming that a token confers equity ownership.
- Fabricated liquidity, signatures, wallet addresses, performance, or sponsor integration.
- A broad social trading platform or generic analytics dashboard.
- Building a new Solana program unless required by a validated gap.

## 13. Core product flows

### A. Inspect an agent

Open agent profile → review mandate and policy version → inspect treasury and allowed mints → review past decisions and executions.

### B. Create an agent

Connect wallet → choose focused template → set allowed assets and numeric limits → review disclosures → create local Navis record → optionally create linked ClawPump agent → display wallet funding instructions without claiming custody.

### C. Generate and validate a decision

Snapshot portfolio and market inputs → request strict JSON proposal → schema validation → canonicalize and hash → run deterministic risk rules → show pass/fail checks → permit simulation or execution only if approved.

### D. Execute or simulate

Build quote/transaction → show amounts, mint addresses, fees, slippage, and cluster → request wallet approval → submit and confirm → refetch balances → write proof receipt. If credentials or funds are missing, run the same pipeline in demo mode without a fake signature.

### E. Launch a stock-paired market

Fetch live ClawPump pairs → select an explicitly stock-related supported asset → display fixed pairing and fee implications → preflight cost → human approval → launch → confirm response and signature → record proof. The Meteora DBC flow is shown separately: configure → simulate → sign → confirm → monitor graduation state.

## 14. Functional requirements

| ID    | Requirement             | Acceptance condition                                                              |
| ----- | ----------------------- | --------------------------------------------------------------------------------- |
| FR-01 | Agent profile           | Shows owner/linkage, strategy version, status, cluster, and mode.                 |
| FR-02 | Strategy declaration    | Objective, horizon, cadence, universe, signals, and rebalance rules are explicit. |
| FR-03 | Risk policy             | Limits are typed, versioned, and immutable for an already-recorded decision.      |
| FR-04 | Treasury                | Balances include mint, symbol, quantity, source, and last refresh.                |
| FR-05 | Decision generation     | AI output passes a strict schema; prose alone is rejected.                        |
| FR-06 | Validation              | Every rule returns pass/fail, observed value, threshold, and explanation.         |
| FR-07 | Execution gate          | Failed or stale proposals cannot be executed.                                     |
| FR-08 | Human consent           | Every value-moving browser-wallet transaction requires explicit signature.        |
| FR-09 | Proof receipt           | Receipt links immutable decision data to execution outcome.                       |
| FR-10 | History                 | Decisions and executions are ordered and filterable by status/mode.               |
| FR-11 | ClawPump pair discovery | Pair choices come from the authenticated live endpoint.                           |
| FR-12 | Market launch           | Launch records actual API request ID and real response; errors remain errors.     |
| FR-13 | Meteora preview         | Shows exact curve, fee, quote mint, threshold, migration, and authority values.   |
| FR-14 | Mode labels             | Every screen and receipt clearly says demo, devnet, or mainnet.                   |
| FR-15 | Disclosures             | Tokenized exposure and regional limitations are shown before relevant action.     |

## 15. Technical requirements

- Next.js App Router, TypeScript in strict mode, Tailwind CSS.
- Server-only sponsor and AI credentials.
- Zod schemas at every external boundary.
- PostgreSQL-compatible persistence for deployed demo; checked-in JSON fixtures only for demo fallback.
- Solana RPC reads and transaction confirmation with explicit cluster.
- Wallet Adapter-compatible client connection; repository has moved to `anza-xyz/wallet-adapter`.
- Official Meteora DBC TypeScript SDK and compatible Solana dependencies.
- Correlation IDs and structured logs with secret redaction.
- Responsive, keyboard-accessible interface with no fake live-state indicators.

## 16. Onchain requirements

- Never store a user's secret key.
- Mainnet execution is disabled unless `ENABLE_MAINNET_EXECUTION=true` and the user confirms cluster, token mints, amounts, and costs.
- Devnet is the default integration environment where sponsor functionality supports it.
- Simulate before sending when possible; confirmation must meet configured commitment.
- Persist the signature, slot, block time, fee payer, program IDs, relevant accounts, status, and pre/post balances from RPC.
- Derive explorer URLs from real cluster and signature only.
- Treat RPC responses as untrusted external data and handle stale blockhashes and expired quotes.

## 17. AI-agent requirements

The model receives a bounded snapshot: strategy version, policy version, allowed assets, portfolio, market inputs with timestamps/sources, and permitted action types. It returns:

- `action`: `BUY`, `SELL`, `HOLD`, or `REBALANCE`;
- input/output mint and UI amount;
- maximum slippage requested;
- concise thesis and evidence references;
- confidence score;
- invalidation conditions;
- data timestamp and expiry.

The model cannot modify policy, add a mint, sign a transaction, bypass validation, or mark its own action executed. Tool access is least-privilege. A ClawPump chat turn may invoke tools and create onchain side effects, so Navis must not use unrestricted `/chat` as a harmless reasoning endpoint.

## 18. Risk-constraint system

Minimum MVP rules:

- allowed input and output mints;
- maximum trade notional;
- maximum position weight after trade;
- minimum cash/quote reserve after trade;
- maximum slippage;
- maximum daily turnover;
- cooldown since last execution;
- maximum data age and quote age;
- minimum available liquidity when reliable data exists;
- cluster and execution-mode allowlist;
- one pending execution per decision;
- explicit block for unknown or unverified assets.

Rules run in deterministic TypeScript using decimal-safe arithmetic. A policy result is immutable and stores the exact inputs used. Overrides are out of MVP; a rejected proposal must be regenerated.

## 19. Proof-of-strategy system

Each strategy version is canonical JSON containing its objective, universe, signals, cadence, actions, and risk policy reference. Navis computes a SHA-256 hash and stores the canonical document and hash with every decision. The UI shows the human-readable strategy plus its version/hash. A later edit creates a new version; it never rewrites earlier receipts.

For the hackathon MVP, the hash may remain offchain while the transaction signature provides onchain anchoring. An optional memo instruction may include a compact decision hash if transaction size and integration path permit; the UI must state whether the hash was actually anchored. Navis receipts now expose this as an explicit `hashAnchoring` field so a demo receipt can say `offchain_only` while a future live receipt can distinguish signature-only evidence from memo-instruction anchoring.

## 20. Proof-of-execution system

A proof receipt contains:

- decision ID and decision hash;
- strategy and policy hashes;
- proposal and validation timestamps;
- execution mode and cluster;
- quote provider, quote expiry, expected amounts, slippage limit;
- transaction signature and explorer URL only when real;
- confirmation status, slot, fee, and program IDs;
- pre/post token balances and computed portfolio delta;
- sponsor request ID and returned mint/pair data when applicable;
- error code and safe message for failed attempts.

A simulation receipt uses `simulationId`, simulated logs, and `SIMULATED` status—never a transaction-looking string.

## 21. Success metrics

### Demo success

- A judge completes inspect → generate → validate → sign/simulate → verify in under four minutes.
- At least one real sponsor-linked artifact is independently verifiable.
- Every execution shown has a real signature or an unmistakable simulation label.
- A failed risk rule visibly blocks execution.

### Product quality

- 100% of proposals schema-validate before policy evaluation.
- 100% of executions reference an approved, unexpired decision.
- 100% of sponsor calls capture request ID and mode.
- Zero secrets in client bundles or logs.
- Mobile flow remains usable at 375px width and keyboard flow is complete.

## 22. Demo flow for judges

1. Open the public profile for **Atlas**, a balanced tokenized-equity agent.
2. Point out the mandate, allowed mints, max position, max trade, and reserve rule.
3. Connect a wallet and show the current cluster/mode.
4. Generate a rebalance decision from a timestamped snapshot.
5. Expand the policy report; intentionally demonstrate one rejected oversized proposal if time permits.
6. Approve the valid proposal and simulate or sign the prepared transaction.
7. Open the receipt and explorer proof; compare pre/post balances.
8. Open Market Launch, fetch ClawPump's live supported pairs, and show the selected stock-paired mint.
9. Show preflight, explicit payment consent, and the real launch result or a clearly labelled recorded rehearsal.
10. Show the separate Meteora DBC configuration and its real config/pool status if executed.

## 23. Submission checklist

- Register and submit before September 25, 2026 at 4:00 p.m. ET.
- Public GitHub repository with license and attribution for open-source components.
- Deployed demo URL.
- Pitch video no longer than three minutes and technical walkthrough no longer than five minutes.
- README with setup, architecture, modes, sponsor integration, and known limitations.
- At least one of GitHub, live demo, or video is required; include all three if possible.
- Real transaction signatures and account links verified from a clean browser.
- ClawPump and Meteora usage named precisely.
- PreStocks disclosure included if used.
- No secrets, seeded wallets, or funded private keys committed.
- Submission copy avoids investment-return claims.

## 24. Eligibility and compliance checklist

- [ ] One submission for the team.
- [ ] Work is original to this hackathon; reused open-source components are disclosed.
- [ ] A real user, problem, Solana rationale, and working end-to-end flow are evident.
- [ ] Bounty-specific requirements are satisfied with working code, not screenshots alone.
- [ ] ClawPump launch uses a pair returned by its live pair catalogue.
- [ ] Meteora claims point to a real config/pool/transaction or are labelled planned/demo.
- [ ] Mainnet actions require explicit user confirmation and funded wallets.
- [ ] Regional and product eligibility is not assumed; restricted users are blocked from PreStocks actions.
- [ ] Tokenized products are described as exposure, not legal shares or guaranteed claims.
- [ ] No investment advice, profit guarantee, fabricated performance, or false liquidity claim.
- [ ] Privacy policy and risk disclosure are visible if collecting user data.
- [x] Official Stocklana page verified on 2026-09-20 with the September 25, 2026 at 4:00 p.m. ET deadline.

## Assumptions and decisions requiring approval

1. Primary bounty: ClawPump; secondary: Meteora DBC; PreStocks only if the API and eligibility path are usable.
2. The MVP uses browser-wallet approval rather than server-held user keys.
3. One focused strategy template is better than a strategy marketplace.
4. A hosted relational database is acceptable, with local JSON only as labelled fallback.
5. Mainnet remains feature-flagged until credentials, funds, and sponsor support are verified.
6. Navis will not imply that ClawPump's pump-pair launch and Meteora DBC are the same transaction flow.
