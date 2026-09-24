// Point git at the versioned hooks in .githooks so the lockfile gate runs on
// every commit and push. Safe to run anywhere: it silently does nothing when
// there is no git checkout (Vercel builds, CI tarballs) or when git is absent.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.NAVIS_SKIP_GIT_HOOKS === "1" || process.env.CI === "true") {
  process.exit(0);
}
if (!existsSync(".git") || !existsSync(".githooks")) {
  process.exit(0);
}
try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
  console.log("git hooks installed: core.hooksPath=.githooks (lockfile registry gate)");
} catch {
  // git missing or not a repository; nothing to install.
}
