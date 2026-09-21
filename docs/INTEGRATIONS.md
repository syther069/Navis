# Navis integration ledger

Last reviewed: 2026-09-20

This ledger records the current integration truth for Navis. It is intentionally
strict: a provider, account, transaction, or market is listed as live only when
the product can prove it from configuration, RPC, a provider response, or a
confirmed onchain result.

## Execution modes

| Mode    | Current product behavior                                                                                   | Required evidence before live execution                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Demo    | Local demo fixtures and deterministic service results are allowed.                                         | None beyond repository fixtures and tests.                                                                                         |
| Devnet  | Read-only RPC paths are allowed when `SOLANA_RPC_URL` is set and the environment enables devnet execution. | Wallet authentication, funded devnet wallet, RPC health, decoded unsigned transaction, simulation result, and confirmed signature. |
| Mainnet | Mainnet execution remains gated by explicit environment flags and real RPC configuration.                  | The same evidence as devnet plus production policy approval and funded wallet consent.                                             |

## ClawPump

Official references: https://clawpump.tech/developers (Partner API v1), https://clawpump.tech/docs, https://clawpump.tech/guide. Base URL `https://clawpump.tech/api/v1`, `Authorization: Bearer cpk_...`, apex host only. The API has no devnet or cluster selector; launches are Solana mainnet. `/pump-pairs` lists Pump.fun creation pairs, not Meteora pools.

| Capability              | Status                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client hardening        | Implemented                      | Bounded retry with backoff for idempotent GETs on 429/5xx (honours `Retry-After`), POSTs never retried, FIFO concurrency cap, credential-free errors. `tests/clawpump-client.test.ts`.                                                                                                                                                                                                                            |
| Provider verification   | Implemented, provider-configured | `GET /agents` (fallback `GET /skills`) through `probeAvailability`; sanitised `external_calls` row `provider_verification` (status, request id, provider timestamp, agent ids, network, safe error). Shown on Markets, Settings and `/api/health`; "Provider connected" only from a stored real 200.                                                                                                              |
| Agent link              | Implemented, provider-configured | Owner action `POST /api/agents/{slug}/clawpump-link` on a saved persistent agent: create via `POST /agents` or attach an id the key lists under `GET /agents`. Atlas and public demo rows refused; one link per agent, one Navis agent per external id. `GET` refreshes identity and token address via `GET /agents/{id}`.                                                                                        |
| Pair discovery          | Implemented, provider-configured | `/pump-pairs` annotated with cluster (mainnet, provider contract), token program read from the mint on mainnet (fail-closed), classification (wrapped SOL, stablecoin, tokenized stock via PreStocks mint match or on-chain Token-2022 issuer metadata for Backed xStocks and Backpack Securities, unconfirmed). No SOL or stablecoin pair is presented as a stock pair; no Meteora pool is linked at pair level. |
| Launch preflight        | Implemented, provider-configured | `POST /launch/self-funded` with `preflight: true` plus `GET /launch/self-funded?quoteMint=` cost discovery. Local checks: ownership, link status, quote asset classification, fee range. Prerequisites: network (mainnet only), payer wallet match, mainnet funding, token program, execution flag. Provider codes 402/403/409/422 mapped. Only the token SHA-256 is stored.                                      |
| Launch states           | Modelled, never rendered as live | `lib/integrations/clawpump/state.ts`: "Launch submitted" and "Launch verified onchain" render only when a stored `market_launches` row carries a real signature. Navis writes none.                                                                                                                                                                                                                               |
| Funded launch execution | Unsupported in current posture   | Nothing pays, signs or broadcasts. The remaining bounty step is an authorised, funded mainnet wallet action outside this scope.                                                                                                                                                                                                                                                                                   |

## Meteora DBC

| Capability                      | Status                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official SDK adapter            | Implemented                  | The package lock resolves `@meteora-ag/dynamic-bonding-curve-sdk` version `1.5.12`; the fresh baseline tests passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Config preview                  | Implemented, preview-only    | UI renders the exact SDK `1.5.12` generated configuration and labels the profile as not deployed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Pool read                       | Implemented, RPC-configured  | `/api/integrations/meteora/pools/[baseMint]` reads DBC pool state from the configured Solana RPC.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Config transaction preparation  | Implemented, execution-gated | `/api/integrations/meteora/config/prepare` returns an unsigned create-config transaction after wallet auth, trusted origin, live-mode flags, and RPC blockhash.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Config transaction simulation   | Implemented, execution-gated | `/api/integrations/meteora/config/simulate` checks the prepared message hash, authenticated payer, and required signatures before RPC simulation.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Config transaction submission   | Intent-bound, hard-blocked   | `/api/integrations/meteora/config/submit` accepts only a server-prepared intent ID plus signed bytes, checks owner, cluster, expiry, message hash and simulation, derives the signature from the signed bytes and persists `submitting` with that signature on the intent and launch before send. Repeated submits for a submitting, submitted, unknown_pending or consumed intent return the stored record and never send twice. Broadcast itself is hard-blocked in every mode pending review; no evidence migration `0006` is applied anywhere.                                                  |
| Config transaction confirmation | Implemented, RPC-configured  | `/api/integrations/meteora/config/confirm` reconciles submitting, submitted, unknown_pending and signature_confirmed config and pool records from Solana RPC status, then decodes the promised config or pool account and labels the result `protocol_verified`, `signature_confirmed` (signature landed, account not yet readable) or `evidence_incomplete` (account missing fields or mismatched). Slot, fee and verified account address are stored separately in launch metadata and shown on the transactions ledger and pool monitor. Only `protocol_verified` moves a launch to `confirmed`. |
| Pool transaction preparation    | Implemented, execution-gated | `/api/integrations/meteora/pool/prepare` requires owned confirmed config evidence, creates an unsigned transaction, and returns the derived pool address as preview evidence only.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Pool transaction simulation     | Implemented, execution-gated | `/api/integrations/meteora/pool/simulate` checks the prepared message hash, authenticated payer, and required signatures before RPC simulation.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Pool transaction submission     | Intent-bound, hard-blocked   | Same intent binding as config submission; a second pool intent is refused once the launch has moved. Broadcast is hard-blocked in every mode until the protocol is retested on a real cluster.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Live pool proof                 | External blocker             | Requires configured RPC, authenticated wallet, funded devnet/mainnet account, and successful onchain execution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Quote profiles (server-approved allowlist)

The quote mint is never a client value. Clients send a profile id; the server
resolves it against an allowlist in `lib/integrations/meteora/quote-profiles.ts`.
Unknown ids are rejected with HTTP 400, profiles that do not exist on the active
cluster with HTTP 409. The resolved profile id and quote mint are persisted on
the execution intent (`accounts_summary.quote`), and copied to the launch record
(`market_launches.quote_mint`, `metadata.quoteProfileId`) at submit time. Pool
derivation reads the quote mint from the confirmed launch record only.

| Profile                   | Quote                                                                            | Clusters                                                                                                                                                                                             | Curve band                |
| ------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `navis-equity-v1`         | Wrapped SOL `So11111111111111111111111111111111111111112`, 9 decimals            | devnet, mainnet-beta                                                                                                                                                                                 | 2 SOL to 20 SOL           |
| `navis-stock-exposure-v1` | A PreStocks exposure token, chosen by symbol from the live catalogue, 9 decimals | mainnet-beta only, and gated: the mint must carry a Meteora DBC token badge. On devnet it is unavailable ("PreStocks issues its exposure tokens on mainnet only"). No fake mint is ever substituted. | 200 to 2,000 quote tokens |

For `navis-stock-exposure-v1` the server fetches `https://prestocks.com/api/prestocks`
at prepare time, takes the `contract_address` for the requested symbol, then reads
the mint account over RPC and refuses anything that is not an SPL Token or
Token-2022 mint with 9 decimals (the catalogue does not publish decimals; the
live PreStocks mints are Token-2022 with 9 decimals, checked on mainnet on
2026-09-20). The verification result (token program, decimals, extensions,
token badge, slot) is stored with the intent.

Token badge gate. The live PreStocks mints carry Token-2022 extensions that the
DBC program only accepts on a quote mint when Meteora has issued a token badge
PDA for it (`permanentDelegate`, `transferHook`, `transferFeeConfig`,
`pausableConfig`, `defaultAccountState`, `confidentialTransferMint`,
`scaledUiAmountConfig`, observed on SPACEX on 2026-09-20). Navis derives the
badge address with the SDK and reads it onchain; if it is missing, preparation
is refused with HTTP 409 and the reason. When present, the badge is passed to
both `createConfig` and `createPool`. As of 2026-09-20 no badge exists for
SPACEX, OPENAI or ANTHROPIC, so the profile is shown as "gated" on mainnet and
cannot produce a transaction yet. Only Meteora can issue badges; Navis does not
bypass the check.

Pool derivation reads the confirmed config account onchain and refuses to derive
a pool when the config's quote mint differs from the launch record.

#### Curve rationale

- Price band: both profiles use a 10x band from launch to graduation. The SOL
  profile runs 2 SOL to 20 SOL; the stock-paired profile runs 200 to 2,000
  PreStocks tokens so the price path follows stock exposure, not SOL volatility.
- Fee schedule: flat 1% base fee (100 bps, linear scheduler with zero periods)
  with Meteora dynamic fees enabled. Front-loaded fees were rejected because
  PreStocks tokens trade thinly and would punish early liquidity.
- Graduation threshold: computed by the SDK from the band. SOL profile
  `4828261560` lamports (4.82826156 SOL); stock-paired profile `482826156061`
  raw units (482.826156061 quote tokens).
- Locked liquidity: 10% of migrated liquidity is permanently locked (5% partner,
  5% creator) in DAMM v2. The remainder is claimable and disclosed as such.
- Issuer and treasury: base token authority is immutable. Trading and migration
  fees are split 50/50 between the Navis partner key and the creator wallet. The
  agent treasury never holds the fee claimer role. For the stock-paired profile
  PreStocks is the issuer of the quote token; Navis controls only the base token
  and inherits PreStocks issuer risk and U.S. person restrictions.

#### Status and devnet rehearsal

No Meteora config, pool, or transaction signature exists on any cluster from
this codebase. Broadcast is hard-blocked in every mode. The stock-paired profile
cannot be rehearsed on devnet at all because no PreStocks mint exists there, and
on mainnet it is gated until Meteora issues a token badge for a PreStocks mint;
mainnet execution flags remain off in any case.

Owner devnet rehearsal of `navis-equity-v1` (the only profile available there):

1. Set `EXECUTION_MODE=devnet`, `ENABLE_DEVNET_EXECUTION=true`, a devnet
   `SOLANA_RPC_URL`, `DATABASE_URL`, and `SESSION_SECRET`; create a devnet agent.
2. Connect and authenticate a funded devnet wallet on `/markets/launch`.
3. Select profile `navis-equity-v1`, prepare, sign, simulate.
4. Record in `docs/EVIDENCE.md`: intent id, `messageSha256`, `feePayer`,
   `accounts.config`, `accounts.quoteMint` (must equal wrapped SOL), the
   simulation `contextSlot`, `unitsConsumed`, and `error` (must be null).
5. Submission stays blocked until the broadcast gate is lifted in a separate
   reviewed change; do not record a signature that does not exist.

### Navis equity-themed DBC profile (`navis-equity-v1`)

This is a conservative product default for SOL-quoted community assets. It is
not investment advice and does not claim that any token represents regulated
equity. Figures below are for `navis-equity-v1`; `navis-stock-exposure-v1`
shares every field except the quote mint, the market-cap band and the threshold.

| Field                     | Value                                                                        |
| ------------------------- | ---------------------------------------------------------------------------- |
| Profile id                | `navis-equity-v1`                                                            |
| SDK version               | `1.5.12`                                                                     |
| Program id                | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`                                |
| Quote mint                | `So11111111111111111111111111111111111111112`                                |
| Token standard            | SPL Token                                                                    |
| Base decimals             | `6`                                                                          |
| Quote decimals            | `9`                                                                          |
| Token authority           | Immutable                                                                    |
| Total supply              | `1000000000`                                                                 |
| Leftover supply           | `0`                                                                          |
| Initial market cap        | `2 SOL`                                                                      |
| Migration market cap      | `20 SOL`                                                                     |
| Exact migration threshold | `4828261560` lamports, or `4.82826156 SOL`                                   |
| Base trading fee          | `100` bps                                                                    |
| Dynamic fee               | Enabled                                                                      |
| Creator trading fee share | `50%`                                                                        |
| Migration destination     | Meteora DAMM v2                                                              |
| Migration fee             | Fixed `200` bps with `50%` creator share                                     |
| LP distribution           | Partner `50%` claimable / `5%` locked; creator `40%` claimable / `5%` locked |
| Permanent LP lock         | `10%` total                                                                  |

## PreStocks

| Capability        | Status                | Evidence                                                                                                                                                                                                                         |
| ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API source        | Documented dependency | `PRESTOCKS_API_URL` defaults to `https://prestocks.com/api/prestocks`.                                                                                                                                                           |
| Response schema   | Verified live         | `/api/prestocks` returns token records with `contract_address`, price, valuation, supply, and source links.                                                                                                                      |
| Catalogue adapter | Implemented read-only | `lib/integrations/prestocks/client.ts` validates the live response and never substitutes ticker symbols for mints.                                                                                                               |
| Read-only API     | Implemented           | `GET /api/assets/prestocks` returns the validated catalogue plus read-only action/disclosure metadata, or a safe unavailable response.                                                                                           |
| Product surface   | Implemented read-only | `components/markets/prestocks/prestocks-catalogue.tsx` displays the catalogue, source timestamp, exact mint, and eligibility disclosure.                                                                                         |
| Value movement    | Not implemented       | Navis exposes no PreStocks buy/sell/launch path; acknowledgement persistence is deferred until a value-moving PreStocks action exists.                                                                                           |
| Asset universe    | Implemented (demo)    | `lib/integrations/prestocks/research.ts` builds the Atlas demo universe from validated `contract_address` values; `lib/services/run-decision.ts` evaluates policy against it. In-memory Atlas runs only.                         |
| Research facts    | Implemented           | Premium or discount (token price vs mark price), mark vs implied valuation gap, supply and allocation concentration, shown on `/markets/launch` and in every PreStocks-universe run result. Research data, not execution quotes. |

Preview evidence on 2026-09-20: HTTP 200, 8 assets, provider capture timestamp
`2026-09-20T08:29:20.874Z`, schema validation passed, `readOnly=true`, and
`valueMovementAvailable=false`. This proves catalogue availability, not trading.

### PreStocks as the demo asset universe

The Atlas demo run (`POST /api/decisions/run`, `universe: "prestocks" | "fixture"`,
default `prestocks`) can evaluate against the PreStocks catalogue instead of the
four fictional fixture tokens:

- Allowed mints and the strategy universe are the validated `contract_address`
  values. The derived strategy and risk policy get their own hashes and `_prestocks`
  ids, so the receipt binds exactly the documents that were evaluated.
- Freshness (`max_data_age_seconds`) is measured from Navis's catalogue read time,
  which is stated as such. It is not an upstream quote timestamp. The client caches
  for 60 seconds, inside the 300-second Atlas limit; a stale read fails the rule.
- Token price is the only price fact (`priceUsdMicros` in `marketInputs`, source
  `prestocks_catalogue`). The catalogue publishes no liquidity and no executable
  quote, so no liquidity value and no quote expiry are supplied: the liquidity rule
  warns instead of using an invented number, and the quote-expiry check is absent.
- The fictional research portfolio holds every usable asset, weighted from the
  agent's own limits around a 400 USD reference (rotation source 2.5x the trade
  limit, rotation target a quarter of the position limit, the rest shared
  equally). Quantities are whole base units and each value is recomputed from
  that quantity at the token price. The proposal rotates the asset with the
  richest token-price premium into the asset with the deepest discount; the
  scenario ("balanced" or "oversized") only sets the intended trade size in USD,
  and the deterministic provider sells exactly the quantity worth that much,
  capped at the holding. Policy facts are then measured from the proposal:
  trade value = proposal amount x token price, every post-trade position = the
  starting holding moved by exactly that value (value for value, before
  slippage), turnover = that trade. A proposal that sells more than the
  portfolio holds, or a mint it does not hold, is refused as infeasible rather
  than evaluated. The reserve floor still comes from the scenario because the
  research portfolio has no cash leg; the run result says so. The result shows
  each asset's premium or discount, mark vs implied valuation gap, supply, and
  each holding before and after the trade as a share of the portfolio and of
  the asset's implied valuation.
- Assets are `provider_verified` with 9 decimals (the documented Token-2022
  check; the catalogue itself does not publish decimals) and labelled
  `mainnet-beta`, the only cluster where the mints exist. The run stays in demo
  mode: nothing is executed, and no PreStocks execution path exists.
- The receipt carries `dataSource` (universe, source, source URL, read time, asset
  count, note). Fixture runs record `universe: "fixture"` with no source URL.
- Rows the schema rejects (bad symbol, zero mark price, duplicate or invalid mint)
  are excluded and listed, never patched. Fewer than two usable assets, a network
  failure or a validation failure fall back to the fixture universe with a visible
  note on the run result; no value is ever fabricated.
- Persisted (database) agents keep their stored allowlist; a PreStocks request for
  them runs the fixture universe and says so.

## Audit notes

- Meteora read calls require `SOLANA_RPC_URL`; without it the API returns an
  explicit unavailable state.
- Meteora config and pool transaction preparation, simulation, submission, and
  confirmation remain disabled for live use. All live flags are false. Server-prepared
  intent and simulation binding is implemented and tested. The broadcast-error path
  now records the signature before the send; a send error that is not a clear
  preflight rejection leaves the record `unknown_pending` with the signature, and
  reconciliation settles it later. Broadcast still stays hard-blocked before live
  release.
- Local remediation now also hard-blocks both Meteora broadcast endpoints regardless
  of environment toggles. Configuration/simulation inspection remains available when
  its existing prerequisites are configured. New config confirmations require
  complete, consistent successful RPC transaction evidence and real block time.
  This safety block is not completion of the missing live transaction protocol.
- Meteora prepare now stores a 90-second execution intent containing the owner,
  cluster, blockhash, signer set, accounts, and message hash. Simulation and submit
  accept that intent id instead of trusting client-supplied launch details or hashes.
  Submit locks the intent, derives the transaction signature from the signed bytes and
  persists `submitting` with that signature before an RPC broadcast, so retries return
  the stored record instead of broadcasting the same intent twice. No live broadcast
  was tested.
- ClawPump `/launch/self-funded` has no documented devnet or cluster selector.
  Current Navis posture supports preflight only. A funded launch requires an
  owner-approved mainnet release plus safe paid-retry, signature, and persistence
  code. No automatic launch is permitted.
- Fresh public PreStocks evidence on 2026-09-20: HTTP 200, eight assets, read-only,
  no value movement. See `docs/evidence/stocklana-prestocks-read.json`. Catalogue
  read time is not a verified upstream quote timestamp; local UI/API disclosures
  now make that distinction explicit.
- PreStocks is a read-only catalogue integration. The UI discloses that provider
  tokens represent economic exposure only, are risky, and are not available to
  U.S. persons or other restricted users; Navis does not expose a PreStocks
  execution path.
- `npm audit --omit=dev` reports 19 production advisories: 6 high, 13 moderate,
  and no critical findings. They are inherited through Solana/Meteora chains and
  remain unresolved. Do not use a forced update or change core dependencies
  without a full compatibility pass.

## Official source verification

Sources were fetched on 2026-09-20:

- ClawPump Partner API: https://clawpump.tech/developers. It documents the `https://clawpump.tech/api/v1` base URL, `Authorization: Bearer cpk_...`, `GET /pump-pairs`, `POST /launch`, and `GET` and `POST /launch/self-funded`. No devnet or cluster selector is documented for the self-funded launch flow.
- ClawPump documentation and guide: https://clawpump.tech/docs and https://clawpump.tech/guide. Both were accessible. No authenticated Navis launch was performed.
- Meteora DBC guide and TypeScript SDK getting started: https://docs.meteora.ag/developer-guides/dbc and https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/getting-started. They document the official SDK, Solana dependencies, and the DBC program ID.
- Meteora SDK repository: https://github.com/MeteoraAg/dynamic-bonding-curve-sdk. The installed lock resolves `1.5.12`.
- PreStocks products and API: https://prestocks.com/products and https://prestocks.com/api/prestocks. The API was accessible and returned `contract_address`. Public disclosures state economic exposure only, no ownership or voting rights, possible total loss, no guaranteed liquidity, and U.S. and other eligibility restrictions.
