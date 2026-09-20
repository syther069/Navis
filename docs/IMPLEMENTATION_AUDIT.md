# Navis implementation audit

Updated: 2026-09-20.

## 1. Implemented and freshly verified

- Canonical Next.js App Router application restored at the repository root with npm and the existing lockfile.
- `npm install` retained every existing dependency version while normalizing lock peer metadata: 157 peer/optional paths were added and 4 optional paths were removed. No core dependency version was upgraded or downgraded.
- Baseline `npm run check` passed all eight gates with 113 tests in 24 files. The subsequent local remediation pass passed the same eight gates with 143 tests in 26 files, including production build and eleven-route judge smoke. See `REMEDIATION_REPORT.md`; these newer changes are not deployed.
- Recorded deterministic Atlas lifecycle, policy evidence, offchain-only proof receipt, and public verification form the verified baseline.
- Development migrations `0000` through `0005` were applied in order with journal SHA tracking.
- Demo, devnet, and mainnet gates remain separated; all live execution flags are false.
- The agent create/read ownership fix, detail profile, navigation, and focused tests passed.
- Focused ClawPump corrections sanitize provider errors, avoid returning or persisting the raw preflight token, retain only its hash, and test exact terms, pair, and payment evidence.
- Fresh real-Chromium public QA passed the Atlas-to-public-verifier journey and 10 UI routes at 375/768/1440 px, with no overflow or missing labels, no-write new-agent review, menu Escape/focus return, contrast, reduced motion, and 200% CSS zoom checks. Full screen-reader and wallet-signing coverage remain unverified.

## 2. Implemented but not yet runtime-verified

- A real wallet extension, signing, and live transaction remain unverified.

## 3. Partially implemented

- ClawPump supports agent linkage, pair discovery, and preflight. Funded launch execution is not implemented.
- Meteora preview renders the exact SDK `1.5.12` configuration. The older incomplete transaction protocol was not ported or enabled: server-prepared and simulation binding plus the broadcast-error path remain unresolved pre-live gates.
- Fresh proposal generation is deferred. Unfinished work is preserved in the restoration archive and is not being ported in this phase.

## 4. Externally blocked

- Vercel deployment is READY at https://navis-gilt.vercel.app and passed all 11 judge-flow routes plus health; Replit remains NOT published.
- No production PostgreSQL Publish migration.
- Sanitized public smoke and browser reports are recorded in `docs/evidence/stocklana-public-smoke.json` and `docs/evidence/stocklana-browser-audit.json`; production wallet-origin verification is not configured.
- No pitch or technical video URL.
- No funded wallet operation, ClawPump launch, Meteora transaction, mint, pool, payout wallet, request ID, or signature.
- No final Stocklana submission.
- GitHub main is independently verified at `ac26e54089154c872f117a54cc73af2a8fc6ff2b`, authored and committed by the repository user. No push was performed by this documentation task; the local Replit root has checkpoint divergence.

Any funded action requires explicit owner approval. Mainnet remains disabled.

## 5. Outdated documentation corrected

- Deadline corrected to Friday, September 25, 2026 at 4:00 p.m. ET.
- Repository URL recorded as https://github.com/syther069/Navis.git.
- Root npm commands, Next.js server posture, and Replit Publish migration ownership recorded.
- Historical completion language reconciled with the deterministic baseline and deferred fresh proposal work.
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
