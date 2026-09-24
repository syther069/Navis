# Wallet-approved Meteora Devnet evidence

## Scope and limits

This is a workspace Devnet rehearsal using the SOL-quoted profile. It is not a
production release, a mainnet authorization, or a stock-paired sponsor launch.
The owner approved signing in their browser wallet. No wallet private key,
recovery phrase, session credential, or signed transaction payload is included.

## Public config evidence

- Network: Solana Devnet.
- RPC genesis: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- Transaction signature:
  `5uQczBoTRyRUyGorJem7rnDAMMbBSoGZPuWHVWSg9id7ochYrFDn3SNoHDFCFccjdJs2SUgqj4nNXmUKS5bzTH75`.
- Public transaction:
  https://explorer.solana.com/tx/5uQczBoTRyRUyGorJem7rnDAMMbBSoGZPuWHVWSg9id7ochYrFDn3SNoHDFCFccjdJs2SUgqj4nNXmUKS5bzTH75?cluster=devnet
- Independently read RPC outcome: finalized, no transaction error.
- Slot: `502897659`.
- Navis reconciliation outcome: `protocol_verified`.
- Protocol check: the decoded config quote mint matches wrapped SOL,
  `So11111111111111111111111111111111111111112`.
- Config account: `3384vQv3GcqXGWqQshCoRQCgAhZ6E5GbDHscYMw174BS`.
- Verification observed on 2026-09-23.

An earlier config submission expired before broadcast. A newly prepared,
wallet-approved transaction produced the successful signature above.

## Pool evidence

Pool preparation and wallet-approved simulation succeeded. The first pool
submission returned HTTP 410 before broadcast. The saved config stayed
protocol-verified; that pool attempt has no recorded transaction signature.

After recovering the saved config, the owner approved a newly prepared pool
transaction in Phantom. Its simulation passed and submission succeeded.

- Transaction signature:
  `5GnDAS4e9T95PvBMjUibupbycqm81pokDjQLe8hbNCFVF4yzriTcvNHSHJ7S8czZuchk4qCqqM1MY9hcJRfXYubC`.
- Public transaction:
  https://explorer.solana.com/tx/5GnDAS4e9T95PvBMjUibupbycqm81pokDjQLe8hbNCFVF4yzriTcvNHSHJ7S8czZuchk4qCqqM1MY9hcJRfXYubC?cluster=devnet
- Independently read RPC outcome: finalized, no transaction error.
- Slot: `502904350`.
- Pool simulation slot: `502904295`, no simulation error.
- Navis reconciliation outcome: `protocol_verified`, launch `pool_confirmed`.
- Protocol checks: decoded pool config and base mint match the recorded values.
- Pool account: `6aWt9n7K4tS7n3QBGb2VqPF2uNDvevZZ8eBbtnx2VPqx`.
- Base mint: `6ri6V2y3z9drzXVpoxtNhRXXxTbTtPkRS6SCXwAb1PZK`.
- Protocol verification recorded at `2026-09-23T10:34:36.056Z`.
- Both config and pool transactions charged 10,000 lamports in network fees.
  These figures exclude account rent.

## Recovery checks

The UI now loads owner-scoped saved launches after refresh, without restoring
signing keys or signed transaction bytes. A verified config can continue into
pool creation without creating another config. Each fresh pool preparation
requires another explicit wallet approval.

Automated route and component checks cover owner isolation, no automatic
broadcast during recovery, reload recovery, expired-pool retry, and blocking
new submission for saved or uncertain pool outcomes. These checks use mocks;
they supplement the real wallet-approved config and pool transactions above.

## Refresh, retry, and duplicate-broadcast evidence

- Live recovery continued the original verified config after the expired pool
  attempt. The replacement pool used fresh wallet approval rather than another
  config submission.
- Persisted pool intents for this launch contain one expired, never-broadcast
  attempt without a recorded signature and one confirmed attempt with the
  successful pool signature.
- A read-only RPC `getSignaturesForAddress` for the config, after pool verification,
  returned exactly the config and pool signatures recorded above, both finalized.
  There is no additional transaction in that config's history.
- Component remount tests cover reload recovery without signing or sending.
  Saved submitted, unknown, and confirmed pool states block a fresh pool submit.
  Submit-route replay tests check that retries return stored outcomes without
  calling the send operation again.
- Browser reload of the completed pool with the owner's wallet was not separately
  observed. That completed-pool reload case is covered by automated recovery tests,
  not claimed as another live wallet-browser run.

Mainnet broadcast remains code-blocked. Stock-paired quote-token badge checks
remain unchanged.

## Local validation

On 2026-09-23, 54 focused tests passed across the wallet-signing, quote-profile,
broadcast-gate, submit-release, intent-concurrency, recovery-route, and recovery-UI
suites. TypeScript and targeted lint checks passed. The restarted workspace app
served the launch page successfully. Nothing was published.
