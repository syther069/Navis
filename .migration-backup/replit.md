# Navis

Navis is the existing governed Solana equity-agent workspace. The canonical
Next.js App Router application lives at the repository root and uses npm with
`package-lock.json`. Do not convert it to pnpm, Vite, Express, or a static export.

## Run and validate

- `npm install` installs the original application dependencies.
- `npm run dev` runs Next.js development.
- `npm run check` runs all eight validation gates.
- `npm run build` and `npm run start` build and serve the Next.js production app.
- `npm audit --omit=dev` reports production dependency advisories separately.

The sole Replit service descriptor is
`artifacts/navis/.replit-artifact/artifact.toml`. It runs root npm commands and
routes `/` and its API paths to Next.js. This directory does not contain a second
application. The API and canvas starter services are archived, not active.

## Sources of truth

Read `AGENTS.md` and the installed Next.js documentation before framework changes.
Preserve `README.md`, `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `PHASES.md`,
`TASKS.md`, and `docs/`. Do not replace them with generic templates.

## Safety

Keep demo enabled, live execution disabled, and mainnet release approval false.
AI proposals cannot authorize transactions. Preserve deterministic policy,
nonce/domain/replay protection, trusted mutation origins, human signatures, and
truthful pending states. Simulated proofs must never contain onchain evidence.

Use the existing PostgreSQL/Drizzle model. Managed production schema changes go
through the user's Publish flow, never build/startup DDL. Publishing, funded
actions, wallet signatures, and final hackathon submission require user action.

## Preservation

The original `.migration-backup` remains unchanged. A pre-restoration archive
and separated scaffold/in-progress work are retained under `.restoration/`.
These are recovery material, not active application sources or test targets.
