// Real-browser check that an interrupted agent save, followed by "Restore that
// mandate" and a second create, replays the first agent instead of creating a
// second one.
//
// Headless Chromium over the DevTools protocol (no Playwright). The browser
// holds a real wallet session cookie, uses its real localStorage and talks to
// the live /api/agents route. The sign-in itself is scripted: a fresh ed25519
// keypair signs the server challenge from Node, because a wallet extension
// cannot run in headless Chromium.
//
// Three scenarios, each with its own throwaway wallet and agent name:
//
//   reload    the page is reloaded in the same browser while the save is
//             pending (same process, same tab, same session cookie)
//   restart   the whole browser is closed while the save is pending and a new
//             Chromium is started on the same profile directory with the same
//             session cookie (the pending record must come back from disk)
//   resignin  same close and restart, but a second wallet signs in first and
//             must not see the restore offer, then the original keypair signs
//             in again (fresh nonce, fresh session cookie) and the retry
//             replays the first agent
//
// Shared flow of every scenario:
//   1. sign in (nonce, sign, verify) and put the session cookie in the browser
//   2. open /agents/new, fill a unique mandate, press "Review mandate"
//   3. press "Create agent"; the POST /api/agents is allowed to reach the
//      server but its response is held at the network layer and the browser
//      is interrupted while the save is still pending (the server has
//      committed, the browser never learned the result)
//   4. after the interruption press "Restore that mandate", "Review mandate",
//      "Create agent" again and let this POST through
//   5. assert: both POSTs carried the same clientRequestId, the second answer
//      is 200 with replayed: true, the browser landed on the agent page, the
//      pending record is gone from localStorage and GET /api/agents lists
//      exactly one agent with that name
//
// Usage:
//   NAVIS_REPLAY_BASE_URL=https://navis-gilt.vercel.app node scripts/browser-replay-check.mjs
//   node scripts/browser-replay-check.mjs --scenarios=restart,resignin --user-data-dir=/tmp/navis-profile
//
// Flags / env:
//   --user-data-dir=DIR     Chromium profile directory reused across the
//                           restart scenarios (default: a fresh temp directory,
//                           removed at the end). Env: NAVIS_REPLAY_USER_DATA_DIR
//   --scenarios=a,b         subset of reload,restart,resignin (default all).
//                           Env: NAVIS_REPLAY_SCENARIOS
//   NAVIS_REPLAY_BASE_URL   origin to check (default http://127.0.0.1:19732)
//   NAVIS_REPLAY_OUT        JSON report path (default docs/evidence/browser-replay-check.json)
//   NAVIS_REPLAY_SHOT_DIR   directory for the screenshots (default docs/evidence)
//   CHROMIUM_BIN            chromium binary (default chromium)

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import bs58 from "bs58";
import nacl from "tweetnacl";

const ALL_SCENARIOS = ["reload", "restart", "resignin"];

function flag(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

const baseUrl = (process.env.NAVIS_REPLAY_BASE_URL ?? "http://127.0.0.1:19732").replace(
  /\/+$/,
  "",
);
const outFile =
  process.env.NAVIS_REPLAY_OUT ?? "docs/evidence/browser-replay-check.json";
const shotDir = process.env.NAVIS_REPLAY_SHOT_DIR ?? "docs/evidence";
const chromium = process.env.CHROMIUM_BIN ?? "chromium";
const userDataDirFlag = flag("user-data-dir") ?? process.env.NAVIS_REPLAY_USER_DATA_DIR;
const scenarioNames = (flag("scenarios") ?? process.env.NAVIS_REPLAY_SCENARIOS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const selected = scenarioNames.length > 0 ? scenarioNames : ALL_SCENARIOS;
for (const name of selected) {
  if (!ALL_SCENARIOS.includes(name)) {
    console.error(
      `unknown scenario "${name}"; choose from ${ALL_SCENARIOS.join(", ")}`,
    );
    process.exit(2);
  }
}

const port = 9334;
const SESSION_COOKIE = "navis_session";
const PENDING_KEY = "navis:agent-creation:pending";

const report = {
  base: baseUrl,
  checkedAt: new Date().toISOString(),
  note: "Headless Chromium over CDP with a real session cookie and real localStorage against the live /api/agents route. Sign-in used scripted ed25519 keypairs. In every scenario the first POST reached the server and its response was held while the browser was interrupted mid-save.",
  scenarios: [],
  passed: false,
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

// ---------------------------------------------------------------------------
// Scripted wallet sign-in from Node. The same keypair can sign in again and
// gets a fresh nonce and a fresh session cookie each time.

function newKeypair() {
  const keypair = nacl.sign.keyPair();
  return { keypair, wallet: bs58.encode(keypair.publicKey) };
}

async function signIn({ keypair, wallet }, step) {
  const headers = { "Content-Type": "application/json", Origin: baseUrl };

  const nonceResponse = await fetch(`${baseUrl}/api/auth/nonce`, {
    method: "POST",
    headers,
    body: JSON.stringify({ wallet }),
  });
  const challenge = await nonceResponse.json();
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
  step("signIn", {
    wallet,
    nonceStatus: nonceResponse.status,
    verifyStatus: verifyResponse.status,
    authenticated: verified.authenticated,
  });
  assert(verifyResponse.status === 200, `verify returned ${verifyResponse.status}`);

  const setCookie = verifyResponse.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  assert(match, "verify response carried no session cookie");
  return match[1];
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

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

// Browser lifecycle ---------------------------------------------------------

// One Chromium process on the given profile directory plus a CDP session to
// its first tab. `posts` collects every POST /api/agents seen by this
// process; `state.release` decides whether their responses are held.
async function launchBrowser(userDataDir, state) {
  const child = spawn(
    chromium,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--window-size=1280,1400",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const version = await waitForDevtools();
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

  // Hold every POST /api/agents at the response stage until told otherwise.
  // The request itself reaches the server; only the answer is intercepted.
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
      held: !state.release,
    };
    if (state.release) {
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
    state.posts.push(record);
    console.log(
      `POST /api/agents ${record.held ? "held" : "released"}: ${JSON.stringify(record)}`,
    );
  });

  return {
    child,
    session,
    version: version.Browser,
    pid: child.pid,
    // Close like a user quitting the browser: Browser.close asks Chromium to
    // shut down (which flushes DOM storage to the profile), then SIGKILL if
    // it lingers. The page session stays attached until the process is gone:
    // detaching it first would release the held response, the page would
    // learn about the save and the pending record would be cleared, which is
    // not the case being tested. A SIGKILL alone loses recent localStorage
    // writes, so it is only the fallback.
    async close() {
      const clean = await (async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/json/version`);
          const info = await response.json();
          const browserWs = new WebSocket(info.webSocketDebuggerUrl);
          await new Promise((resolve, reject) => {
            browserWs.addEventListener("open", resolve);
            browserWs.addEventListener("error", reject);
          });
          browserWs.send(JSON.stringify({ id: 1, method: "Browser.close" }));
          return await waitForExit(child, 5000);
        } catch {
          return false;
        }
      })();
      if (!clean) {
        child.kill("SIGKILL");
        await waitForExit(child, 5000);
      }
      try {
        ws.close();
      } catch {
        // already gone
      }
      return {
        pid: child.pid,
        exited: child.exitCode !== null || child.signalCode !== null,
        closedCleanly: clean,
      };
    },
  };
}

// Real cookie jar: the httpOnly session cookie the wallet flow would set.
// Setting a cookie with the same name replaces the previous one, which is
// exactly what a new sign-in does.
async function setSessionCookie(session, token) {
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

const pendingRecordExpression = `JSON.parse(localStorage.getItem(${JSON.stringify(PENDING_KEY)}) ?? "null")`;

async function openForm(session, step, label) {
  await session.navigate(`${baseUrl}/agents/new`);
  await session.waitFor("document.getElementById('name')");
  await delay(500);
  // The page header reports the session state from the server render.
  const authenticatedHeader = await session.evaluate(
    "document.body.textContent.includes('Wallet-authenticated draft')",
  );
  step(label, { authenticatedHeader });
  assert(authenticatedHeader, "page does not report a wallet-authenticated draft");
}

async function restoreOfferState(session, agentName) {
  const noticeShown = await session.evaluate(
    `document.body.textContent.includes("An earlier save of") && document.body.textContent.includes(${JSON.stringify(agentName)})`,
  );
  const restoreVisible = await session.evaluate(buttonExists("Restore that mandate"));
  const pendingRecord = await session.evaluate(pendingRecordExpression);
  return {
    noticeShown,
    restoreVisible,
    pendingRecordPresent: Boolean(pendingRecord?.key),
    pendingRecordWallet: pendingRecord?.wallet ?? null,
  };
}

// Scenario phases ----------------------------------------------------------

// Steps 1 to 3 of the shared flow: sign in, fill, review, create with the
// answer held. Returns the identity and the held POST.
async function beginHeldSave(browser, identity, token, state, step, agentName) {
  await setSessionCookie(browser.session, token);
  await openForm(browser.session, step, "openForm");

  await browser.session.evaluate(setFieldExpression("name", agentName));
  await browser.session.evaluate(
    setFieldExpression(
      "objective",
      "Browser replay check: hold a balanced demo mandate and never trade twice for one save.",
    ),
  );
  await delay(200);
  await clickButton(browser.session, "Review mandate");
  await browser.session.waitFor(buttonExists("Create agent"));
  const pendingAfterReview = await browser.session.evaluate(pendingRecordExpression);
  step("review", {
    pendingKeyStored: Boolean(pendingAfterReview?.key),
    pendingWalletMatches: pendingAfterReview?.wallet === identity.wallet,
  });
  assert(pendingAfterReview?.key, "no pending record after review");

  await clickButton(browser.session, "Create agent");
  const started = Date.now();
  while (state.posts.length === 0 && Date.now() - started < 30000) await delay(100);
  assert(state.posts.length === 1, "first POST /api/agents did not reach the server");
  const first = state.posts[0];
  const savingShown = await browser.session.evaluate(
    "[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Saving'))",
  );
  step("firstCreateHeld", {
    serverStatus: first.status,
    clientRequestId: first.clientRequestId,
    savingShown,
  });
  assert(first.status === 201, `first create answered ${first.status}, expected 201`);
  return first;
}

// Steps 4 and 5: restore, retry with the answer released, verify the replay.
async function finishWithRetry(
  browser,
  token,
  state,
  step,
  agentName,
  first,
  shotName,
  agentPageShotName = null,
) {
  const offer = await restoreOfferState(browser.session, agentName);
  step("restoreOffer", offer);
  assert(offer.restoreVisible, "Restore that mandate button missing");
  await browser.session.screenshot(join(shotDir, shotName));

  state.release = true;
  await clickButton(browser.session, "Restore that mandate");
  await delay(200);
  const restoredName = await browser.session.evaluate(
    "document.getElementById('name').value",
  );
  assert(restoredName === agentName, `restored name was ${restoredName}`);
  await clickButton(browser.session, "Review mandate");
  await browser.session.waitFor(buttonExists("Create agent"));
  await clickButton(browser.session, "Create agent");

  const started = Date.now();
  while (state.posts.length < 2 && Date.now() - started < 30000) await delay(100);
  assert(state.posts.length === 2, "second POST /api/agents did not happen");
  const second = state.posts[1];
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

  await browser.session.waitFor(
    `location.pathname === "/agents/" + encodeURIComponent(${JSON.stringify(second.slug)})`,
  );
  await browser.session.waitFor(
    `document.body.textContent.includes(${JSON.stringify(agentName)})`,
  );
  const pendingAfterSuccess = await browser.session.evaluate(
    `localStorage.getItem(${JSON.stringify(PENDING_KEY)})`,
  );
  step("landedOnAgent", {
    path: await browser.session.evaluate("location.pathname"),
    pendingCleared: pendingAfterSuccess === null,
  });
  assert(pendingAfterSuccess === null, "pending record still present after success");
  if (agentPageShotName) {
    await browser.session.screenshot(join(shotDir, agentPageShotName));
  }

  // Independent count from a fresh request with the current session.
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
}

// Close the browser with the save pending and start a new one on the same
// profile. Chromium's DevTools port is reused, so wait for the old process.
async function restartBrowser(browser, userDataDir, state, step) {
  const closed = await browser.close();
  assert(closed.exited, "old Chromium process did not exit");
  await delay(500);
  const reopened = await launchBrowser(userDataDir, state);
  step("browserRestarted", {
    closedPid: closed.pid,
    closedCleanly: closed.closedCleanly,
    newPid: reopened.pid,
    sameProfile: true,
    userDataDir,
  });
  return reopened;
}

// Scenarios ----------------------------------------------------------------

const scenarios = {
  async reload({ browser, identity, token, state, step, agentName }) {
    const first = await beginHeldSave(browser, identity, token, state, step, agentName);
    await browser.session.send("Page.reload", { ignoreCache: false });
    await browser.session.waitFor("document.getElementById('name')");
    await delay(500);
    step("reloadMidSave", { samePid: browser.pid });
    await finishWithRetry(
      browser,
      token,
      state,
      step,
      agentName,
      first,
      "browser-replay-restore-offer.png",
      "browser-replay-agent-page.png",
    );
    return browser;
  },

  async restart({ browser, identity, token, state, step, agentName, userDataDir }) {
    const first = await beginHeldSave(browser, identity, token, state, step, agentName);
    const reopened = await restartBrowser(browser, userDataDir, state, step);
    // Session cookies do not outlive the process; the same token goes back in.
    await setSessionCookie(reopened.session, token);
    await openForm(reopened.session, step, "openFormAfterRestart");
    await finishWithRetry(
      reopened,
      token,
      state,
      step,
      agentName,
      first,
      "browser-replay-restart-restore-offer.png",
    );
    return reopened;
  },

  async resignin({ browser, identity, token, state, step, agentName, userDataDir }) {
    const first = await beginHeldSave(browser, identity, token, state, step, agentName);
    const reopened = await restartBrowser(browser, userDataDir, state, step);

    // A different wallet in the same browser must not be offered the record.
    const other = newKeypair();
    const otherToken = await signIn(other, step);
    await setSessionCookie(reopened.session, otherToken);
    await openForm(reopened.session, step, "openFormAsOtherWallet");
    const otherOffer = await restoreOfferState(reopened.session, agentName);
    step("otherWalletSeesNoOffer", { otherWallet: other.wallet, ...otherOffer });
    assert(
      !otherOffer.restoreVisible && !otherOffer.noticeShown,
      "other wallet saw the offer",
    );
    assert(
      otherOffer.pendingRecordPresent &&
        otherOffer.pendingRecordWallet === identity.wallet,
      "pending record for the first wallet was not left in place",
    );
    await reopened.session.screenshot(
      join(shotDir, "browser-replay-other-wallet-no-offer.png"),
    );

    // The original keypair signs in again: new nonce, new session cookie.
    const freshToken = await signIn(identity, step);
    step("freshSession", { sameWallet: true, cookieChanged: freshToken !== token });
    assert(freshToken !== token, "second sign-in reused the first session cookie");
    await setSessionCookie(reopened.session, freshToken);
    await openForm(reopened.session, step, "openFormAfterResignin");
    await finishWithRetry(
      reopened,
      freshToken,
      state,
      step,
      agentName,
      first,
      "browser-replay-resignin-restore-offer.png",
    );
    return reopened;
  },
};

async function runScenario(name, userDataDir) {
  const entry = { name, wallet: null, agentName: null, steps: [], passed: false };
  report.scenarios.push(entry);
  const step = (label, data) => {
    entry.steps.push({ name: label, ...data });
    console.log(`[${name}] ${label}: ${JSON.stringify(data)}`);
  };

  const identity = newKeypair();
  entry.wallet = identity.wallet;
  const agentName = `browser-replay-${name}-${randomBytes(3).toString("hex")}`;
  entry.agentName = agentName;
  const token = await signIn(identity, step);

  const state = { posts: [], release: false };
  // Each scenario starts from an empty profile so a leftover record from an
  // earlier scenario can never be mistaken for this one.
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
  await mkdir(userDataDir, { recursive: true });
  let browser = await launchBrowser(userDataDir, state);
  console.log(`[${name}] Chromium ${browser.version} pid ${browser.pid}`);
  try {
    browser = await scenarios[name]({
      browser,
      identity,
      token,
      state,
      step,
      agentName,
      userDataDir,
    });
    entry.passed = true;
  } catch (error) {
    entry.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await browser.close();
  }
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

  const userDataDir =
    userDataDirFlag ?? (await mkdtemp(join(tmpdir(), "navis-replay-")));
  report.userDataDir = userDataDir;
  report.userDataDirTemporary = !userDataDirFlag;

  try {
    for (const name of selected) {
      await runScenario(name, userDataDir);
    }
    report.passed = report.scenarios.every((scenario) => scenario.passed);
  } finally {
    if (!userDataDirFlag)
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
    await writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report ${outFile}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
