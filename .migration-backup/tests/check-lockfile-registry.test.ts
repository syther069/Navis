import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// prettier-ignore
// @ts-expect-error plain ESM script without type declarations
import { checkLockfile, findForeignResolvedUrls } from "../scripts/check-lockfile-registry.mjs";

const script = join(process.cwd(), "scripts/check-lockfile-registry.mjs");

function writeLockfile(contents: object) {
  const dir = mkdtempSync(join(tmpdir(), "navis-lockfile-"));
  const file = join(dir, "package-lock.json");
  writeFileSync(file, JSON.stringify(contents));
  return file;
}

const poisoned = {
  lockfileVersion: 3,
  packages: {
    "": { name: "x" },
    "node_modules/zod": {
      version: "4.0.0",
      resolved: "http://package-firewall.replit.internal/npm/zod/-/zod-4.0.0.tgz",
    },
    "node_modules/jose": {
      version: "6.0.0",
      resolved: "https://registry.npmjs.org/jose/-/jose-6.0.0.tgz",
    },
  },
};

const clean = {
  lockfileVersion: 3,
  packages: {
    "": { name: "x" },
    "node_modules/jose": {
      version: "6.0.0",
      resolved: "https://registry.npmjs.org/jose/-/jose-6.0.0.tgz",
    },
  },
};

describe("check-lockfile-registry", () => {
  it("flags resolved URLs off registry.npmjs.org", () => {
    const offenders = findForeignResolvedUrls(JSON.stringify(poisoned));
    expect(offenders).toHaveLength(1);
    expect(offenders[0].path).toBe("node_modules/zod");
  });

  it("passes a clean lockfile", async () => {
    const result = await checkLockfile(writeLockfile(clean));
    expect(result.ok).toBe(true);
  });

  it("exits non-zero with a clear message on a poisoned lockfile", () => {
    const file = writeLockfile(poisoned);
    expect(() => execFileSync("node", [script, file], { stdio: "pipe" })).toThrowError(
      /package-firewall\.replit\.internal/,
    );
  });

  it("passes the repository's own package-lock.json", async () => {
    const result = await checkLockfile(join(process.cwd(), "package-lock.json"));
    expect(result.ok, result.message).toBe(true);
  });
});
