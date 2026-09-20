# Navis local QA

Verified: 2026-09-20.

## Browser walkthrough

- A clean, unauthenticated browser completed Atlas → Inspect decision → demo decision → public verifier.
- All requested pages loaded without application errors.
- Demo hashes validated. The receipt remained `offchain_only`, showed signature `None`, and exposed no explorer link.
- `/agents/new` accepted a valid mandate in review, displayed defaults, and kept save/link disabled without authentication. No write occurred.
- At 375 px, Atlas, decision, proof, launch, and new-agent review had no horizontal overflow.
- Keyboard skip navigation showed a visible 2 px focus indicator.
- Reduced-motion duration computed to `0.00001s`.
- Headings remained readable at 200% zoom, including the checked top of the launch page.

![Local Navis preview](evidence/navis-root-preview.jpg)

The image is from the local Replit preview, not a published deployment.

## Runtime nonce checks

- Same-origin request returned HTTP 200, `Cache-Control: no-store`, and a message bound to the exact preview HTTPS origin.
- Foreign `Origin` returned HTTP 403.
- Missing `Origin` returned HTTP 403.
- No secret values were printed.

## Limitations

- No real wallet extension, wallet signature, live transaction, public deployment, or production health endpoint was tested.
- Fresh interactive proposal generation remains deferred and archived. The verified flow uses deterministic demo evidence.
- The Screenshot tool's `127.0.0.1` probe observed only a development HMR WebSocket 502. The real browser preview showed no application error or functional UI issue.
- `getDeploymentInfo` reports no deployment and no public URL.
- `npm audit --omit=dev` still reports 19 unresolved production advisories: 6 high, 13 moderate, and 0 critical.
