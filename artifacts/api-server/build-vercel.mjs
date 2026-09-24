/**
 * Produces a Vercel Build Output API (v3) bundle at <repo>/.vercel/output:
 *   static/              -> the built NAVIS frontend (artifacts/navis/dist/public)
 *   functions/api.func/  -> the Express API as one Node.js serverless function
 * Run after `pnpm --filter @workspace/navis run build`.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(artifactDir, "..", "..");
const outputDir = path.resolve(repoRoot, ".vercel", "output");
const staticSource = path.resolve(repoRoot, "artifacts", "navis", "dist", "public");
const functionDir = path.resolve(outputDir, "functions", "api.func");

async function main() {
  const frontend = await stat(path.join(staticSource, "index.html")).catch(() => null);
  if (!frontend) {
    throw new Error(`Frontend build missing at ${staticSource}. Build @workspace/navis first.`);
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(functionDir, { recursive: true });
  await cp(staticSource, path.join(outputDir, "static"), { recursive: true });

  await esbuild({
    entryPoints: { index: path.resolve(artifactDir, "src/vercel.ts") },
    platform: "node",
    target: "node22",
    bundle: true,
    format: "esm",
    outdir: functionDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  await writeFile(path.join(functionDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  await writeFile(
    path.join(functionDir, ".vc-config.json"),
    JSON.stringify(
      { runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false },
      null,
      2,
    ),
  );

  await writeFile(
    path.join(outputDir, "config.json"),
    JSON.stringify(
      {
        version: 3,
        routes: [
          {
            src: "^/assets/(.*)$",
            headers: { "cache-control": "public, max-age=31536000, immutable" },
            continue: true,
          },
          { src: "^/api(?:/.*)?$", dest: "/api" },
          { handle: "filesystem" },
          { src: "^/(.*)$", dest: "/index.html" },
        ],
      },
      null,
      2,
    ),
  );

  console.log(`Vercel build output written to ${path.relative(repoRoot, outputDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
