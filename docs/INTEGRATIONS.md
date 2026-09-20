# Navis integration ledger

Last reviewed: 2026-09-17

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

| Capability            | Status                           | Evidence                                                                                        |
| --------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| Pair discovery        | Implemented, provider-configured | Server-only `CLAWPUMP_API_KEY`, `/pump-pairs` response, and UI source stamps.                   |
| Launch preflight      | Implemented, provider-configured | Authenticated launch form calls the server route and preserves provider payment-required state. |
| Agent link            | Implemented, provider-configured | Local agent is created first; external link failure leaves an honest draft.                     |
| Swap/launch execution | Gated                            | No fabricated creator wallet, mint, or signature is shown.                                      |

## Meteora DBC

| Capability                      | Status                       | Evidence                                                                                                                                                                           |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official SDK adapter            | Implemented                  | `@meteora-ag/dynamic-bonding-curve-sdk` version `1.5.11`; config builder test passes SDK validation.                                                                               |
| Config preview                  | Implemented, preview-only    | UI renders generated SDK parameters and labels the profile as not deployed.                                                                                                        |
| Pool read                       | Implemented, RPC-configured  | `/api/integrations/meteora/pools/[baseMint]` reads DBC pool state from the configured Solana RPC.                                                                                  |
| Config transaction preparation  | Implemented, execution-gated | `/api/integrations/meteora/config/prepare` returns an unsigned create-config transaction after wallet auth, trusted origin, live-mode flags, and RPC blockhash.                    |
| Config transaction simulation   | Implemented, execution-gated | `/api/integrations/meteora/config/simulate` checks the prepared message hash, authenticated payer, and required signatures before RPC simulation.                                  |
| Config transaction submission   | Implemented, execution-gated | `/api/integrations/meteora/config/submit` requires an owned live-mode agent and persists only the real `sendRawTransaction` signature.                                             |
| Config transaction confirmation | Implemented, RPC-configured  | `/api/integrations/meteora/config/confirm` reconciles submitted records to `confirmed`, `unknown_pending`, or `failed` from Solana RPC status.                                     |
| Pool transaction preparation    | Implemented, execution-gated | `/api/integrations/meteora/pool/prepare` requires owned confirmed config evidence, creates an unsigned transaction, and returns the derived pool address as preview evidence only. |
| Pool transaction simulation     | Implemented, execution-gated | `/api/integrations/meteora/pool/simulate` checks the prepared message hash, authenticated payer, and required signatures before RPC simulation.                                    |
| Pool transaction submission     | Implemented, execution-gated | `/api/integrations/meteora/pool/submit` persists base mint, derived pool address, and only the real pool transaction signature returned by RPC.                                    |
| Live pool proof                 | External blocker             | Requires configured RPC, authenticated wallet, funded devnet/mainnet account, and successful onchain execution.                                                                    |

### Navis equity-themed DBC profile

This is a conservative product default for SOL-quoted community assets. It is
not investment advice and does not claim that any token represents regulated
equity.

| Field                     | Value                                                                        |
| ------------------------- | ---------------------------------------------------------------------------- |
| Profile id                | `navis-equity-v1`                                                            |
| SDK version               | `1.5.11`                                                                     |
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

## Audit notes

- Meteora read calls require `SOLANA_RPC_URL`; without it the API returns an
  explicit unavailable state.
- Meteora config and pool transaction preparation, simulation, submission, and
  confirmation are available only in configured devnet/mainnet execution modes.
  Live pool proof remains dependent on RPC access, wallet approval, funding, and
  chain confirmation.
- PreStocks is a read-only catalogue integration. The UI discloses that provider
  tokens represent economic exposure only, are risky, and are not available to
  U.S. persons or other restricted users; Navis does not expose a PreStocks
  execution path.
- Known production dependency audit issues remain in transitive Solana/Meteora
  dependency chains (`bigint-buffer`, `stream-json` through `jayson`, `toml`
  through Anchor, and `uuid`). Non-forced `npm audit fix` was attempted; no
  durable safe fix is currently available without changing upstream dependency
  choices or using breaking/forced updates.
