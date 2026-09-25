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
      "Deterministic Policy",
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
      connection: "close",
    },
    redirect: "manual",
  });

  if (!response.ok) {
    await response.text().catch(() => {});
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
    await response.text().catch(() => {});
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  return response.text();
}

async function exerciseFreshDecision(databaseStatus) {
  const stored = databaseStatus === "ok";
  const requestKey = `smoke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const response = await fetch(`${baseUrl}/api/decisions/run`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: baseUrl,
      "user-agent": "Navis judge-flow smoke test",
    },
    body: JSON.stringify({
      agentSlug: "atlas",
      scenario: "oversized",
      ...(stored ? { requestKey } : {}),
    }),
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
  if (stored) {
    // With a database the run is a public record: stored, with a proof page,
    // readable without any session, and a retried key returns the same row.
    if (run.persisted?.store !== "database" || run.persisted?.visibility !== "public") {
      throw new Error("Fresh Atlas decision was not stored as a public record");
    }
    if (typeof run.proofId !== "string") {
      throw new Error("Stored Atlas decision has no proof id");
    }
    if (
      run.receipt?.execution?.transactionSignature ||
      run.receipt?.execution?.explorerUrl
    ) {
      throw new Error("Stored Atlas receipt claims onchain evidence");
    }
    for (const path of [`/decisions/${run.decisionId}`, `/proofs/${run.proofId}`]) {
      const page = await fetch(`${baseUrl}${path}`, {
        headers: { accept: "text/html", "user-agent": "Navis judge-flow smoke test" },
        redirect: "manual",
      });
      if (page.status !== 200) {
        throw new Error(`${path} returned HTTP ${page.status} for an anonymous reader`);
      }
    }
    const replay = await fetch(`${baseUrl}/api/decisions/run`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: baseUrl,
        "user-agent": "Navis judge-flow smoke test",
      },
      body: JSON.stringify({ agentSlug: "atlas", scenario: "oversized", requestKey }),
    });
    const twin = await replay.json();
    if (
      !replay.ok ||
      twin.decisionId !== run.decisionId ||
      twin.proofId !== run.proofId
    ) {
      throw new Error("Retried Atlas request key did not return the stored record");
    }
  } else if (run.persisted?.store !== "memory") {
    throw new Error("Without a database the Atlas run must say it is memory only");
  }
  const found = await fetch(`${baseUrl}/api/decisions/${run.decisionId}`);
  if (!found.ok) {
    throw new Error(`Fresh decision GET returned HTTP ${found.status}`);
  }
  return {
    decisionId: run.decisionId,
    proofId: run.proofId ?? null,
    universe: run.universe.used,
    store: run.persisted?.store ?? null,
  };
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

  const startedAt = new Date().toISOString();
  const results = [];
  let health = null;
  let step = "/api/health";
  let failed = false;

  try {
    health = await waitForReady();

    for (const check of checks) {
      step = check.path;
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
      step = check.path;
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

    step = "/decisions/unknown-decision-id";
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

    step = "/proofs/unknown-proof-id";
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

    const databaseStatus = health.services?.database?.status;
    if (databaseStatus === "not_configured" || databaseStatus === "ok") {
      step = "/api/decisions/run and persisted follow-up";
      const fresh = await exerciseFreshDecision(databaseStatus);
      console.log(
        `✓ fresh decision ${fresh.decisionId} (${fresh.universe} universe, ${fresh.store})` +
          (fresh.proofId ? ` proof ${fresh.proofId}` : ""),
      );
      results.push({
        path: "/api/decisions/run",
        followUp: `/api/decisions/${fresh.decisionId}`,
        proof: fresh.proofId ? `/proofs/${fresh.proofId}` : null,
        scenario: "oversized",
        universe: fresh.universe,
        store: fresh.store,
      });
    } else {
      console.log(`○ fresh decision skipped because the database is ${databaseStatus}`);
    }
  } catch (error) {
    failed = true;
    console.error(output.join(""));
    console.error(error.message);
  } finally {
    try {
      if (reportPath) {
        await mkdir(dirname(reportPath), { recursive: true });
        await writeFile(
          reportPath,
          `${JSON.stringify(
            {
              startedAt,
              checkedAt: new Date().toISOString(),
              baseUrl: new URL(baseUrl).origin,
              status: failed ? "failed" : "passed",
              failedStep: failed ? step : null,
              // No raw response bodies, cookies, exception stacks or server logs.
              failure: failed
                ? "Smoke verification failed at the recorded step. Consult CI logs."
                : null,
              health,
              results,
            },
            null,
            2,
          )}\n`,
        );
        console.log(`Evidence report written to ${reportPath}`);
      }
    } catch (reportError) {
      console.error("Could not write smoke evidence report.");
      // Preserve the original verification failure if both operations fail.
      if (!failed) throw reportError;
    } finally {
      stopServer(server);
    }
  }
  if (failed) {
    process.exitCode = 1;
    return;
  }
  console.log("Judge-flow smoke passed.");
}

await run();
