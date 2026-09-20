# Navis Evidence Manifest

Updated: 2026-09-19.

This manifest records what can be proven from the current local workspace and what remains externally blocked.

## Local build evidence

| Gate                                          | Latest local result                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run format:check`                        | Passed                                                                             |
| `npm run lint`                                | Passed                                                                             |
| `npm run typecheck`                           | Passed                                                                             |
| `npm test`                                    | Passed: 22 files / 103 tests                                                       |
| `npm run build`                               | Passed: 18 app routes                                                              |
| `npm run smoke:judge`                         | Passed: clean-session demo flow                                                    |
| `node node_modules/drizzle-kit/bin.cjs check` | Passed                                                                             |
| `npm run check`                               | Passed full combined gate                                                          |
| `npm run submission:audit`                    | Passed with expected external-evidence TODO warning                                |
| Deployed URL smoke verifier                   | Implemented and validated against a temporary local origin; no public URL recorded |

## Public URLs

| Item              | Value                             |
| ----------------- | --------------------------------- |
| Deployed demo URL | Not provisioned in this workspace |
| Repository URL    | Not configured in this workspace  |
| Demo video URL    | Not captured in this workspace    |

## Demo evidence

| Item                | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Demo agent          | Atlas                                                                     |
| Demo route          | `/agents/atlas`                                                           |
| Demo decision route | `/agents/atlas/decisions/demo-decision`                                   |
| Demo proof route    | `/proofs/demo-proof`                                                      |
| Disclosure route    | `/disclosures`                                                            |
| Receipt type        | Deterministic simulation; no onchain signature                            |
| Hash anchoring      | Offchain-only decision hash; no memo instruction or transaction signature |

## ClawPump evidence

| Item                                | Value                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| API adapter                         | Implemented under `lib/integrations/clawpump/*`                                                         |
| Local support                       | Agent creation/linking, pair discovery, launch preflight                                                |
| Live launch mint                    | Not available                                                                                           |
| Live launch transaction             | Not available                                                                                           |
| Provider request ID for live launch | Not available                                                                                           |
| Blocker                             | Requires `CLAWPUMP_API_KEY`, authenticated wallet, funding, provider acceptance, and chain confirmation |

## Meteora DBC evidence

| Item                   | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| SDK                    | `@meteora-ag/dynamic-bonding-curve-sdk`                        |
| Program                | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`                  |
| Quote mint             | Wrapped SOL, `So11111111111111111111111111111111111111112`     |
| Config profile         | `navis-equity-v1`                                              |
| Config transaction     | Builder implemented; no live signature in this workspace       |
| Pool transaction       | Builder implemented; no live signature in this workspace       |
| Pool address/base mint | Not available                                                  |
| Blocker                | Requires RPC, wallet approval, funding, and chain confirmation |

## PreStocks evidence

| Item            | Value                                               |
| --------------- | --------------------------------------------------- |
| API URL         | `https://prestocks.com/api/prestocks`               |
| Navis API route | `/api/assets/prestocks`                             |
| Adapter         | `lib/integrations/prestocks/client.ts`              |
| Schema          | `lib/integrations/prestocks/schemas.ts`             |
| Product surface | Read-only catalogue/disclosure on `/markets/launch` |
| Execution path  | None                                                |

## Compliance notes

- Demo and live modes are labelled separately.
- PreStocks are described as economic exposure, not shares.
- No secret values are documented here.
- No external live address is claimed without a corresponding signature/address row.
- Deployment and Stocklana submission steps are tracked in `docs/DEPLOYMENT_RUNBOOK.md`.
- Copy-ready submission language is staged in `docs/SUBMISSION_DRAFT.md`.
- Open-source and sponsor credits are recorded in `docs/ATTRIBUTIONS.md`.
