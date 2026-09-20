# Navis attributions

Updated: 2026-09-19.

Navis is original application work built for the Stocklana hackathon. It uses the open-source libraries and sponsor resources below; final submission materials should link this file rather than implying that framework, wallet, chain, or sponsor SDK code was authored by the Navis team.

## Sponsor and platform resources

| Resource                                            | How Navis uses it                                                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solana documentation and Wallet Adapter             | Wallet connection, nonce-bound wallet authentication, RPC/cluster semantics, explorer-safe evidence links, and Solana transaction handling.                                             |
| ClawPump documentation and API references           | Server-side agent linking, pair discovery, and self-funded launch preflight surfaces. Live launch execution requires credentials, funding, provider acceptance, and chain confirmation. |
| Meteora Dynamic Bonding Curve documentation and SDK | DBC config preview, transaction preparation/simulation/submission surfaces, and pool monitoring.                                                                                        |
| PreStocks public API                                | Read-only catalogue discovery and economic-exposure/eligibility disclosure.                                                                                                             |
| Stocklana hackathon brief                           | Product framing, judging constraints, and sponsor-claim evidence requirements.                                                                                                          |

## Direct runtime dependencies

| Package                                 | License               | Role                                                     |
| --------------------------------------- | --------------------- | -------------------------------------------------------- |
| `@fontsource/ibm-plex-mono`             | OFL-1.1               | Monospace typography.                                    |
| `@meteora-ag/dynamic-bonding-curve-sdk` | MIT                   | Meteora DBC builders and types.                          |
| `@phosphor-icons/react`                 | MIT                   | Interface icons.                                         |
| `@solana/wallet-adapter-base`           | Apache-2.0            | Wallet adapter base types and behavior.                  |
| `@solana/wallet-adapter-react`          | Apache-2.0            | React wallet connection provider/hooks.                  |
| `@solana/web3.js`                       | MIT                   | Solana public keys, transactions, RPC, and signatures.   |
| `bn.js`                                 | MIT                   | Big-number support used by chain SDKs.                   |
| `bs58`                                  | MIT                   | Base58 encoding/decoding for Solana signatures and keys. |
| `drizzle-orm`                           | Apache-2.0            | TypeScript database ORM.                                 |
| `geist`                                 | SIL Open Font License | UI typography.                                           |
| `jose`                                  | MIT                   | Session token signing/verification.                      |
| `next`                                  | MIT                   | App framework and server routes.                         |
| `pg`                                    | MIT                   | PostgreSQL client.                                       |
| `react`                                 | MIT                   | UI runtime.                                              |
| `react-dom`                             | MIT                   | React DOM renderer.                                      |
| `tweetnacl`                             | Unlicense             | Wallet signature verification.                           |
| `zod`                                   | MIT                   | Runtime validation and schema parsing.                   |

## Direct development dependencies

| Package                  | License    | Role                                  |
| ------------------------ | ---------- | ------------------------------------- |
| `@tailwindcss/postcss`   | MIT        | CSS processing.                       |
| `@types/node`            | MIT        | Node.js TypeScript types.             |
| `@types/pg`              | MIT        | PostgreSQL TypeScript types.          |
| `@types/react`           | MIT        | React TypeScript types.               |
| `@types/react-dom`       | MIT        | React DOM TypeScript types.           |
| `drizzle-kit`            | MIT        | Drizzle schema checks and migrations. |
| `eslint`                 | MIT        | Linting.                              |
| `eslint-config-next`     | MIT        | Next.js lint rules.                   |
| `eslint-config-prettier` | MIT        | Prettier-compatible lint config.      |
| `prettier`               | MIT        | Formatting.                           |
| `tailwindcss`            | MIT        | Styling system.                       |
| `typescript`             | Apache-2.0 | Type checking and language tooling.   |
| `vite`                   | MIT        | Vitest peer/runtime tooling.          |
| `vitest`                 | MIT        | Unit/integration tests.               |

## Claim boundaries

- Navis does not claim ownership of Solana, ClawPump, Meteora, PreStocks, Next.js, React, Drizzle, or wallet-adapter technology.
- Demo receipts are Navis-generated simulations and are labelled as such.
- Sponsor integration claims must map to `docs/EVIDENCE.md`; absent signatures or addresses stay documented as unavailable rather than implied.
