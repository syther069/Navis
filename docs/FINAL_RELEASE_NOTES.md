# Final audit hardening

Prepared 23 September 2026. These changes extend the audited PR, not the cancelled stock-filter feature or the unrelated development branch.

## Source-backed fixes

### Rate-limit expensive API work

- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) recommends returning HTTP 429 for excessive requests.
- [RFC 6585, section 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4) defines 429, allows Retry-After and prohibits caching a 429 response.
- Navis uses its existing database counter for limits shared across server instances, keyed by the verified wallet for authenticated operations. Wallets supplied in request bodies or arbitrary headers are not trusted quota identities.
- Limits are product choices, not sponsor-prescribed thresholds. They must leave room for the normal judge flow, polling and idempotent retries.
- Database failure must not silently become unlimited access. Development without a configured database has explicitly best-effort, bounded in-process protection only.

### Preserve failed smoke evidence

[GitHub's artifact documentation](https://docs.github.com/en/actions/tutorials/store-and-share-data) describes storing test/build output for inspection after a workflow. The existing upload step already runs on failure, but the smoke script previously wrote its report only on success.

The script now writes status, timestamps, the failing step and completed checks in its cleanup path. A failure replaces any stale success report and still exits nonzero. Raw response bodies, exception stacks, cookies and server logs are not added to the JSON report. Failure-report tests exercise both the first-page failure and a failure after an earlier page passed. The ordinary full smoke run exercises the success path.

## Official sponsor constraints remain unchanged

- [Stocklana](https://hackathons.solana.com/hackathons/stocklana): the ClawPump requirement remains “Launch your token with a stock-paired liquidity pool using clawpump and Meteora.”
- [ClawPump documentation](https://clawpump.tech/docs): documented self-funded launch handling uses an exact payment quote, payment signature and preflight token. Navis does not fabricate this payment or turn a preflight into a submitted launch.
- [Meteora DBC Token 2022 support](https://docs.meteora.ag/core-products/dbc/token-2022-support.md): non-permissionless quote extensions require an operator-created token badge; badges do not permit a nonzero transfer fee. The official index is [llms.txt](https://docs.meteora.ag/llms.txt).
- Mainnet enablement, Meteora broadcasting, the validated threshold and genesis hashes remain unchanged.

Provider authorization and quote-mint badges cannot be repaired by bypassing validation. They remain external prerequisites. No funding, payment, live launch or pool broadcast is part of this change.

## Release boundary

Only the audited PR branch is pushed. GitHub CI must pass on its exact head. Production remains the previously verified commit until the user merges/releases the PR through the existing GitHub-to-Vercel setup. A preview build is not production verification.
