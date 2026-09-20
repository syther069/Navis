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
    path: "/",
    includes: [
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
    ],
  },
  {
    path: "/agents",
    includes: ["Agents", "Atlas", "Create an agent"],
  },
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
    includes: [
      "Proofs",
      "DEMO RECEIPT",
      "Simulation",
      "Offchain integrity",
      "Demo simulation",
    ],
  },
  {
    path: "/proofs/demo-proof",
    includes: [
      "Public verifier",
      "Transaction signature",
      "None",
      "Offchain only",
      "deterministic demo receipt",
      "Why this passed",
      "Offchain integrity",
      "Demo simulation",
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
  // The default universe is PreStocks; offline it must fall back visibly, and
  // either way the receipt must name its data source.
  if (
    !["prestocks", "fixture"].includes(run.universe?.used) ||
    (run.universe.used === "fixture" && typeof run.universe.note !== "string") ||
    run.receipt?.dataSource?.universe !== run.universe.used
  ) {
    throw new Error("Fresh decision did not report an honest asset universe");
  }
  const stored = await fetch(`${baseUrl}/api/decisions/${run.decisionId}`);
  if (!stored.ok) {
    throw new Error(`Fresh decision GET returned HTTP ${stored.status}`);
  }
  return { decisionId: run.decisionId, universe: run.universe.used };
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

    const unknownDecision = await fetch(`${baseUrl}/decisions/unknown-decision-id`, {
      headers: { accept: "text/html", "user-agent": "Navis judge-flow smoke test" },
      redirect: "manual",
    });
    if (unknownDecision.status !== 404) {
      throw new Error(
        `/decisions/unknown-decision-id returned HTTP ${unknownDecision.status}, expected 404`,
      );
    }
    console.log("✓ /decisions/unknown-decision-id -> 404");
    results.push({ path: "/decisions/unknown-decision-id", status: 404 });

    const unknownProof = await fetch(`${baseUrl}/proofs/unknown-proof-id`, {
      headers: { accept: "text/html", "user-agent": "Navis judge-flow smoke test" },
      redirect: "manual",
    });
    if (unknownProof.status !== 404) {
      throw new Error(
        `/proofs/unknown-proof-id returned HTTP ${unknownProof.status}, expected 404`,
      );
    }
    console.log("✓ /proofs/unknown-proof-id -> 404");
    results.push({ path: "/proofs/unknown-proof-id", status: 404 });

    if (health.services?.database?.status === "not_configured") {
      const fresh = await exerciseFreshDecision();
      console.log(`✓ fresh decision ${fresh.decisionId} (${fresh.universe} universe)`);
      results.push({
        path: "/api/decisions/run",
        followUp: `/api/decisions/${fresh.decisionId}`,
        scenario: "oversized",
        universe: fresh.universe,
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
