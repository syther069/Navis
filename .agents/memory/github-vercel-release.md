---
name: GitHub main and Vercel release constraints
description: Why pushes to syther069/Navis main fail and how the repo must stay deployable on Vercel.
---

- GitHub `main` is protected: required check "check, smoke and submission audit" must pass. It also fails on the external feature branches, and the old CI workflow lives only in `.migration-backup`, so merges to `main` go through a PR the owner merges with admin bypass.
- Replit's GitHub integration cannot write to this repo (403 "Resource not accessible by integration"). Pushes use the user's fine-grained token in secret GITHUB_PUSH_TOKEN via GIT_ASKPASS; it needs Contents and Workflows read/write (Workflows because `.github/workflows` files moved).
- Vercel builds every branch and production from `main`; its framework preset was Next.js, so root `vercel.json` sets `framework: null` and emits `.vercel/output`.

**Why:** a plain push of the Replit pnpm monorepo made Vercel previews fail and was rejected by branch protection.
**How to apply:** push work to a branch, confirm the Vercel status on the commit is success, then ask the owner to merge the PR. Never force-push.
