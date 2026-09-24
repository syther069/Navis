# NAVIS

Solana workspace for policy-constrained proposals, wallet approval, and verifiable receipts.

## Running

Use the managed `artifacts/navis: web` and `artifacts/api-server: API Server` workflows. The Vite frontend is mounted at `/`; the Express backend preserves the original `/api/*` contracts.

- `pnpm --filter @workspace/navis run typecheck`
- `pnpm --filter @workspace/navis run test`
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/api-server run test`
- `pnpm --filter @workspace/navis-core run typecheck`

## Structure

- `artifacts/navis/src/components/workspace`: dashboard, Atlas, lifecycle and decision record UI.
- `artifacts/navis/src/app/styles`: existing NAVIS semantic tokens plus workspace styles.
- `artifacts/navis/src/pages/workspace-pages.tsx`: persisted record loading.
- `artifacts/api-server/src/navis`: preserved API routes and server page-data adapters.
- `lib/navis-core`: original domain, policy, authentication, integration and persistence logic.
- `.migration-backup`: original import retained for reference.

## Vercel

The GitHub repository still deploys to Vercel. Root `vercel.json` installs with pnpm, builds the frontend, then `artifacts/api-server/build-vercel.mjs` writes a Build Output bundle to `.vercel/output`: static frontend plus the Express API as one `/api/*` function. Keep this working when changing build config.

## Configuration and safety

Connect the **existing NAVIS database** through workspace secrets. A configured `DATABASE_URL` does not prove schema readiness. The supplied workspace database has no NAVIS tables; no schema migration or seeding was performed. Storage failures return explicit errors instead of invented empty results.

Wallet authentication requires `SESSION_SECRET`, the existing database, and a trusted application origin. The original server configuration uses `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SOLANA_CLUSTER`; neither is exposed as a browser secret. Optional integration settings remain server-only. Production must supply its exact trusted HTTPS origin.

Do not enable Meteora broadcasting or execution flags as part of UI work. Never treat policy approval as wallet approval, a simulation as settlement, or configuration as verified connectivity. Primary workspace views use actual records; fictional examples remain only in explicitly labelled demo paths/disclosures.

## Design

Use existing NAVIS Geist Sans UI typography, IBM Plex Mono tabular financial values, 4px spacing scale, dark neutral surfaces, brass actions, and semantic status colors. Use the shared accessible InfoHint for explanations. Atlas is a structured nine-part decision record, not a chat interface.