#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Prefer a clean, lockfile-exact install. If a merge left package.json and
# package-lock.json slightly out of sync, fall back to a normal install so the
# lockfile is repaired instead of failing the whole post-merge step.
if ! npm ci --no-audit --no-fund; then
  echo "npm ci failed; falling back to npm install to repair the lockfile" >&2
  npm install --no-audit --no-fund
fi
