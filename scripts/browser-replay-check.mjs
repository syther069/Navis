// Real-browser check that a reload in the middle of an agent save, followed by
// "Restore that mandate" and a second create, replays the first agent instead
// of creating a second one.
//
// Headless Chromium over the DevTools protocol (no Playwright). The browser
// holds a real wallet session cookie, uses its real localStorage and talks to
// the live /api/agents route. The sign-in itself is scripted: a fresh ed25519
// keypair signs the server challenge from Node, because a wallet extension
// cannot run in headless Chromium.
//
// Flow:
//   1. sign in (nonce, sign, verify) and put the session cookie in the browser
//   2. open /agents/new, fill a unique mandate, press "Review mandate"
//   3. press "Create agent"; the POST /api/agents is allowed to reach the
//      server but its response is held at the network layer and the page is
//      reloaded while the save is still pending (the server has committed,
//      the browser never learned the result)
//   4. after the reload press "Restore that mandate", "Review mandate",
//      "Create agent" again and let this POST through
//   5. assert: both POSTs carried the same clientRequestId, the second answer
//      is 200 with replayed: true, the browser landed on the agent page, the
//      pending record is gone from localStorage and GET /api/agents lists
//      exactly one agent with that name
//
// Usage:
//   NAVIS_REPLAY_BASE_URL=https://navis-gilt.vercel.app node scripts/browser-replay-check.mjs
//
// Env:
//   NAVIS_REPLAY_BASE_URL   origin to check (default http://127.0.0.1:19732)
//   NAVIS_REPLAY_OUT        JSON report path (default docs/evidence/browser-replay-check.json)
//   NAVIS_REPLAY_SHOT_DIR   directory for the two screenshots (default docs/evidence)
//   CHROMIUM_BIN            chromium binary (default chromium)

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import bs58 from "bs58";
import nacl from "tweetnacl";

const baseUrl = (process.env.NAVIS_REPLAY_BASE_URL ?? "http://127.0.0.1:19732").replace(
  /\/+$/,
  "",
);
const outFile =
  process.env.NAVIS_REPLAY_OUT ?? "docs/evidence/browser-replay-check.json";
const shotDir = process.env.NAVIS_REPLAY_SHOT_DIR ?? "docs/evidence";
const chromium = process.env.CHROMIUM_BIN ?? "chromium";
const port = 9334;
const SESSION_COOKIE = "navis_session";
const PENDING_KEY = "navis:agent-creation:pending";

const report = {
  base: baseUrl,
  checkedAt: new Date().toISOString(),
  note: "Headless Chromium over CDP with a real session cookie and real localStorage against the live /api/agents route. Sign-in used a scripted ed25519 keypair. The first POST reached the server; its response was held and the page reloaded mid-save.",
  wallet: null,
  agentName: null,
  steps: [],
  passed: false,
};

function step(name, data) {
  report.steps.push({ name, ...data });
  console.log(`${name}: ${JSON.stringify(data)}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

// ---------------------------------------------------------------------------
// Scripted wallet sign-in from Node.

async function signIn() {
  const keypair = nacl.sign.keyPair();
  const wallet = bs58.encode(keypair.publicKey);
  report.wallet = wallet;
  const headers = { "Content-Type": "application/json", Origin: baseUrl };

  const nonceResponse = await fetch(`${baseUrl}/api/auth/nonce`, {
    method: "POST",
    headers,
    body: JSON.stringify({ wallet }),
  });
  const challenge = await nonceResponse.json();
  step("nonce", { status: nonceResponse.status });
  assert(nonceResponse.status === 200, `nonce returned ${nonceResponse.status}`);

  const signature = bs58.encode(
    nacl.sign.detached(new TextEncoder().encode(challenge.message), keypair.secretKey),
  );
  const verifyResponse = await fetch(`${baseUrl}/api/auth/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      wallet,
      nonce: challenge.nonce,
      signature,
    }),
  });
  const verified = await verifyResponse.json().catch(() => ({}));
  step("verify", {
    status: verifyResponse.status,
    authenticated: verified.authenticated,
  });
  assert(verifyResponse.status === 200, `verify returned ${verifyResponse.status}`);

  const setCookie = verifyResponse.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  assert(match, "verify response carried no session cookie");
  return { wallet, token: match[1] };
}

// ---------------------------------------------------------------------------
// Minimal CDP session.

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        for (const listener of this.listeners) listener(message);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "evaluate failed",
      );
    }
    return result.result.value;
  }

  async waitFor(condition, timeoutMs = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      let ok = false;
      try {
        ok = await this.evaluate(`Boolean(${condition})`);
      } catch {
        // context torn down by a navigation; try again
      }
      if (ok) return;
      await delay(250);
    }
    throw new Error(`Timed out waiting for: ${condition}`);
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'");
    await delay(800);
  }

  async screenshot(file) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`saved ${file}`);
  }
}

async function waitForDevtools() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // not up yet
    }
    await delay(200);
  }
  throw new Error("Chromium DevTools endpoint did not come up");
}

// Page helpers -------------------------------------------------------------

// React controlled inputs ignore a plain `value =` assignment; go through the
// prototype setter and fire an input event so React's onChange runs.
function setFieldExpression(id, value) {
  return `(() => {
    const el = document.getElementById(${JSON.stringify(id)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return el.value;
  })()`;
}

function clickButtonExpression(text) {
  return `(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.includes(${JSON.stringify(text)}));
    if (!button) return false;
    button.click();
    return true;
  })()`;
}

function buttonExists(text) {
  return `[...document.querySelectorAll("button")].some((b) => b.textContent.includes(${JSON.stringify(text)}))`;
}

async function clickButton(session, text) {
  await session.waitFor(buttonExists(text));
  const clicked = await session.evaluate(clickButtonExpression(text));
  assert(clicked, `button "${text}" not found`);
}

async function main() {
  await mkdir(dirname(outFile), { recursive: true });
  await mkdir(shotDir, { recursive: true });

  const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
  report.health = {
    database: health.services?.database,
    walletSessions: health.services?.walletSessions,
    deployment: health.deployment ?? null,
  };

  const { wallet, token } = await signIn();
  const agentName = `browser-replay-${randomBytes(3).toString("hex")}`;
  report.agentName = agentName;

  const browser = spawn(
    chromium,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      "--window-size=1280,1400",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const version = await waitForDevtools();
    console.log(`Chromium ${version.Browser}`);
    const targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
    const page = targets.find((target) => target.type === "page");
    assert(page, "no page target");

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    const session = new Session(ws);
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("Network.enable");
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 1400,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Real cookie jar: the httpOnly session cookie the wallet flow would set.
    const origin = new URL(baseUrl);
    const cookieSet = await session.send("Network.setCookie", {
      name: SESSION_COOKIE,
      value: token,
      domain: origin.hostname,
      path: "/",
      httpOnly: true,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    });
    assert(cookieSet.success, "session cookie was not accepted by the browser");

    // Hold every POST /api/agents at the response stage until told otherwise.
    // The request itself reaches the server; only the answer is intercepted.
    const posts = [];
    let releaseResponses = false;
    await session.send("Fetch.enable", {
      patterns: [{ urlPattern: "*/api/agents", requestStage: "Response" }],
    });
    session.on(async (message) => {
      if (message.method !== "Fetch.requestPaused") return;
      const { requestId, request, responseStatusCode } = message.params;
      if (request.method !== "POST") {
        await session.send("Fetch.continueResponse", { requestId }).catch(() => {});
        return;
      }
      let body = {};
      try {
        body = JSON.parse(request.postData ?? "{}");
      } catch {
        // leave empty
      }
      const record = {
        clientRequestId: body.clientRequestId ?? null,
        name: body.name ?? null,
        status: responseStatusCode,
        held: !releaseResponses,
      };
      if (releaseResponses) {
        const { body: encoded, base64Encoded } = await session.send(
          "Fetch.getResponseBody",
          {
            requestId,
          },
        );
        const text = base64Encoded
          ? Buffer.from(encoded, "base64").toString("utf8")
          : encoded;
        try {
          const json = JSON.parse(text);
          record.replayed = json.replayed ?? null;
          record.slug = json.agent?.slug ?? null;
        } catch {
          record.bodyPrefix = text.slice(0, 200);
        }
        await session.send("Fetch.continueResponse", { requestId }).catch(() => {});
      }
      posts.push(record);
      console.log(
        `POST /api/agents ${record.held ? "held" : "released"}: ${JSON.stringify(record)}`,
      );
    });

    // 2. Fill and review the mandate.
    await session.navigate(`${baseUrl}/agents/new`);
    await session.waitFor("document.getElementById('name')");
    // The page header reports the session state from the server render.
    const authenticatedHeader = await session.evaluate(
      "document.body.textContent.includes('Wallet-authenticated draft')",
    );
    step("openForm", { authenticatedHeader });
    assert(authenticatedHeader, "page does not report a wallet-authenticated draft");

    await session.evaluate(setFieldExpression("name", agentName));
    await session.evaluate(
      setFieldExpression(
        "objective",
        "Browser replay check: hold a balanced demo mandate and never trade twice for one save.",
      ),
    );
    await delay(200);
    await clickButton(session, "Review mandate");
    await session.waitFor(buttonExists("Create agent"));
    const pendingAfterReview = await session.evaluate(
      `JSON.parse(localStorage.getItem(${JSON.stringify(PENDING_KEY)}) ?? "null")`,
    );
    step("review", {
      pendingKeyStored: Boolean(pendingAfterReview?.key),
      pendingWalletMatches: pendingAfterReview?.wallet === wallet,
    });
    assert(pendingAfterReview?.key, "no pending record after review");

    // 3. Create, then reload while the answer is held.
    await clickButton(session, "Create agent");
    const started = Date.now();
    while (posts.length === 0 && Date.now() - started < 30000) await delay(100);
    assert(posts.length === 1, "first POST /api/agents did not reach the server");
    const first = posts[0];
    const savingShown = await session.evaluate(
      "[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Saving'))",
    );
    step("firstCreateHeld", {
      serverStatus: first.status,
      clientRequestId: first.clientRequestId,
      savingShown,
    });
    assert(first.status === 201, `first create answered ${first.status}, expected 201`);

    await session.send("Page.reload", { ignoreCache: false });
    await session.waitFor("document.getElementById('name')");
    await delay(500);
    const noticeShown = await session.evaluate(
      `document.body.textContent.includes("An earlier save of") && document.body.textContent.includes(${JSON.stringify(agentName)})`,
    );
    const restoreVisible = await session.evaluate(buttonExists("Restore that mandate"));
    step("reloadMidSave", { noticeShown, restoreVisible });
    assert(restoreVisible, "Restore that mandate button missing after the reload");
    await session.screenshot(join(shotDir, "browser-replay-restore-offer.png"));

    // 4. Restore, review and create again with the response released.
    releaseResponses = true;
    await clickButton(session, "Restore that mandate");
    await delay(200);
    const restoredName = await session.evaluate(
      "document.getElementById('name').value",
    );
    assert(restoredName === agentName, `restored name was ${restoredName}`);
    await clickButton(session, "Review mandate");
    await session.waitFor(buttonExists("Create agent"));
    await clickButton(session, "Create agent");

    const started2 = Date.now();
    while (posts.length < 2 && Date.now() - started2 < 30000) await delay(100);
    assert(posts.length === 2, "second POST /api/agents did not happen");
    const second = posts[1];
    step("secondCreate", {
      status: second.status,
      replayed: second.replayed,
      slug: second.slug,
      sameClientRequestId: second.clientRequestId === first.clientRequestId,
    });
    assert(second.clientRequestId === first.clientRequestId, "request keys differ");
    assert(
      second.status === 200 && second.replayed === true,
      "second create was not a replay",
    );

    await session.waitFor(
      `location.pathname === "/agents/" + encodeURIComponent(${JSON.stringify(second.slug)})`,
    );
    await session.waitFor(
      `document.body.textContent.includes(${JSON.stringify(agentName)})`,
    );
    const pendingAfterSuccess = await session.evaluate(
      `localStorage.getItem(${JSON.stringify(PENDING_KEY)})`,
    );
    step("landedOnAgent", {
      path: await session.evaluate("location.pathname"),
      pendingCleared: pendingAfterSuccess === null,
    });
    assert(pendingAfterSuccess === null, "pending record still present after success");
    await session.screenshot(join(shotDir, "browser-replay-agent-page.png"));

    // 5. Independent count from a fresh request with the same session.
    const list = await fetch(`${baseUrl}/api/agents`, {
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
    });
    const listed = await list.json();
    const agents = Array.isArray(listed.agents) ? listed.agents : [];
    const matching = agents.filter((agent) => agent.name === agentName);
    step("listFreshRequest", {
      status: list.status,
      matchingAgents: matching.length,
      slugs: matching.map((agent) => agent.slug),
    });
    assert(matching.length === 1, `expected one agent, found ${matching.length}`);
    assert(
      matching[0].slug === second.slug,
      "listed slug differs from the replayed slug",
    );

    report.passed = true;
    ws.close();
  } finally {
    browser.kill();
    await writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report ${outFile}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
