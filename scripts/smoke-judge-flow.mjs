import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const port = Number(process.env.NAVIS_SMOKE_PORT ?? 3100);
const configuredBaseUrl = process.env.NAVIS_SMOKE_BASE_URL;
const baseUrl = configuredBaseUrl
  ? configuredBaseUrl.replace(/\/+$/, "")
  : `http://127.0.0.1:${port}`;
const reportPath = process.env.NAVIS_SMOKE_REPORT;

const checks = [
  {
    path: "/agents/new",
    includes: ["Define a mandate", "Review mandate"],
  },
  {
    path: "/agents/atlas",
    includes: [
      "What Navis is",
      "Run a decision",
      "Verify a receipt",
      "No live execution",
      "Atlas",
      "Constraint ledger",
      "Demo portfolio snapshot",
    ],
  },
  {
    path: "/decisions",
    includes: ["Decisions", "Atlas bounded one-unit rebalance", "Simulated"],
  },
  {
    path: "/agents/atlas/decisions/demo-decision",
    includes: ["Demo decision", "policy evaluation", "Open public verifier"],
  },
  {
    path: "/proofs",
    includes: ["Proofs", "DEMO RECEIPT", "Simulation"],
  },
  {
    path: "/proofs/demo-proof",
    includes: [
      "Public verifier",
      "Transaction signature",
      "None",
      "Offchain only",
      "deterministic demo receipt",
    ],
    // The public baseline and locally hardened verifier use different labels.
    includesAny: ["Hashes and references match", "All published hashes match"],
    excludes: ["explorer.solana.com/tx/"],
  },
  {
    path: "/markets/launch",
    includes: ["Market launch preflight", "Meteora DBC", "PreStocks"],
  },
  {
    path: "/settings",
    includes: ["Capabilities", "Meteora DBC", "Execution posture"],
  },
  {
    path: "/disclosures",
    includes: [
      "Risk and privacy disclosures",
      "Not brokerage or investment advice",
      "PreStocks action path",
      "Offchain only",
      "Private keys",
    ],
  },
  {
    path: "/transactions",
    includes: ["Transactions", "Execution ledger"],
  },
];

const jsonChecks = [
  {
    path: "/api/assets/prestocks",
    allowedStatuses: [200, 503],
    includes: ["readOnly", "valueMovementAvailable", "PreStocks"],
    excludes: ["private upstream trace", "CLAWPUMP_API_KEY", "SESSION_SECRET"],
  },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopServer(server) {
  if (!server) return;

  if (!server.killed) {
    server.kill("SIGTERM");
  }
  server.stdout?.destroy();
  server.stderr?.destroy();
  server.unref();
}

async function waitForReady() {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: { accept: "application/json" },
      });
      if (response.ok) return response.json();
      lastError = new Error(`/api/health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw lastError ?? new Error("Navis did not become ready.");
}

async function readRoute(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "text/html",
      "user-agent": "Navis judge-flow smoke test",
    },
    redirect: "manual",
  });

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  return response.text();
}

async function readJsonRoute(path, allowedStatuses) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      accept: "application/json",
      "user-agent": "Navis judge-flow smoke test",
    },
    redirect: "manual",
  });

  if (!allowedStatuses.includes(response.status)) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  return response.text();
}

async function exerciseFreshDecision() {
  const response = await fetch(`${baseUrl}/api/decisions/run`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: baseUrl,
      "user-agent": "Navis judge-flow smoke test",
    },
    body: JSON.stringify({ agentSlug: "atlas", scenario: "oversized" }),
  });
  if (!response.ok) {
    throw new Error(`/api/decisions/run returned HTTP ${response.status}`);
  }
  const run = await response.json();
  if (!run.decisionId || run.policyEvaluation?.approved !== false) {
    throw new Error("Fresh oversized decision did not produce a policy rejection");
  }
  const stored = await fetch(`${baseUrl}/api/decisions/${run.decisionId}`);
  if (!stored.ok) {
    throw new Error(`Fresh decision GET returned HTTP ${stored.status}`);
  }
  return run.decisionId;
}

async function run() {
  const server = configuredBaseUrl
    ? undefined
    : spawn(
        process.execPath,
        ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
        {
          cwd: process.cwd(),
          shell: false,
          env: {
            ...process.env,
            NAVIS_EXECUTION_MODE: process.env.NAVIS_EXECUTION_MODE ?? "demo",
            ENABLE_DEMO_MODE: process.env.ENABLE_DEMO_MODE ?? "true",
            ENABLE_DEVNET_EXECUTION: process.env.ENABLE_DEVNET_EXECUTION ?? "false",
            ENABLE_MAINNET_EXECUTION: process.env.ENABLE_MAINNET_EXECUTION ?? "false",
            MAINNET_RELEASE_APPROVED: process.env.MAINNET_RELEASE_APPROVED ?? "false",
            NEXT_PUBLIC_SOLANA_CLUSTER:
              process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
            NEXT_PUBLIC_APP_URL: baseUrl,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

  const output = [];
  server?.stdout.on("data", (chunk) => output.push(String(chunk)));
  server?.stderr.on("data", (chunk) => output.push(String(chunk)));

  try {
    const health = await waitForReady();
    const results = [];

    for (const check of checks) {
      const body = await readRoute(check.path);
      for (const text of check.includes) {
        if (!body.includes(text)) {
          throw new Error(`${check.path} did not include expected text: ${text}`);
        }
      }
      if (check.includesAny && !check.includesAny.some((text) => body.includes(text))) {
        throw new Error(`${check.path} did not report successful receipt integrity`);
      }
      for (const text of check.excludes ?? []) {
        if (body.includes(text)) {
          throw new Error(`${check.path} included forbidden text: ${text}`);
        }
      }
      console.log(`✓ ${check.path}`);
      results.push({
        path: check.path,
        includes: check.includes,
        matchedAlternative: check.includesAny?.find((text) => body.includes(text)),
        excludes: check.excludes ?? [],
      });
    }

    for (const check of jsonChecks) {
      const body = await readJsonRoute(check.path, check.allowedStatuses);
      for (const text of check.includes) {
        if (!body.includes(text)) {
          throw new Error(`${check.path} did not include expected text: ${text}`);
        }
      }
      for (const text of check.excludes ?? []) {
        if (body.includes(text)) {
          throw new Error(`${check.path} included forbidden text: ${text}`);
        }
      }
      console.log(`✓ ${check.path}`);
      results.push({
        path: check.path,
        includes: check.includes,
        excludes: check.excludes ?? [],
      });
    }

    if (health.services?.database?.status === "not_configured") {
      const freshDecisionId = await exerciseFreshDecision();
      console.log(`✓ fresh decision ${freshDecisionId}`);
      results.push({
        path: "/api/decisions/run",
        followUp: `/api/decisions/${freshDecisionId}`,
        scenario: "oversized",
      });
    } else {
      console.log("○ fresh decision skipped because persistent runs require a session");
    }

    if (reportPath) {
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(
        reportPath,
        `${JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            baseUrl,
            health,
            results,
          },
          null,
          2,
        )}\n`,
      );
      console.log(`Evidence report written to ${reportPath}`);
    }

    console.log("Judge-flow smoke passed.");
  } catch (error) {
    console.error(output.join(""));
    throw error;
  } finally {
    stopServer(server);
  }
}

await run();
