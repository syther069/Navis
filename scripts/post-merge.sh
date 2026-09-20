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

# npm install inside Replit can write the local package-firewall proxy host
# into package-lock.json "resolved" URLs. Vercel cannot resolve that host, so
# normalise them back to the public registry before the lockfile is committed.
if grep -q "package-firewall.replit.internal" package-lock.json; then
  sed -i 's#http://package-firewall.replit.internal/npm/#https://registry.npmjs.org/#g' package-lock.json
  echo "Rewrote Replit package-firewall URLs in package-lock.json to registry.npmjs.org" >&2
fi
