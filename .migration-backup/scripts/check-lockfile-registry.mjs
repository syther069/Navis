import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const ALLOWED_REGISTRY_ORIGIN = "https://registry.npmjs.org";

function collectResolvedUrls(lockfile) {
  const found = [];
  const visit = (node, path) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (typeof node.resolved === "string") {
      found.push({ path, resolved: node.resolved });
    }
    for (const key of ["packages", "dependencies"]) {
      const children = node[key];
      if (children && typeof children === "object") {
        for (const [name, child] of Object.entries(children)) {
          visit(child, name || "(root)");
        }
      }
    }
  };
  visit(lockfile, "(root)");
  return found;
}

export function findForeignResolvedUrls(lockfileText) {
  const lockfile = JSON.parse(lockfileText);
  return collectResolvedUrls(lockfile).filter(({ resolved }) => {
    let url;
    try {
      url = new URL(resolved);
    } catch {
      return true;
    }
    return url.origin !== ALLOWED_REGISTRY_ORIGIN;
  });
}

export async function checkLockfile(lockfilePath) {
  const text = await readFile(lockfilePath, "utf8");
  const offenders = findForeignResolvedUrls(text);
  if (offenders.length === 0) {
    return {
      ok: true,
      message: `${lockfilePath}: all resolved URLs use ${ALLOWED_REGISTRY_ORIGIN}`,
    };
  }
  const shown = offenders
    .slice(0, 10)
    .map(({ path, resolved }) => `  ${path}: ${resolved}`);
  const more =
    offenders.length > shown.length
      ? `  ...and ${offenders.length - shown.length} more\n`
      : "";
  return {
    ok: false,
    message:
      `${lockfilePath}: ${offenders.length} resolved URL(s) do not point at ${ALLOWED_REGISTRY_ORIGIN}.\n` +
      `Vercel cannot reach hosts such as package-firewall.replit.internal, so an uncached build will fail at npm install.\n` +
      `Fix: run scripts/post-merge.sh, or\n` +
      `  sed -i 's#http://package-firewall.replit.internal/npm/#https://registry.npmjs.org/#g' package-lock.json\n` +
      `Offending entries:\n${shown.join("\n")}\n${more}`,
  };
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const lockfilePath = process.argv[2] ?? "package-lock.json";
  const result = await checkLockfile(lockfilePath);
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(result.message);
    process.exit(1);
  }
}
