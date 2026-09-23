# Devnet release handoff

The owner authorised Meteora Devnet enablement on 23 September 2026 and subsequently requested that the changes be pushed to GitHub.

This candidate extends the existing audit PR with Devnet-only broadcast gating, wallet chain-aware signing, SIWS-compatible nonces, submission quotas and owner-scoped launch recovery. Mainnet remains code-blocked. PreStocks stock-paired quoting remains mainnet-only and token-badge gated.

The original final audit described an all-cluster broadcast stop. That statement is historical and is superseded only for explicitly configured Devnet operation. See `METEORA_WALLET_DEVNET_EVIDENCE.md` for the separately recorded wallet-approved Devnet config and pool evidence. Those transactions are workspace evidence, not Vercel production verification.

Unrelated local agent-draft changes, ClawPump catalogue changes, browser-session-family changes and their database migration are excluded. No package dependencies, genesis hashes, curve threshold or mainnet approval flags are changed by this release.

## Vercel release requirements

The scoped candidate passed 584 tests across 75 files, formatting, lint, TypeScript, the registry gate, production build, judge smoke, schema checks and submission audit before push. The GitHub checks must independently pass on its final commit.

Pushing this PR is not publishing to production. The owner must merge/release it through the existing Vercel project. The next production build needs:

```text
NAVIS_EXECUTION_MODE=devnet
ENABLE_DEVNET_EXECUTION=true
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
ENABLE_DEMO_MODE=true
ENABLE_MAINNET_EXECUTION=false
MAINNET_RELEASE_APPROVED=false
```

Keep the existing database, session and provider credentials. Configure `SOLANA_RPC_URL` for Devnet. Environment changes require a new deployment. Never enable mainnet to work around a Devnet failure.

After publication, confirm the deployment commit matches the released commit, check health/database readiness and test the wallet-approved Devnet flow. Do not claim those production checks have passed merely because a preview build succeeds.
