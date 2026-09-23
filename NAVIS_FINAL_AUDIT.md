# Navis final engineering and Stocklana audit

Audit date: 23 September 2026. This is an evidence-based readiness review, not a security certification or a sponsor eligibility award.

## 1. Executive summary

Navis has a working **policy-controlled, persisted research simulation** using real PreStocks catalogue data. Its shortest credible demonstration is Atlas proposing a rebalance, deterministic policy accepting or rejecting it, and a public offchain integrity receipt surviving a fresh request. It is not a completed autonomous stock-trading system.

Production was independently identified as `ae137135dec290a20ced16a2f516befcf1c63c25`, not the older SHA in the supplied brief. GitHub main and the Vercel production alias agreed at the start of this audit. The current production smoke and authentication checks passed. The audit fixes are tracked separately below; a successful local test must not be represented as a production release.

**ClawPump bounty completion is not established.** Real authenticated catalogue reads and a separate SOL-quoted Meteora devnet pool do not prove a ClawPump-launched token in a stock-paired Meteora pool. Provider agent authorization, undocumented same-token handoff, missing PreStocks token badges, and the intentional broadcast stop remain material blockers.

No new financial transaction, funding, provider agent creation, paid launch or broadcast was performed in this audit. Historical devnet transactions were read and decoded only.

## 2. Current architecture and audit coverage

- Root Next.js App Router app, React wallet-adapter client, server API routes.
- PostgreSQL/Drizzle storage with ownership-scoped service reads, transactional decision persistence, immutable evidence triggers and request-key constraints.
- Wallet Ed25519 challenge authentication; scoped HS256 sessions, eight-hour expiry and per-session revocation.
- Atlas research proposals, deterministic bigint policy evaluation, explicitly simulated execution and independently hash-verifiable receipts.
- Server-only PreStocks and ClawPump clients; Meteora SDK transaction construction, simulation, persisted intents and reconciliation.
- GitHub CI and Vercel production hosting. Replit is development only.

Review covered all 22 API route files, auth and rate limits, database schema and 12 migrations, service ownership/persistence, policy/proofs, integrations, Solana builders, wallet/UI failure paths, tests, Git divergence, package/lockfile, CI, README and submission/evidence documents. Static scanning covered the workspace; manual review compared local main with the production Git ref. This was not a formal exhaustive penetration test.

The local tree contained substantial unreleased devnet/replay work. A new audit branch was based on production, excluding that delta and the cancelled stock-filter feature. Local permissive broadcasting was identified separately and must not be promoted to production.

## 3. Core user flow and judge demonstration

1. Open `/agents/atlas`, choose the PreStocks universe and Balanced scenario.
2. Run one decision. Inspect real catalogue source, timestamp limitations, proposal and simulated holdings.
3. Inspect deterministic checks, including any warning. Approval means policy approval of a simulation, not a trade.
4. Verify the offchain receipt and follow persisted decision/proof links. Reload either link to demonstrate persistence.
5. Run Oversized and show rejection. No wallet signing or funds are needed for this research demo.
6. Optionally inspect `/markets/launch`: distinguish live catalogues, provider-blocked actions and DBC preparation from a submitted pool.

| Stage                               | Actual evidence/status                                             |
| ----------------------------------- | ------------------------------------------------------------------ |
| Wallet authentication               | Real message signature and durable server session                  |
| PreStocks market inputs             | Real API data; upstream observation time is not supplied           |
| Atlas decision                      | Deterministic demo/research workflow; AI source/fallback disclosed |
| Policy and receipt                  | Real evaluation, hashes, immutable DB chain when configured        |
| User approval to treasury execution | Not integrated for arbitrary real agents                           |
| Execution in Atlas                  | Simulated, no signature, fee or explorer transaction               |
| DBC preparation/simulation          | Real SDK/RPC paths, ownership-bound intents                        |
| DBC submission                      | Intentionally disabled in production and audit release             |
| Historic devnet DBC                 | Independently verified SOL-quoted config/pool, not stock pairing   |

## 4. Security findings

The fresh production probe passed: two independent wallet sign-ins, nonce replay rejection (401), untrusted-origin logout rejection (403), logout (200), copied-token rejection (401), another wallet's session still accepted (200), and nonce throttling (429 with a positive Retry-After). Test keypairs and cookies stayed in memory and were not included in evidence.

Important findings:

- **P0 release reproduction:** clean CI install fails because the lockfile omits dependencies; an incremental local build had concealed it.
- **P0 local safety:** local-only devnet broadcast policy contradicted the requested stop. Production remained disabled.
- **P1 safety before future execution:** Meteora's RPC endpoint needed genesis validation at the transaction boundary, not merely a separate health probe.
- **P2 logout:** disconnect during session checking/read failure could skip DELETE. Existing production happy-path revocation did not cover this.
- **P2 resource exhaustion:** in-process limiter identities were never globally expired or capped.
- **P2 information disclosure:** arbitrary infrastructure errors in prepare/simulate routes could escape into HTTP responses. No actual credential leak was observed.
- **P2 remaining abuse surface:** several authenticated agent/provider/prepare endpoints lack shared per-user quotas; selected public RPC reads lack a limiter. No live flooding was performed.

Existing safeguards include exact sign-in domain/URI, nonce expiry and atomic consumption, issuer/audience/algorithm-pinned JWTs, HttpOnly/Secure/SameSite cookies, trusted mutation origins, ownership-scoped queries, durable jti revocation, shared auth rate limits and fail-closed execution gates. **Legacy tokens issued without a jti remain valid until their original eight-hour expiry and cannot be individually revoked.** The durable logout guarantee applies to jti-bearing sessions; all newly issued sessions have a jti.

### Automated scanning

At baseline: SAST completed with no findings; privacy/dataflow scan completed with no findings. Dependency scan found **4 high and 2 moderate advisories, 0 critical**:

- `bigint-buffer@1.1.5`: buffer overflow, no reported compatible fix.
- `toml@3.0.0`: uncontrolled recursion and prototype pollution, major upgrade indicated.
- `uuid@8.3.2`: caller-provided buffer bounds, major upgrade indicated.
- `esbuild@0.18.20`: development-server CORS advisory.
- `stream-json@1.9.1`: nested-input denial of service, major upgrade indicated.

Counts are advisories, not demonstrated Navis exploits. Dependency reachability and compatibility must be considered before upgrades. No blanket major-version override or disabled gate is an acceptable remedy.

Compatibility review found no safe parent upgrade resolving these chains: Meteora/SPL token still depends on `bigint-buffer`; Anchor still requires TOML 3; Web3 still requires Jayson 4; newer Drizzle Kit still carries the old esbuild loader. Token layout code can reach bigint-buffer, so that risk remains. Navis does not use Anchor workspace TOML parsing or Jayson TCP/TLS streaming; Jayson uses UUID v4, not the affected v3/v5/v6 buffer APIs. These reduce demonstrated reachability but do not erase dependency advisories. The npm audit feed assigns UUID a different severity than the workspace scanner; retain both tool contexts rather than silently changing the scanner count.

## 5. Database findings

Production health reported database connectivity, table readiness and immutability guards. The public smoke created a new PreStocks-backed simulated decision and retrieved its persisted detail/proof. Authentication revocation was also proved through independent HTTP requests.

Evidence writes are atomic; immutable tables/triggers protect strategy, policy, snapshot, evaluation, proof and execution events. Private data remains owner-scoped, with explicit public Atlas visibility. Isolation relies on service authorization, not a claim of database RLS.

The old readiness probe omitted `rate_limit_windows` and public-demo/identity uniqueness objects. The audit strengthens it. Health still is not a substitute for exact migration-journal/schema validation. No production DDL or data deletion was performed.

Residual risks: unbounded legitimate authenticated record creation without quotas; public demo evidence accumulates; existing public-Atlas DB tests have a reported concurrency/deadlock risk. Failed smoke reports may not be saved, so an older report must never be mistaken for a fresh passing run.

## 6. Solana findings

Wallet messages and transaction messages are different authorizations. Signature/message/payer binding, ownership, expiry, simulation and reconciliation are present. Keep the transaction release stop.

Constants required by the brief remain:

- Devnet genesis: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`
- Mainnet-beta genesis: `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`
- Validated DBC migration threshold: **4,828,261,555 lamports**

Both genesis values were checked by read-only RPC. Matching an environment cluster label alone does not prove which network an RPC endpoint serves.

## 7. Atlas findings

The strong working product is a deterministic policy-controlled research demo, not an AI text-only response. Live PreStocks selection affects simulated allocation and proposal sizing. Actual source/fallback, simulated execution and persistence mode are exposed.

Real-agent execution is deliberately rejected. Do not relax that guard to satisfy a demo. Standalone receipts establish canonical hash/reference integrity, not every historical policy input: raw `PolicyFacts` are not fully embedded and `inputHash` cannot be independently recomputed from the published receipt alone.

Fixture scenarios use scenario-derived sizing/risk facts and should not be represented as live-proposal execution authorization. Demo reserve assumptions and unavailable liquidity are not observed wallet balances or an executable quote. The receipt wording must distinguish warnings from passed checks.

## 8. PreStocks findings

Official `https://prestocks.com/api/prestocks` returned 200 and eight assets in the audit snapshot. Real API data drives the Atlas PreStocks research path. It is not only a badge or decorative market list.

The previous 60-second Next cache stamped every read with a new capture time, allowing stale responses to appear freshly observed. The audit uses an uncached fetch with a five-second timeout and preserves the distinction between fetch time and the unavailable upstream price-observation timestamp. This increases upstream requests/latency versus the old cache; a future cache must preserve the original fetch timestamp rather than relabel stale prices as new.

PreStocks' bounty excludes projects integrating **any non-PreStocks pre-IPO tokens**. No Tessera or alternative pre-IPO product integration was found. Recognising listed-stock xStocks/Backpack metadata is not itself an alternative pre-IPO integration, but future catalogue additions require review. No blanket compliance guarantee is possible from a changing third-party catalogue.

## 9. ClawPump findings

Fresh authenticated read evidence, 23 September 2026:

| Endpoint                 | Result           | Meaning                                                                |
| ------------------------ | ---------------- | ---------------------------------------------------------------------- |
| `GET /api/v1/skills`     | 200, nine skills | Key authenticates for read access                                      |
| `GET /api/v1/pump-pairs` | 200, 173 pairs   | Real Pump.fun creation-pair catalogue                                  |
| `GET /api/v1/agents`     | 403              | Agent authorization unavailable; exact provider-side cause unconfirmed |

Request IDs: skills `253929a6-0a7d-4243-bc4c-b9532bb2b1ba`; pairs `a8c261ec-161a-4feb-b048-9b5f04a1ad82`. The production health record is a prior stored verification, not a fresh probe.

Navis implements agent create/read/link logic and self-funded launch **preflight only** (`preflight: true`, `launchSubmitted: false`). Create and launch were not exercised in this audit. The shared provider key is not proof of a Navis user's ownership; attachment requires matching provider/session wallets. Writes are not blindly retried.

Official docs describe Pump.fun custom quote assets through `pumpQuoteMint`; this is not a Meteora pool endpoint. The separate DBC builder generates its own base mint. There is no implemented, demonstrated same-token ClawPump-launch-to-Meteora-stock-pool handoff. Provider authorization alone does not fix this architecture gap. Ask the sponsors which documented flow satisfies the combined bounty; do not invent one.

## 10. Meteora findings

This is more than an unused SDK: curve construction, configuration, persisted wallet-signable intents, real RPC simulation and account reconciliation exist. The broadcast stop is deliberate.

Historical devnet evidence was independently checked with transaction status, parsed transactions and SDK account decoding:

- Config transaction: `2ugpRWuCThjzJ4rJ3JbvYBQgDMJpR3xLEap7G7s69vYXM3WWA34gHasExy1nLmjzghYtUuWZNTPv8HYHLahsyJuz`, finalized, no error, slot `502341340`.
- Pool transaction: `5JKAb2paDR6LEYGWmbKfBPrz19LCFEi3mzZHgZp8ZPA3P4ngDMEDnJy4yZwHMf5hNRatZ1F1ZpAHKnv1xZDDkXdk`, finalized, no error, slot `502341398`.
- Config: `GSMo2ZFxSG1952i3dT2hMhJLSj83AnddEboHPb2vRD2B`, DBC-owned, WSOL quote, decoded threshold `4828261555`.
- Pool: `GBG9oigRPHXLFDZxUvoKTDZdezvttHvXqrKAKi6s3dr9`; base mint `HXpEdcXfP8toHJ8wW1ETbnNpam1P3HbLeNgCcgbe1jLC`; references that config; quote reserve zero at inspection.

These prove historical SOL-quoted devnet creation, **not** deposited stock liquidity, a mainnet launch, trading/graduation or a ClawPump-origin mint. The history is independent of current release-SHA equivalence.

All eight checked PreStocks mainnet mints lacked the SDK-derived Meteora token badge. Their Token-2022 extensions require a badge. This is a genuine external blocker, not a reason to substitute fake devnet stocks or remove checks. `protocol_verified` currently checks selected account identities/relationships, not every curve/fee/supply parameter.

## 11. Pyth findings

**Not implemented / not claimed.** No live Pyth feed materially driving the product was found. PreStocks API data does not qualify as Pyth usage.

## 12. Tessera findings

**Not implemented / not claimed.** No OpenAI/Kalshi T-Token product flow was found. Adding these merely to collect a bounty could conflict with PreStocks' exclusivity rule.

## 13. Current hackathon rules and eligibility

Primary source, fetched directly on 23 September 2026: <https://hackathons.solana.com/hackathons/stocklana>.

- Page says LIVE; deadline **Friday 25 September 2026, 4:00 pm ET**. Under normal EDT conversion this is **26 September, 1:30 am IST**; the official ET wording governs.
- Judging through 2 October.
- Main track: $100,000. Overall cash prize display: $126,000, plus the Pyth non-cash prize.
- Build something making owning/using tokenized stocks better. Pick one clear wedge.
- Judges seek a real user/problem, working end-to-end demo, reason to use Solana and quality of execution.
- Register then submit before deadline. Include **at least one** GitHub, live demo or video link, not necessarily all three.
- Individuals/teams, one submission per team, original work; disclose open-source components. Edits allowed until close.

MIT license and dependency disclosure exist. Unknown-proof 404 and live PreStocks research are already implemented; stale proposed-task titles are not current defects. Registration, final submission, team uniqueness and authorship/originality declarations require owner confirmation. This audit cannot attest those account-level facts.

## 14. Sponsor eligibility matrix

| Track       | Current evidence                                                                 | Assessment                                                                                 |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Main        | Working persisted PreStocks research/policy/receipt demo                         | Plausible wedge; full live trading is not demonstrated; submission requirements unverified |
| PreStocks   | Real data materially used in research; no alternative pre-IPO integration found  | Plausible candidate, not guaranteed award/eligibility                                      |
| ClawPump    | Real reads and preflight implementation; no stock-paired Meteora launch evidence | **Bounty completion not established**                                                      |
| Meteora DBC | Real tooling plus historical SOL devnet pool; stock quote/mainnet blocked        | Partial, weaker than requested stock-oriented mainnet evidence                             |
| Pyth        | No meaningful live feed integration                                              | Not claimed                                                                                |
| Tessera     | No qualifying T-Token integration                                                | Not claimed                                                                                |

Relevant official wording:

- ClawPump: “Launch your token with a stock-paired liquidity pool using clawpump and Meteora.”
- Meteora: DBC for tokenized stocks; originality, technical soundness and post-hackathon utility. “Working code on mainnet beats slides.”
- Pyth: live financial data must do real work; centrality and integration quality matter.
- Tessera: product/use case with OpenAI or Kalshi T-Tokens.

Official resources: [ClawPump docs](https://clawpump.tech/docs), [Partner API](https://clawpump.tech/developers), [Meteora DBC](https://docs.meteora.ag/developer-guides/dbc), [DBC SDK](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk), [DBC examples](https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/examples), [PreStocks](https://prestocks.com/api/prestocks), [Tessera](https://docs.tessera.pe/), [Pyth Pro](https://docs.pyth.network/price-feeds/pro).

## 15. Production and release status

Baseline production URL: <https://navis-gilt.vercel.app>. Vercel production deployment `dpl_6SYiW7WqXXSWrQtYZEVBkjTqFJBP` was READY and its alias matched GitHub main `ae137135dec290a20ced16a2f516befcf1c63c25`.

Main is protected by the `check, smoke and submission audit` GitHub check, strict up-to-date checks and a PR requirement. Protection must not be weakened or bypassed. The cancelled catalogue/filter PR is separate from this audit and must not be merged as a shortcut.

Audit candidate SHA, final validation and release result are recorded in `NAVIS_FINAL_FIXES.md`. Until those checks establish otherwise, **audit candidate != deployed production**. No claim of release completion follows from a preview deployment or a local build.

## 16. Critical remaining blockers

1. ClawPump combined stock-paired Meteora launch is unproved, with provider authorization and documented handoff unresolved.
2. PreStocks quote token badges/mainnet prerequisites are missing; broadcasting remains intentionally disabled.
3. Real-agent treasury execution is not the Atlas research-demo flow.
4. Audit fixes require clean CI and a protected PR release; production evidence must be rerun for any newly released SHA.
5. Owner registration and submission remain unverified.

## 17. Remaining risks and proportionate next steps

Do not expand scope into trading, Pyth, Tessera or a redesign to obscure the above. Remaining bounded improvements include endpoint quotas, full receipt policy-fact replay, fixture sizing provenance, broader reconciliation assertions, stale-provider-health labelling and smoke evidence on failure. Track residual transitive dependency advisories and avoid incompatible SDK substitutions.

The bounded burst limiter deliberately fails closed for new identities at capacity and shares that capacity across scopes; mass distinct clients can temporarily deny admission. Expired entries may wait up to a sweep interval, and proxy address-header trust is an infrastructure assumption. Genesis validation adds one RPC read per transaction operation. Concurrent authentication across separate tabs is not globally serialized; the audit does not claim universal session-race prevention. A full multi-tab session-family model is outside the minimal repair.

## 18. Fresh verification evidence

- Public smoke: all listed judge pages passed; unknown decision/proof returned real 404; fresh PreStocks Oversized run persisted in PostgreSQL with retrievable proof.
- Production decision: `db461e57-701b-4181-bfd7-de263ad42eb6`; proof: `7f7836e9-57e9-41e0-b1ae-1a58049a4ee3`.
- Production auth probe at `2026-09-23T08:17:53Z`: passed replay, CSRF, revocation, other-session isolation and bounded nonce-limit checks.
- Production Chromium replay script: reload, browser restart and fresh re-sign-in all passed; restored saves returned the same agent with replayed=true and exactly one matching row. The other wallet did not see the original wallet's recovery offer. These checks created three named test agents and did not perform financial operations.
- Current authenticated ClawPump GETs and independent historical DBC chain reads described above.
- Automated scanners completed; limitations and dependency findings remain visible.
- Final candidate test/build/CI results, browser evidence and exact SHA comparison are recorded with the release handoff. A report generated before those results must not call the fixes deployed.
