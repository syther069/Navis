// Captures the submission evidence screenshots with headless Chromium over the
// DevTools protocol. No Playwright dependency: Node's built-in WebSocket is enough.
//
// Usage:
//   NAVIS_SHOT_BASE_URL=https://navis-gilt.vercel.app node scripts/capture-evidence-screenshots.mjs
//
// Env:
//   NAVIS_SHOT_BASE_URL   origin to capture (default http://127.0.0.1:19732)
//   NAVIS_SHOT_DIR        output directory (default docs/evidence)
//   NAVIS_SHOT_PREFIX     file-name prefix (default final)
//   CHROMIUM_BIN          chromium binary (default chromium)

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = (process.env.NAVIS_SHOT_BASE_URL ?? "http://127.0.0.1:19732").replace(
  /\/+$/,
  "",
);
const outDir = process.env.NAVIS_SHOT_DIR ?? "docs/evidence";
const prefix = process.env.NAVIS_SHOT_PREFIX ?? "final";
const chromium = process.env.CHROMIUM_BIN ?? "chromium";
const port = 9333;

const browser = spawn(
  chromium,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    "--window-size=1440,1000",
    "about:blank",
  ],
  { stdio: "ignore" },
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
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

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? "evaluate failed");
    }
    return result.result.value;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'");
    await delay(800);
  }

  async waitFor(condition, timeoutMs = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await this.evaluate(`Boolean(${condition})`)) return;
      await delay(250);
    }
    throw new Error(`Timed out waiting for: ${condition}`);
  }

  async screenshot(file, { fullPage = true, maxHeight = 2200 } = {}) {
    if (fullPage) {
      const height = await this.evaluate(
        `Math.min(document.documentElement.scrollHeight, ${maxHeight})`,
      );
      await this.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await delay(300);
    }
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`saved ${file}`);
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const version = await waitForDevtools();
  const targetsResponse = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await targetsResponse.json();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No page target found");
  console.log(`Chromium ${version.Browser}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  const session = new Session(ws);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 1. Agent page with a fresh policy result and receipt hash together.
  await session.navigate(`${baseUrl}/agents/atlas`);
  await session.waitFor(
    "document.querySelector('.decision-run-panel form button[type=submit]')",
  );
  await session.evaluate(
    "document.querySelector('.decision-run-panel form button[type=submit]').click(); true",
  );
  await session.waitFor(
    "document.querySelector('[data-testid=decision-run-result]')",
    60000,
  );
  await delay(1000);
  const summary = await session.evaluate(
    "document.querySelector('[data-testid=decision-run-result]').innerText.slice(0, 400)",
  );
  console.log(`run result: ${summary.replace(/\s+/g, " ")}`);
  // Press Verify receipt so the verified badge is in the capture.
  await session.evaluate(
    "[...document.querySelectorAll('.decision-run-actions button')].find((b) => b.textContent.includes('Verify receipt')).click(); true",
  );
  await delay(500);

  const captureClip = async (selector, file, maxHeight = 6000) => {
    const clip = await session.evaluate(
      `(() => { const [first, last] = ${JSON.stringify(selector)}.split(" .. "); const a = document.querySelector(first).getBoundingClientRect(); const b = document.querySelector(last ?? first).getBoundingClientRect(); return { x: 0, y: a.top + window.scrollY, width: 1440, height: Math.min(b.bottom - a.top, ${maxHeight}) }; })()`,
    );
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: Math.ceil(clip.y + clip.height + 50),
      deviceScaleFactor: 1,
      mobile: false,
    });
    await delay(400);
    const { data } = await session.send("Page.captureScreenshot", {
      format: "png",
      clip: { ...clip, scale: 1 },
    });
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`saved ${file}`);
  };

  // Verdict (approved badge, why line, assurance badge) at the top of the result,
  // receipt hash plus "Receipt verified" at the bottom, and the whole result.
  await captureClip(
    ".decision-run-result .proof-verification-heading .. .decision-run-result .assurance-badge",
    join(outDir, `${prefix}-agent-run-verdict.png`),
  );
  await captureClip(
    ".decision-run-facts .. .decision-run-actions",
    join(outDir, `${prefix}-agent-run-receipt-hash.png`),
  );
  await captureClip(
    ".decision-run-panel",
    join(outDir, `${prefix}-agent-run-full.png`),
  );

  // 1b. Stored Atlas run: follow the panel's own links in a fresh, cookie-less
  // context so the decision and proof pages are proven readable without a
  // session and straight from the database (only when the run was stored).
  const storedLinks = await session.evaluate(
    "(() => { const d = document.querySelector('[data-testid=decision-run-open-decision]'); const p = document.querySelector('[data-testid=decision-run-view-proof]'); return d && p ? { decision: d.getAttribute('href'), proof: p.getAttribute('href') } : null; })()",
  );
  if (storedLinks) {
    console.log(`stored run links: ${storedLinks.decision} ${storedLinks.proof}`);
    await session.send("Network.clearBrowserCookies");
    await session.navigate(`${baseUrl}${storedLinks.decision}`);
    await session.waitFor(
      "document.body.textContent.includes('Public Atlas record') || document.body.textContent.includes('public Atlas record')",
    );
    await session.screenshot(join(outDir, `${prefix}-stored-decision.png`));
    await session.navigate(`${baseUrl}${storedLinks.proof}`);
    await session.waitFor("document.body.textContent.includes('Public verifier')");
    await session.screenshot(join(outDir, `${prefix}-stored-proof.png`));
  } else {
    console.log("run was not stored (no database); skipping stored-page captures");
  }

  // 2. Proof page.
  await session.navigate(`${baseUrl}/proofs/demo-proof`);
  await session.waitFor("document.body.textContent.includes('Public verifier')");
  await session.screenshot(join(outDir, `${prefix}-proof-page.png`));

  // 3. Markets Launch.
  await session.navigate(`${baseUrl}/markets/launch`);
  await session.waitFor("document.body.textContent.includes('PreStocks')");
  await delay(3000);
  await session.screenshot(join(outDir, `${prefix}-markets-launch.png`), {
    maxHeight: 4200,
  });

  // 4. Landing screen and agent list, viewport only.
  await session.navigate(`${baseUrl}/`);
  await session.screenshot(join(outDir, `${prefix}-landing.png`), { fullPage: false });

  ws.close();
}

try {
  await main();
} finally {
  browser.kill("SIGKILL");
}
