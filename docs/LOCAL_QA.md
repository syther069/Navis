# Navis local QA

Verified: 2026-09-20.

At current `main`, `npm run check` passes with 166 tests in 32 files, production build and the judge smoke (11 routes, PreStocks API, fresh oversized decision). The hardening, fresh decision flow, Meteora intent binding and origin fix are deployed at GitHub `main` commit `a335681`.

## Public browser walk, 20 September 2026 (production, `a335681`)

- Real Chromium at 1440 px: Balanced run Approved with all policy checks passed and "Receipt verified"; Oversized run Rejected on max trade bps and min reserve bps. No console errors, no HTTP 4xx/5xx.
- Real Chromium at 375 px: navigation drawer opens, Balanced run readable, no horizontal overflow.
- `/proofs/demo-proof` shows integrity valid, signature None, offchain only. `/markets/launch` shows ClawPump unavailable and Meteora not deployed; the disabled Prepare control does nothing without a wallet.
- Known defect: "Open decision detail" after a run showed "Decision unavailable" because demo runs are kept in one serverless instance's memory.

## Earlier baseline walk (commit `ac26e54`)

## Browser walkthrough

- A fresh real-Chromium browser completed the public Atlas → Inspect decision → actual public verifier journey.
- All requested pages loaded without application errors.
- Demo hashes validated. The receipt remained `offchain_only`, showed signature `None`, and exposed no explorer link.
- `/agents/new` accepted a valid mandate in review, displayed defaults, and kept save/link disabled without authentication. No write occurred.
- Ten UI routes at 375, 768, and 1440 px had no horizontal overflow or missing input labels.
- Keyboard menu Escape and focus return passed; contrast checks had no failures.
- Reduced-motion was effective, and Atlas remained usable without overflow at 200% CSS zoom.

![Local Navis preview](evidence/navis-root-preview.jpg)

Machine-readable evidence: `evidence/stocklana-v2-public-smoke.json` (public smoke against production) and `evidence/stocklana-v2-dependency-audit.json`.

## Runtime nonce checks

- Same-origin request returned HTTP 200, `Cache-Control: no-store`, and a message bound to the exact preview HTTPS origin.
- Foreign `Origin` returned HTTP 403.
- Missing `Origin` returned HTTP 403.
- No secret values were printed.

## Limitations

- No real wallet extension, wallet signature, live transaction, or full screen-reader audit was tested. The public Vercel deployment and its health endpoint were tested.
- Fresh decision runs are simulations and, without a database, live only in server memory.
- The public deployment is Vercel; Navis is not published through Replit.
- `npm audit --omit=dev` still reports 19 unresolved production advisories: 6 high, 13 moderate, and 0 critical.
