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

| Capability              | Status                           | Evidence                                                                                                                                                                      |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pair discovery          | Implemented, provider-configured | Server-only `CLAWPUMP_API_KEY`, `/pump-pairs` response, and UI source stamps.                                                                                                 |
| Launch preflight        | Implemented, provider-configured | Focused tests cover sanitized provider errors and exact terms, pair, and payment evidence. The raw preflight token is never persisted or returned; only its hash is retained. |
| Agent link              | Implemented, provider-configured | Local agent is created first; external link failure leaves an honest draft.                                                                                                   |
| Funded launch execution | Unsupported in current posture   | The official `/launch/self-funded` flow has no devnet or cluster selector. Navis currently implements preflight only. Demo/devnet cannot safely execute it.                   |

## Meteora DBC

| Capability                      | Status                       | Evidence                                                                                                                                                                           |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official SDK adapter            | Implemented                  | The package lock resolves `@meteora-ag/dynamic-bonding-curve-sdk` version `1.5.12`; the fresh baseline tests passed.                                                               |
| Config preview                  | Implemented, preview-only    | UI renders the exact SDK `1.5.12` generated configuration and labels the profile as not deployed.                                                                                  |
| Pool read                       | Implemented, RPC-configured  | `/api/integrations/meteora/pools/[baseMint]` reads DBC pool state from the configured Solana RPC.                                                                                  |
| Config transaction preparation  | Implemented, execution-gated | `/api/integrations/meteora/config/prepare` returns an unsigned create-config transaction after wallet auth, trusted origin, live-mode flags, and RPC blockhash.                    |
| Config transaction simulation   | Implemented, execution-gated | `/api/integrations/meteora/config/simulate` checks the prepared message hash, authenticated payer, and required signatures before RPC simulation.                                  |
| Config transaction submission   | Pre-live security gate open  | The older incomplete protocol was not ported or enabled. Server-prepared/simulation binding and the broadcast-error path remain unresolved.                                        |
| Config transaction confirmation | Implemented, RPC-configured  | `/api/integrations/meteora/config/confirm` reconciles submitted records to `confirmed`, `unknown_pending`, or `failed` from Solana RPC status.                                     |
| Pool transaction preparation    | Implemented, execution-gated | `/api/integrations/meteora/pool/prepare` requires owned confirmed config evidence, creates an unsigned transaction, and returns the derived pool address as preview evidence only. |
| Pool transaction simulation     | Implemented, execution-gated | `/api/integrations/meteora/pool/simulate` checks the prepared message hash, authenticated payer, and required signatures before RPC simulation.                                    |
| Pool transaction submission     | Pre-live security gate open  | No live submission is allowed until the server binds signed input to a previously prepared proposal and the full protocol is retested.                                             |
| Live pool proof                 | External blocker             | Requires configured RPC, authenticated wallet, funded devnet/mainnet account, and successful onchain execution.                                                                    |

### Navis equity-themed DBC profile

This is a conservative product default for SOL-quoted community assets. It is
not investment advice and does not claim that any token represents regulated
equity.

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

| Capability        | Status                | Evidence                                                                                                                                 |
| ----------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| API source        | Documented dependency | `PRESTOCKS_API_URL` defaults to `https://prestocks.com/api/prestocks`.                                                                   |
| Response schema   | Verified live         | `/api/prestocks` returns token records with `contract_address`, price, valuation, supply, and source links.                              |
| Catalogue adapter | Implemented read-only | `lib/integrations/prestocks/client.ts` validates the live response and never substitutes ticker symbols for mints.                       |
| Read-only API     | Implemented           | `GET /api/assets/prestocks` returns the validated catalogue plus read-only action/disclosure metadata, or a safe unavailable response.   |
| Product surface   | Implemented read-only | `components/markets/prestocks/prestocks-catalogue.tsx` displays the catalogue, source timestamp, exact mint, and eligibility disclosure. |
| Value movement    | Not implemented       | Navis exposes no PreStocks buy/sell/launch path; acknowledgement persistence is deferred until a value-moving PreStocks action exists.   |

Preview evidence on 2026-09-20: HTTP 200, 8 assets, provider capture timestamp
`2026-09-20T08:29:20.874Z`, schema validation passed, `readOnly=true`, and
`valueMovementAvailable=false`. This proves catalogue availability, not trading.

## Audit notes

- Meteora read calls require `SOLANA_RPC_URL`; without it the API returns an
  explicit unavailable state.
- Meteora config and pool transaction preparation, simulation, submission, and
  confirmation remain disabled for live use. All live flags are false. The original
  broadcast-error path does not guarantee that every transport timeout persists as
  `unknown_pending`; server-prepared and simulation binding must also be completed
  before live release.
- ClawPump `/launch/self-funded` has no documented devnet or cluster selector.
  Current Navis posture supports preflight only. A funded launch requires an
  owner-approved mainnet release plus safe paid-retry, signature, and persistence
  code. No automatic launch is permitted.
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
