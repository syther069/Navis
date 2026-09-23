import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const home = [
  "Navis lets an AI equity agent propose Solana actions, but only deterministic policy checks and wallet approval can turn those proposals into verifiable receipts.",
  "The agent cannot bypass policy",
  "Demo and live evidence are labelled differently",
  "Wallet approval remains required for value movement",
  "Atlas demo",
  "Create an agent",
  "Markets Launch",
  "Offchain integrity",
  "Wallet authorization",
  "Onchain settlement",
].join("\n");

const directories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("judge smoke failure evidence", () => {
  it.each([false, true])(
    "saves failure and partial results without masking the nonzero exit (home succeeds: %s)",
    async (homeSucceeds) => {
      const server = createServer((request, response) => {
        if (request.url === "/api/health") {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ status: "ok" }));
        } else if (request.url === "/" && homeSucceeds) {
          response.end(home);
        } else {
          response.statusCode = 503;
          response.end("sensitive-provider-response-must-not-be-an-artifact");
        }
      });
      servers.push(server);
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const directory = await mkdtemp(join(tmpdir(), "navis-smoke-evidence-"));
      directories.push(directory);
      const reportPath = join(directory, "report.json");
      await writeFile(reportPath, JSON.stringify({ status: "passed", stale: true }));

      const child = spawn(process.execPath, ["scripts/smoke-judge-flow.mjs"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NAVIS_SMOKE_BASE_URL: baseUrl,
          NAVIS_SMOKE_REPORT: reportPath,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += String(chunk)));
      child.stderr.on("data", (chunk) => (output += String(chunk)));
      const code = await new Promise<number | null>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      const text = await readFile(reportPath, "utf8");
      const report = JSON.parse(text);

      expect(code).toBe(1);
      expect(report.status).toBe("failed");
      expect(report.failedStep).toBe(homeSucceeds ? "/agents" : "/");
      expect(report.results).toHaveLength(homeSucceeds ? 1 : 0);
      expect(report.health.status).toBe("ok");
      expect(report.baseUrl).toBe(baseUrl);
      expect(Date.parse(report.checkedAt)).toBeGreaterThanOrEqual(
        Date.parse(report.startedAt),
      );
      expect(text).not.toContain("stale");
      expect(text).not.toContain("sensitive-provider-response");
      expect(output).toContain("returned HTTP 503");
      expect(output).not.toContain("Judge-flow smoke passed.");
    },
  );
});
