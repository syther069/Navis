# Navis implementation audit

Updated: 2026-09-20.

## 1. Implemented and freshly verified

- Canonical Next.js App Router application restored at the repository root with npm and the existing lockfile.
- `npm install` retained every existing dependency version while normalizing lock peer metadata: 157 peer/optional paths were added and 4 optional paths were removed. No core dependency version was upgraded or downgraded.
- `npm run check` passes all eight gates at current `main` with 166 tests in 32 files, including production build and the judge smoke with a fresh oversized decision. The remediation hardening, fresh decision flow, Meteora intent binding and same-origin fix are deployed on Vercel at GitHub `main` commit `a335681`. History: 113 tests in 24 files at the first baseline, 143 in 26 after remediation.
- Recorded deterministic Atlas lifecycle, policy evidence, offchain-only proof receipt, and public verification form the verified baseline. On top of it, `POST /api/decisions/run` produces fresh Balanced (approved) and Oversized (rejected) decisions with new receipts; verified in a real browser on production on 2026-09-20.
- Development migrations `0000` through `0005` were applied in order with journal SHA tracking.
- Demo, devnet, and mainnet gates remain separated; all live execution flags are false.
- The agent create/read ownership fix, detail profile, navigation, and focused tests passed.
- Focused ClawPump corrections sanitize provider errors, avoid returning or persisting the raw preflight token, retain only its hash, and test exact terms, pair, and payment evidence.
- Fresh real-Chromium public QA passed the Atlas-to-public-verifier journey and 10 UI routes at 375/768/1440 px, with no overflow or missing labels, no-write new-agent review, menu Escape/focus return, contrast, reduced motion, and 200% CSS zoom checks. Full screen-reader and wallet-signing coverage remain unverified.

## 2. Implemented but not yet runtime-verified

- A real wallet extension, signing, and live transaction remain unverified.

## 3. Partially implemented

- ClawPump supports agent linkage, pair discovery, and preflight. Funded launch execution is not implemented.
- Meteora preview renders the exact SDK `1.5.12` configuration. Server-prepared intent binding and persist-before-broadcast are now implemented with tests, and broadcast stays hard-blocked in every mode until retested on a real cluster.
- Fresh decision runs for persistent agents return 409 because persisted snapshots do not contain every fact an honest policy evaluation needs. Demo-agent fresh runs are live; without a database they live in one server instance's memory, so the `/decisions/<id>` link is unreliable on Vercel.

## 4. Externally blocked

- Vercel deployment is READY at https://navis-gilt.vercel.app (commit `a335681`) and passed all 11 judge-flow routes, health, the PreStocks API and a fresh oversized decision. Navis is not published through Replit.
- No production PostgreSQL Publish migration.
- Current public smoke: `docs/evidence/stocklana-public-smoke.json` was the first baseline; `docs/evidence/stocklana-v2-public-smoke.json` is current. Same-origin mutation requests were verified on production (200 same origin, 403 foreign). No wallet session store exists in production.
- No pitch or technical video URL.
- No funded wallet operation, ClawPump launch, Meteora transaction, mint, pool, payout wallet, request ID, or signature.
- No final Stocklana submission.
- GitHub main is at `a335681`, authored and committed by the repository owner, and is the commit Vercel serves. Later local commits (first-screen intro, this documentation refresh) are not pushed until the owner authorises it.

Any funded action requires explicit owner approval. Mainnet remains disabled.

## 5. Outdated documentation corrected

- Deadline corrected to Friday, September 25, 2026 at 4:00 p.m. ET.
- Repository URL recorded as https://github.com/syther069/Navis.git.
- Root npm commands, Next.js server posture, and Replit Publish migration ownership recorded.
- Historical completion language reconciled with the deterministic baseline; on 2026-09-20 evening all documents were refreshed again to match the deployed `a335681` state, with older baselines kept in history sections.
- Meteora installed lock corrected to `1.5.12`.
- ClawPump preflight separated from unsupported funded execution.
- Video limits and main plus three sponsor-track plan recorded.

## 6. Replit migration artifacts

- The unrelated starter API and canvas artifacts are archived and no longer active.
- The only active preview descriptor is `artifacts/navis/.replit-artifact/artifact.toml`. It routes `/` to root npm commands and is not application source.
- Preservation archive: `.restoration/navis-pre-root-20260920.tar.gz`.
- Archive SHA-256: `11090837a18cce61c4310d995cb218f21745b20a216314165a39890ea638ea65`.
- The prior root scaffold and unfinished application changes were saved separately under `.restoration`.
- Canonical `.migration-backup` remains unchanged.
- GitHub main is independently verified at the commit recorded above. The local Replit root has checkpoint divergence; this documentation task performed no push.
- `.replitignore` excludes the 1.4 GB restoration directory, `.migration-backup`, and irrelevant tooling from deployment while preserving the recoverable root changes.

## 7. Remaining work before optional Replit deployment

1. Review the recorded 19-advisory production dependency audit and decide accepted risk without forced dependency changes.
2. Keep `NEXT_PUBLIC_APP_URL` unset for a first Replit Publish; the approved Vercel origin is already recorded above.
3. Ask the user to Publish with safe demo flags. Replit managed PostgreSQL schema setup occurs through the Publish prompt.
4. After the public origin is verified, set production `NEXT_PUBLIC_APP_URL` through Secrets and ask the user to Republish.
5. If Replit is published, verify its `/api/health`, judge routes, real-wallet behavior, and deployed smoke report separately from Vercel.

## 8. Remaining work before Stocklana submission

1. Copy the sanitized public smoke and browser reports into the evidence paths named above.
2. Record pitch and technical videos only if produced; they remain optional external requirements.
3. Keep only sponsor-track claims supported by final evidence.
4. Do not attempt ClawPump funded execution without owner-approved mainnet release and reviewed safe execution code.
5. Do not enable Meteora live submission until prepared-proposal binding is implemented and retested.
6. Register and review the authenticated submission form, then submit manually before the deadline.
