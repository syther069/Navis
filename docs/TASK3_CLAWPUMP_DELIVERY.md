# Task 3 delivery: real ClawPump verification, agent link and stock-pair preflight

Status date: 2026-09-21. Scope: the Stocklana ClawPump track. Nothing in this task pays for, signs or broadcasts a launch.

## 1. Official requirements re-checked on 2026-09-21

Source: https://clawpump.tech/developers (Partner API v1), https://clawpump.tech/docs, https://clawpump.tech/guide.

| Item                | Finding                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL and auth   | `https://clawpump.tech/api/v1`, `Authorization: Bearer cpk_...` on every request, apex host only (`agents.clawpump.tech` drops the header on redirect and fails with 401). Unchanged.                                                                                           |
| Read-only endpoints | `GET /skills`, `GET /agents`, `GET /agents/{id}`, `GET /pump-pairs`, `GET /launch/self-funded?quoteMint=` (cost estimate). Unchanged.                                                                                                                                           |
| Preflight           | `POST /launch/self-funded` with `preflight: true` answers 200 with the exact SOL amount, `payTo`, `payFrom` and a signed `preflightToken`; it launches nothing. The paid retry needs the same pair and fee plus a real SOL transfer.                                            |
| Quote assets        | `GET /pump-pairs` lists Pump.fun creation pairs (`mint`, `symbol`, `name`, `decimals`, `imageUrl`) and `creatorFeeBps` 100 to 300, default 100. The page does not name which mints are tokenized stocks and does not mention Meteora at all.                                    |
| Wallet              | `walletAddress` pays for the launch and receives the agent's 75% creator-fee share in the paired asset; it becomes the agent's registered payout wallet. A later different wallet is refused with `WALLET_ADDRESS_MISMATCH` (HTTP 400).                                         |
| Network             | No devnet or cluster selector anywhere. x402 terms are "Solana mainnet, asset USDC". All launches are mainnet.                                                                                                                                                                  |
| Errors              | 401 key, 402 payment terms, 403 agent not owned or key not linked, 422 `missing` / `invalidFields`, 429 back off and retry, 500/502 retry with backoff. Launch codes: `PAYMENT_*`, `PREFLIGHT_TOKEN_INVALID`, `WALLET_ADDRESS_MISMATCH`, `LAUNCH_BLOCKED`, `RESERVED_AGENT_ID`. |
| Rate limits         | No burst ceiling documented; "10 or fewer in-flight requests is a safe start". Monthly quota counted but not enforced today. No `Retry-After` is documented; the client honours it if present.                                                                                  |

## 2. Credential status and first real requests

`CLAWPUMP_API_KEY` (a `cpk_` Partner key) was supplied through the workspace secrets flow on 2026-09-21 and is stored as a server secret only. First real authenticated requests from this workspace, all read-only:

| Request                                     | Result                                                                                                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /skills`                               | HTTP 200, request id `f69e356c-6873-4c85-b78a-067d2b9fa6fc`, provider timestamp `2026-09-21T16:19:19.546Z`; without the key the same endpoint answers 401, so the key authenticates.     |
| `GET /agents`                               | HTTP 403 `Failed to list agents`: the key is not linked to a ClawPump account yet. Agent create, attach and launch preflight are refused by the provider until ClawPump links the key.   |
| `GET /pump-pairs`                           | HTTP 200, request id `345d2edc-7399-4f3b-af84-104dc99e9719`, 169 creation pairs, creator fee 100 to 300 bps (default 100).                                                               |
| `GET /launch/self-funded?quoteMint=TSLA...` | HTTP 200: `paymentMethod: sol`, `creationFeeSol 0.009218`, `standardCostSol 0.009218`, `payTo 49CfXAr58cCTGJnYsbm16fEsE5JRpdR8QQP8E1ZinGCq`, quote valid 900 s. Read-only; nothing paid. |

Stored verification row (development database, `external_calls.operation = provider_verification`): result `connected`, endpoint `/skills`, HTTP 200, `agentAccess: forbidden` with the sanitised 403 text. The probe treats 401 as a bad key and stops; a 403 on `/agents` falls back to `/skills` so the credential is proven while the missing account link is recorded and shown on Markets, Settings and `/api/health`.

Stock-pair classification finding: none of the live stock pairs is a PreStocks mint. They are Backed xStocks (`Xs...` mints, metadata URI host `xstocks-metadata.backed.fi`, update authority `5aMNNLQJwAEeoemTEMkv5NVjqKwvvefRYCQ5Z67HFvEq`) and Backpack Securities mints (hosts `metadata.backpack.exchange` and `trek-labs.github.io`, update authority `2cVYpagTt7ZGc3mmTXBa7fAznUtx5DUu6aCq8uVDaf4a`). Classification therefore also reads the Token-2022 on-chain metadata of every mint (mainnet `getMultipleAccounts`, 100 mints per call) and marks a pair as a tokenized stock only when both the URI host and the update authority match one of those issuers. Result on the live catalogue: 77 tokenized-stock pairs, 1 wrapped SOL, 1 stablecoin, 90 unclassified (BTC, ETH, memecoins). Symbols alone classify nothing; an unverified mint read leaves the pair unclassified.

Still blocked by the provider (not by Navis): linking a Navis agent to a real ClawPump identity and a real preflight quote, both of which need `GET /agents` and `POST /agents` to stop answering 403 for this key.

## 3. What was built

| Area                 | Delivered                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client (only client) | Bounded retry with exponential backoff for idempotent GETs on 429 and 5xx, `Retry-After` honoured and capped, POSTs never retried, FIFO concurrency cap (4), `GET /launch/self-funded` cost discovery, `probeAvailability()` reporting connected / unauthorised / unreachable from a real response. Errors stay credential-free.                                                                                                                                           |
| Verification records | `lib/services/clawpump-verification.ts` runs `GET /agents` (fallback `GET /skills`) and stores a sanitised `external_calls` row (`operation = provider_verification`): timestamp, provider timestamp, endpoint, HTTP status, validated response type, request id, agent ids, network (mainnet, from the provider contract), result, safe error. No key material, no raw bodies. `GET/POST /api/integrations/clawpump/verification`.                                        |
| Connected status     | Markets Launch, Settings and `/api/health` say "Provider connected" only when the latest stored record is a real 200. Without a key they say "Provider not configured" and name `CLAWPUMP_API_KEY` (a `cpk_` Partner key).                                                                                                                                                                                                                                                 |
| Agent link           | `POST /api/agents/{slug}/clawpump-link` on a saved persistent agent: `create` (calls `POST /agents`) or `attach` (an id listed by `GET /agents` under the key). Atlas and public demo rows are refused, one link per agent, one Navis agent per external id. `GET` refreshes id, wallet and token address through `GET /agents/{id}`. The agent form no longer hardcodes ClawPump as unavailable; the agent detail page shows the link panel.                              |
| Stock-pair discovery | `lib/integrations/clawpump/pairs.ts` annotates every `/pump-pairs` asset with cluster (mainnet), token program read from the mint on mainnet (fail-closed), classification (wrapped SOL, stablecoin, tokenized stock by PreStocks mint match, unconfirmed). Honest empty state when no stock pair qualifies. Pairs are labelled Pump.fun creation pairs; no Meteora pool is linked.                                                                                        |
| Preflight            | Owner and link checks, quote asset classification (SOL and stablecoins rejected locally), live fee range, network (mainnet only), payer wallet match, mainnet funding from `getBalance`, token program, execution flag, cost discovery, provider codes 402/403/409/400/422 mapped. Result carries `prerequisites`, `readyForAuthorisedExecution`, `launchSubmitted: false` and the statement that nothing was launched. Only the SHA-256 of the preflight token is stored. |
| State model          | `lib/integrations/clawpump/state.ts`: not configured, connected, agent linked, stock pair discovered, preflight successful, preflight rejected, launch not submitted; "Launch submitted" and "Launch verified onchain" render only from a stored `market_launches` row with a real signature. Navis writes none today.                                                                                                                                                     |

## 4. Tests

| Scenario                                   | Test                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Valid response records connected           | `tests/clawpump-verification.test.ts`                                                                   |
| 401 or expired key                         | `tests/clawpump-verification.test.ts`, `tests/clawpump-link-preflight.test.ts`                          |
| Timeout                                    | `tests/clawpump-verification.test.ts`, `tests/clawpump-client.test.ts`                                  |
| Unexpected schema                          | `tests/clawpump-verification.test.ts`                                                                   |
| Unsupported quote asset (local rejection)  | `tests/clawpump-link-preflight.test.ts`, `tests/clawpump-pairs.test.ts`                                 |
| Insufficient funding                       | `tests/clawpump-link-preflight.test.ts`                                                                 |
| Wrong network                              | `tests/clawpump-link-preflight.test.ts`                                                                 |
| Duplicate link, Atlas, external id in use  | `tests/clawpump-link-preflight.test.ts`                                                                 |
| Verification-record persistence            | `tests/clawpump-verification.test.ts` (insert), `tests/clawpump-link-preflight.test.ts` (evidence rows) |
| Preflight vs launch distinction            | `tests/clawpump-link-preflight.test.ts`, state gating in `tests/clawpump-verification.test.ts`          |
| Retry, backoff, Retry-After, POST no retry | `tests/clawpump-client.test.ts`                                                                         |
| Health credential naming                   | `tests/health-route.test.ts`                                                                            |

These tests use mocked transports and a rolled-back development database transaction. They are not production evidence.

Gate: see section 6.

## 5. Production verification

Deployment: https://navis-gilt.vercel.app

| Item                    | Value                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Real authenticated call | Not performed. Blocked: `CLAWPUMP_API_KEY` is not available in this workspace or on Vercel. |
| Provider request id     | None                                                                                        |
| Stored verification row | None                                                                                        |
| What production shows   | "Provider not configured", naming `CLAWPUMP_API_KEY` (a `cpk_` Partner key)                 |

To complete the live steps once a key exists: set `CLAWPUMP_API_KEY` in the Vercel project, redeploy, open `/markets/launch` (or `POST /api/integrations/clawpump/verification` while signed in), then read `/api/health` `services.clawpump`. Copy the request id, endpoint, HTTP status and timestamp from the stored record into this table.

## 6. Gate, commit and remaining work

Gate result and commit hash are appended below by the delivery step.

Remaining bounty requirements outside this task: a funded Solana mainnet launch through an authorised wallet action (a separate execution step that pays the quoted SOL from the registered payout wallet), then an onchain verification of the resulting mint. Navis does not claim the full "Stocknized Agent" bounty.
