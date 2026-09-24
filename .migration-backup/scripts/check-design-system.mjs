// Read-only responsive checks against a running Navis app. No wallet signing,
// decision creation, authentication or transaction submission.
// Usage: node scripts/check-design-system.mjs https://<dev-domain> /tmp/navis-ui
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) {
  throw new Error("Pass the running app origin as the first argument.");
}
const output = process.argv[3] ?? "/tmp/navis-design-check";
const routes = [
  "/",
  "/agents/atlas",
  "/agents/new",
  "/markets/launch",
  "/proofs/demo-proof",
  "/settings",
  "/disclosures",
];
const widths = [320, 375, 414, 768, 1024, 1280];
const profile = await mkdtemp(join(tmpdir(), "navis-design-browser-"));
const browser = spawn(
  process.env.CHROMIUM_BIN ?? "chromium",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { base, checkedAt: new Date().toISOString(), pages: [], errors: [] };
let ws;
try {
  await mkdir(output, { recursive: true });
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = Number(
        (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0],
      );
      break;
    } catch {
      await delay(100);
    }
  }
  if (!port) throw new Error("Browser failed to open DevTools.");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(
    targets.find((target) => target.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      report.errors.push(message.params.exceptionDetails.text);
    }
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`DevTools timed out: ${method}`));
      }, 45000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }
    return result.result.value;
  }
  await send("Page.enable");
  await send("Runtime.enable");
  for (const route of routes) {
    await send("Page.navigate", { url: `${base.replace(/\/$/, "")}${route}` });
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      ready = await evaluate(
        `location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete' && !!document.querySelector('#workspace h1')`,
      );
      if (ready) break;
      await delay(300);
    }
    if (!ready) throw new Error(`Page did not become ready: ${route}`);
    await evaluate("document.fonts.ready.then(() => true)");
    for (const width of widths) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await delay(180);
      const metrics = await evaluate(`(() => {
        const visible = e => {
          const r=e.getBoundingClientRect(), s=getComputedStyle(e);
          return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none' && !e.closest('[inert]');
        };
        const outside = Array.from(document.querySelectorAll('#workspace *, .workspace-bar *'))
          .filter(e => visible(e) && !e.closest('.skip-link'))
          .filter(e => {
            const r=e.getBoundingClientRect();
            if(r.left>=-1 && r.right<=innerWidth+1) return false;
            for(let p=e.parentElement;p && p!==document.body;p=p.parentElement){
              if(['auto','scroll'].includes(getComputedStyle(p).overflowX)) return false;
            }
            return true;
          }).slice(0,12).map(e=>({tag:e.tagName,className:e.className,text:e.textContent.slice(0,65)}));
        return {
          title:document.querySelector('h1')?.textContent,
          width:innerWidth, documentWidth:document.documentElement.scrollWidth,
          outside,
          unlabeledButtons:Array.from(document.querySelectorAll('button')).filter(visible)
            .filter(e=>!e.textContent.trim() && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.title).length,
          networkText:document.querySelector('.workspace-bar')?.textContent,
        };
      })()`);
      report.pages.push({ route, ...metrics });
      const helpIssues = await evaluate(`(async () => {
        const problems=[];
        for(const trigger of document.querySelectorAll('.info-hint-trigger')){
          if(!trigger.getClientRects().length) continue;
          trigger.click();
          await new Promise(resolve=>setTimeout(resolve,180));
          const panel=document.getElementById(trigger.getAttribute('aria-controls'));
          const rect=panel?.getBoundingClientRect();
          if(!panel || panel.hidden || !rect || rect.left<0 || rect.right>innerWidth+1){
            problems.push('Help panel clipped or unavailable: '+trigger.getAttribute('aria-label'));
          }
          document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
          await new Promise(resolve=>setTimeout(resolve,30));
          if(!panel?.hidden || document.activeElement!==trigger){
            problems.push('Help dismissal/focus failed: '+trigger.getAttribute('aria-label'));
          }
        }
        return problems;
      })()`);
      report.errors.push(
        ...helpIssues.map((issue) => `${route} at ${width}px: ${issue}`),
      );
      if (width === 375 && route === "/settings") {
        const navigationIssue = await evaluate(`(async () => {
          const menu=document.querySelector('[aria-label="Open navigation"]');
          menu.click();
          await new Promise(resolve=>setTimeout(resolve,100));
          const drawer=document.querySelector('#mobile-navigation');
          if(!drawer || !document.querySelector('.workspace-column[inert]')) return 'Drawer did not open with an inert background';
          if(!drawer.querySelector('a[href="/settings"][aria-current="page"]')) return 'Current Settings link missing';
          const close=drawer.querySelector('[aria-label="Close navigation"]');
          if(document.activeElement!==close) return 'Initial drawer focus missing';
          document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true}));
          if(document.activeElement!==drawer.querySelector('a[href="/settings"]')) return 'Drawer focus trap failed';
          document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
          await new Promise(resolve=>setTimeout(resolve,100));
          return !document.querySelector('#mobile-navigation') && document.activeElement===menu ? null : 'Drawer Escape/focus restore failed';
        })()`);
        if (navigationIssue) report.errors.push(navigationIssue);
      }
      if (width === 375 && route === "/") {
        const walletIssue = await evaluate(`(async () => {
          const trigger=document.querySelector('.wallet-button');
          trigger.click();
          await new Promise(resolve=>setTimeout(resolve,150));
          const dialog=document.querySelector('.wallet-dialog');
          if(!dialog) return 'Wallet chooser did not open';
          const r=dialog.getBoundingClientRect();
          const issue=r.left<0 || r.right>innerWidth+1 ? 'Wallet chooser is clipped' : null;
          document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
          await new Promise(resolve=>setTimeout(resolve,100));
          return issue || (document.querySelector('.wallet-dialog') ? 'Wallet chooser did not dismiss' : null);
        })()`);
        if (walletIssue) report.errors.push(walletIssue);
      }
      await evaluate("window.scrollTo(0,0)");
      if ((route === "/" || route === "/agents/atlas") && [375, 1280].includes(width)) {
        const { data } = await send("Page.captureScreenshot", { format: "png" });
        await writeFile(
          join(output, `${route === "/" ? "home" : "atlas"}-${width}.png`),
          Buffer.from(data, "base64"),
        );
      }
    }
    console.log(`Checked ${route} at ${widths.join(", ")}px`);
  }
  const problems = report.pages.filter(
    (page) =>
      page.documentWidth > page.width + 1 ||
      page.outside.length ||
      page.unlabeledButtons,
  );
  console.log(
    JSON.stringify(
      {
        checked: report.pages.length,
        layoutProblems: problems,
        runtimeErrors: report.errors,
      },
      null,
      2,
    ),
  );
  if (problems.length || report.errors.length) process.exitCode = 1;
} catch (error) {
  report.errors.push(error.message);
  process.exitCode = 1;
  console.error(error);
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  ws?.close();
  const exited = new Promise((resolve) => browser.once("exit", resolve));
  browser.kill();
  await Promise.race([exited, delay(3000)]);
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
