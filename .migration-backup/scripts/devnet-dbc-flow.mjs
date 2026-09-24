// Task 4 evidence run: real Meteora DBC devnet wallet transaction flow.
//
// Headless Chromium over the DevTools protocol (no Playwright). A throwaway
// devnet keypair is generated (or reused) in Node, funded from the devnet
// faucet, and exposed to the page as a Wallet Standard wallet. Signing is
// bridged back to Node over a CDP binding, so the secret key never enters the
// page. The script then drives the real Markets Launch UI end to end:
//
//   connect wallet -> authenticate (signed challenge) -> create an owned
//   devnet agent (real /api/agents POST) -> prepare config (real SDK build)
//   -> sign and simulate (real signature, real RPC simulation) -> submit
//   (real devnet broadcast) -> check confirmation (real reconciliation) ->
//   screenshots + JSON evidence with the real transaction signature.
//
// Usage:
//   node scripts/devnet-dbc-flow.mjs
//
// Flags / env:
//   NAVIS_DEVNET_BASE_URL   origin to test (default http://127.0.0.1:19732)
//   SOLANA_RPC_URL          devnet RPC (default https://api.devnet.solana.com)
//   NAVIS_DEVNET_KEYPAIR    keypair JSON path (default /tmp/navis-task4-devnet-wallet.json)
//   NAVIS_DEVNET_OUT        JSON report path (default docs/evidence/task4-devnet-flow.json)
//   NAVIS_DEVNET_SHOT_DIR   screenshot directory (default docs/evidence)
//   CHROMIUM_BIN            chromium binary (default chromium)

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Connection, Keypair, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

const baseUrl = (process.env.NAVIS_DEVNET_BASE_URL ?? "http://127.0.0.1:19732").replace(
  /\/+$/,
  "",
);
const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const keypairPath =
  process.env.NAVIS_DEVNET_KEYPAIR ?? "/tmp/navis-task4-devnet-wallet.json";
const outFile = process.env.NAVIS_DEVNET_OUT ?? "docs/evidence/task4-devnet-flow.json";
const shotDir = process.env.NAVIS_DEVNET_SHOT_DIR ?? "docs/evidence";
const chromium = process.env.CHROMIUM_BIN ?? "chromium";
const port = 9341;

const report = {
  base: baseUrl,
  cluster: "devnet",
  checkedAt: new Date().toISOString(),
  steps: [],
  passed: false,
};

function step(name, data) {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(`[step] ${name}`, JSON.stringify(data));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

// ---------------------------------------------------------------------------
// Devnet wallet: real keypair, real funds from the devnet faucet.

async function loadOrCreateKeypair() {
  try {
    const raw = JSON.parse(await readFile(keypairPath, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  } catch {
    const keypair = Keypair.generate();
    await writeFile(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
    return keypair;
  }
}

async function ensureFunds(connection, keypair) {
  const balance = await connection.getBalance(keypair.publicKey, "confirmed");
  if (balance >= 0.25 * LAMPORTS_PER_SOL) {
    step("walletFunded", {
      wallet: keypair.publicKey.toBase58(),
      balanceSol: balance / LAMPORTS_PER_SOL,
      airdrop: false,
    });
    return;
  }
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const signature = await connection.requestAirdrop(
        keypair.publicKey,
        LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(signature, "confirmed");
      const after = await connection.getBalance(keypair.publicKey, "confirmed");
      step("walletFunded", {
        wallet: keypair.publicKey.toBase58(),
        balanceSol: after / LAMPORTS_PER_SOL,
        airdrop: true,
        airdropSignature: signature,
      });
      return;
    } catch (error) {
      lastError = error;
      await delay(4_000);
    }
  }
  throw new Error(
    `devnet airdrop failed after 3 attempts: ${lastError?.message ?? lastError}`,
  );
}

// ---------------------------------------------------------------------------
// Scripted sign-in from Node for the agent-creation API call. The browser
// authenticates separately through the injected wallet UI path.

async function signIn(wallet) {
  const headers = { "Content-Type": "application/json", Origin: baseUrl };
  const nonceResponse = await fetch(`${baseUrl}/api/auth/nonce`, {
    method: "POST",
    headers,
    body: JSON.stringify({ wallet }),
  });
  const challenge = await nonceResponse.json();
  assert(nonceResponse.status === 200, `nonce returned ${nonceResponse.status}`);

  const signature = bs58.encode(
    nacl.sign.detached(new TextEncoder().encode(challenge.message), keypairSecret),
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
  assert(verifyResponse.status === 200, `verify returned ${verifyResponse.status}`);
  const setCookie = verifyResponse.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/navis_session=([^;]+)/);
  assert(match, "verify response carried no session cookie");
  return match[1];
}

async function createDevnetAgent(cookie) {
  const listResponse = await fetch(`${baseUrl}/api/agents`, {
    headers: { Cookie: `navis_session=${cookie}` },
  });
  assert(listResponse.ok, "could not list rehearsal agents");
  const { agents } = await listResponse.json();
  const existing = agents.find(
    (agent) =>
      agent.mode === "devnet" &&
      agent.cluster === "devnet" &&
      agent.name.startsWith("Devnet Launch Rehearsal "),
  );
  if (existing) {
    step("agentReused", {
      id: existing.id,
      mode: existing.mode,
      cluster: existing.cluster,
    });
    return existing;
  }
  const name = `Devnet Launch Rehearsal ${Date.now().toString(36)}`;
  const response = await fetch(`${baseUrl}/api/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: `navis_session=${cookie}`,
    },
    body: JSON.stringify({
      name,
      objective:
        "Owns the Meteora DBC devnet launch rehearsal evidence; the strategy is inert.",
      maxTradeBps: 1_000,
      maxPositionBps: 3_500,
      minReserveBps: 2_000,
      maxSlippageBps: 75,
      clientRequestId: crypto.randomUUID(),
    }),
  });
  const body = await response.json().catch(() => ({}));
  step("agentCreated", { status: response.status, name, agent: body.agent });
  assert(response.status === 201, `agent creation returned ${response.status}`);
  assert(body.agent?.id, "agent creation returned no id");
  const verifiedResponse = await fetch(`${baseUrl}/api/agents`, {
    headers: { Cookie: `navis_session=${cookie}` },
  });
  assert(verifiedResponse.ok, "could not verify saved agent");
  const saved = (await verifiedResponse.json()).agents.find(
    (agent) => agent.id === body.agent.id,
  );
  assert(
    saved?.mode === "devnet" && saved?.cluster === "devnet",
    "agent is not devnet mode",
  );
  return saved;
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

  async waitFor(condition, timeoutMs = 60_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      let ok = false;
      try {
        ok = await this.evaluate(`Boolean(${condition})`);
      } catch {
        // context torn down by navigation; retry
      }
      if (ok) return;
      await delay(300);
    }
    throw new Error(`Timed out waiting for: ${condition}`);
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'");
    await delay(1_000);
  }

  async screenshot(file) {
    await this.evaluate(
      `document.querySelector('.meteora-prepare')?.scrollIntoView({block: 'start'})`,
    );
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`saved ${file}`);
  }

  clickButton(text) {
    return this.evaluate(`(() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.includes(${JSON.stringify(text)}));
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
  }
}

// ---------------------------------------------------------------------------
// Wallet Standard shim injected into the page. Signing bridges back to Node
// through the __navisSign binding so the secret key never enters the page.

function walletShimSource(walletAddress) {
  return `(() => {
    const WALLET_ADDRESS = ${JSON.stringify(walletAddress)};
    const pendingSigns = new Map();
    let nextId = 1;
    window.__navisSignResolve = (id, value) => {
      const resolve = pendingSigns.get(id);
      pendingSigns.delete(id);
      if (resolve) resolve(value);
    };
    function bridge(kind, dataB64) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pendingSigns.set(id, resolve);
        window.__navisSign(JSON.stringify({ id, kind, data: dataB64 }));
        setTimeout(() => {
          if (pendingSigns.delete(id)) reject(new Error("signing bridge timed out"));
        }, 30000);
      });
    }
    function bytesToB64(bytes) {
      let binary = "";
      for (let index = 0; index < bytes.length; index += 8192) {
        binary += String.fromCharCode(...bytes.slice(index, index + 8192));
      }
      return btoa(binary);
    }
    function b64ToBytes(value) {
      return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    }
    const account = {
      address: WALLET_ADDRESS,
      publicKey: null, // filled below; Uint8Array of the raw pubkey
      chains: ["solana:devnet"],
      features: ["standard:connect", "standard:events", "solana:signMessage", "solana:signTransaction"],
      label: "Navis devnet rehearsal",
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
    };
    account.publicKey = b64ToBytes(window.__navisWalletPubkeyB64);
    const wallet = {
      version: "1.0.0",
      name: "Navis Devnet Test Wallet",
      icon: account.icon,
      chains: ["solana:devnet"],
      features: {
        "standard:connect": {
          version: "1.0.0",
          connect: async () => ({ accounts: [account] }),
        },
        "standard:events": {
          version: "1.0.0",
          on: () => () => {},
        },
        "solana:signMessage": {
          version: "1.1.0",
          signMessage: async ({ message }) => {
            const signedB64 = await bridge("message", bytesToB64(message));
            return [{ signedMessage: message, signature: b64ToBytes(signedB64) }];
          },
        },
        "solana:signTransaction": {
          version: "1.1.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: async ({ transaction }) => {
            const signedB64 = await bridge("transaction", bytesToB64(transaction));
            return [{ signedTransaction: b64ToBytes(signedB64) }];
          },
        },
      },
      accounts: [account],
    };
    const callback = ({ register }) => register(wallet);
    (window.navigator.wallets ??= []).push(callback);
    window.dispatchEvent(
      new CustomEvent("wallet-standard:register-wallet", { detail: callback }),
    );
    window.addEventListener("wallet-standard:app-ready", ({ detail: api }) =>
      callback(api),
    );
    window.__navisWalletReady = true;
  })()`;
}

// ---------------------------------------------------------------------------

let keypairSecret;

async function main() {
  const keypair = await loadOrCreateKeypair();
  keypairSecret = keypair.secretKey;
  const walletAddress = keypair.publicKey.toBase58();
  step("walletReady", { wallet: walletAddress, keypairPath });

  const connection = new Connection(rpcUrl, "confirmed");
  assert(
    (await connection.getGenesisHash()) ===
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    "refusing to run against a non-devnet RPC",
  );
  await ensureFunds(connection, keypair);

  const cookie = await signIn(walletAddress);
  const agent = await createDevnetAgent(cookie);

  await mkdir(shotDir, { recursive: true });

  const browser = spawn(
    chromium,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--window-size=1280,1400",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/navis-task4-profile-${Date.now()}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let browserStderr = "";
  browser.stderr.on("data", (chunk) => {
    browserStderr += chunk;
  });

  let session;
  try {
    let target = null;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) =>
          r.json(),
        );
        target = targets.find((entry) => entry.type === "page");
        if (target) break;
      } catch {
        // devtools endpoint not up yet
      }
      await delay(250);
    }
    assert(target, "no debuggable page target");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    session = new Session(ws);
    await session.send("Runtime.enable");
    await session.send("Page.enable");
    session.on((message) => {
      if (message.method === "Runtime.exceptionThrown") {
        console.error("browser exception:", message.params.exceptionDetails.text);
      }
    });
    await session.send("Runtime.addBinding", { name: "__navisSign" });

    // Signing bridge: page asks, Node signs with the real keypair.
    session.on((message) => {
      if (message.method !== "Runtime.bindingCalled") return;
      const { payload } = message.params;
      void (async () => {
        try {
          const { id, kind, data } = JSON.parse(payload);
          let signedB64;
          if (kind === "message") {
            const bytes = Uint8Array.from(Buffer.from(data, "base64"));
            signedB64 = Buffer.from(
              nacl.sign.detached(bytes, keypair.secretKey),
            ).toString("base64");
          } else {
            const transaction = Transaction.from(Buffer.from(data, "base64"));
            const feePayer = transaction.feePayer?.toBase58();
            assert(
              feePayer === walletAddress,
              `transaction payer ${feePayer} is not the rehearsal wallet`,
            );
            transaction.partialSign(keypair);
            signedB64 = transaction
              .serialize({ requireAllSignatures: true, verifySignatures: true })
              .toString("base64");
          }
          await session.evaluate(
            `window.__navisSignResolve(${id}, ${JSON.stringify(signedB64)})`,
          );
        } catch (error) {
          console.error("signing bridge error", error);
        }
      })();
    });

    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `window.__navisWalletPubkeyB64 = ${JSON.stringify(
        Buffer.from(keypair.publicKey.toBytes()).toString("base64"),
      )};\n${walletShimSource(walletAddress)}`,
    });

    await session.navigate(`${baseUrl}/markets/launch`);
    await session.waitFor("window.__navisWalletReady === true");

    // 1. Connect through the real wallet dialog.
    await session.waitFor(`(() => {
      if (document.querySelector('[role="dialog"]')) return true;
      [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Connect wallet"))?.click();
      return false;
    })()`);
    await session.waitFor(
      `[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Navis Devnet Test Wallet"))`,
    );
    assert(
      await session.clickButton("Navis Devnet Test Wallet"),
      "shim wallet not listed",
    );
    await session.waitFor(
      `[...document.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === "Wallet ${walletAddress}")`,
    );
    step("walletConnected", { wallet: walletAddress });

    // 2. Authenticate through the wallet menu (real signMessage + session).
    await session.evaluate(`(() => {
      [...document.querySelectorAll("button")]
        .find((b) => b.getAttribute("aria-label") === "Wallet ${walletAddress}")
        ?.click();
      return true;
    })()`);
    await session.waitFor(
      `[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Authenticate")`,
    );
    assert(await session.clickButton("Authenticate"), "authenticate item missing");
    await session.waitFor(
      `document.body.textContent.includes("Session authenticated")`,
      90_000,
    );
    step("walletAuthenticated", {});
    await session.waitFor(
      `[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Prepare config transaction") && !b.disabled)`,
    );

    // 3. Wallet readiness card shows cluster and balance.
    await session.waitFor(
      `document.querySelector('[data-testid="meteora-wallet-readiness"]') !== null`,
    );
    await session.waitFor(
      `document.querySelector('[data-testid="meteora-wallet-readiness"]')?.textContent.includes("SOL")`,
      60_000,
    );
    const readinessText = await session.evaluate(
      `document.querySelector('[data-testid="meteora-wallet-readiness"]')?.textContent ?? ""`,
    );
    assert(readinessText.includes("devnet"), "readiness card lacks the cluster");
    step("readinessShown", { text: readinessText.slice(0, 300) });
    await session.screenshot(join(shotDir, "task4-devnet-01-ready.png"));

    // 4. Prepare the config transaction (navis-equity-v1 is the devnet profile).
    assert(
      await session.clickButton("Prepare config transaction"),
      "prepare button missing or disabled",
    );
    await session.waitFor(
      `document.body.textContent.includes("Unsigned config transaction prepared")`,
      120_000,
    );
    step("configPrepared", {});

    // 5. Sign and simulate (shim signs; server simulates the signed bytes).
    assert(await session.clickButton("Sign and simulate"), "simulate button missing");
    await session.waitFor(
      `[...document.querySelectorAll(".meteora-simulation-review h3")].some((h) => /Simulation passed|Simulation returned an error/.test(h.textContent))`,
      120_000,
    );
    const simPassed = await session.evaluate(
      `[...document.querySelectorAll(".meteora-simulation-review h3")].some((h) => h.textContent === "Simulation passed")`,
    );
    assert(simPassed, "simulation did not pass; see task4-devnet-02-simulation.png");
    step("simulationPassed", {});
    await session.screenshot(join(shotDir, "task4-devnet-02-simulated.png"));

    // 6. Submit: real devnet broadcast through the released gate.
    assert(await session.clickButton("Submit config"), "submit button disabled");
    await session.waitFor(
      `document.body.textContent.includes("Config transaction submitted")`,
      120_000,
    );
    const signature = await session.evaluate(`(() => {
      const review = document.querySelector(".meteora-submit-review");
      const code = review?.querySelector("code");
      return code?.textContent ?? null;
    })()`);
    assert(signature && signature.length > 40, "no transaction signature rendered");
    step("configSubmitted", {
      signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
    await session.screenshot(join(shotDir, "task4-devnet-03-submitted.png"));

    // 7. Confirm: real reconciliation against devnet.
    assert(await session.clickButton("Check confirmation"), "confirm button missing");
    await session.waitFor(
      `document.body.textContent.includes("Confirmation:")`,
      120_000,
    );
    let confirmationText = await session.evaluate(`(() => {
      const note = [...document.querySelectorAll(".meteora-submit-review .form-note")]
        .map((el) => el.textContent).join(" ");
      return note;
    })()`);
    for (
      let attempt = 0;
      attempt < 10 && !confirmationText.includes("protocol verified");
      attempt++
    ) {
      await delay(2500);
      await session.clickButton("Check confirmation");
      await session.waitFor(
        `[...document.querySelectorAll("button")].some(b => b.textContent.includes("Check confirmation") && !b.disabled)`,
      );
      confirmationText = await session.evaluate(
        `[...document.querySelectorAll(".meteora-submit-review .form-note")].map(el => el.textContent).join(" ")`,
      );
    }
    step("confirmationChecked", { text: confirmationText.slice(0, 400) });
    await session.screenshot(join(shotDir, "task4-devnet-04-confirmed.png"));

    // 8. The signature is real on devnet.
    const onchain = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    assert(onchain.value, "signature not found on devnet");
    assert(
      onchain.value.err === null,
      `devnet transaction failed: ${onchain.value.err}`,
    );
    step("verifiedOnDevnet", {
      signature,
      slot: onchain.value.slot,
      confirmationStatus: onchain.value.confirmationStatus,
    });

    report.wallet = walletAddress;
    report.agent = agent;
    report.transactionSignature = signature;
    report.explorer = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
    assert(
      confirmationText.includes("protocol verified"),
      "protocol verification not complete",
    );

    // 9. Create the real devnet pool only after protocol verification.
    await session.evaluate(`(() => {
      const fields = document.querySelectorAll(".meteora-pool-fields input");
      const values = ["Navis Devnet Rehearsal", "NVTEST", ${JSON.stringify(`${baseUrl}/devnet-rehearsal.json`)}];
      fields.forEach((field, index) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, values[index]);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    })()`);
    assert(
      await session.clickButton("Prepare pool transaction"),
      "pool prepare unavailable",
    );
    await session.waitFor(
      `document.querySelector(".meteora-pool-builder")?.textContent.includes("Derived pool")`,
    );
    step("poolPrepared", {});
    assert(
      await session.clickButton("Sign and simulate pool"),
      "pool signing unavailable",
    );
    await session.waitFor(
      `document.querySelector(".meteora-pool-builder .meteora-simulation-review") !== null`,
    );
    assert(
      await session.evaluate(
        `document.querySelector(".meteora-pool-builder .meteora-simulation-review")?.dataset.status === "pass"`,
      ),
      "pool simulation failed; submission remains blocked",
    );
    step("poolSimulationPassed", {});
    assert(await session.clickButton("Submit pool"), "pool submission unavailable");
    await session.waitFor(
      `document.querySelector(".meteora-pool-builder")?.textContent.includes("Pool transaction submitted")`,
    );
    const poolSignature = await session.evaluate(`(() => {
      const row = [...document.querySelectorAll(".meteora-pool-builder dt")].find(e => e.textContent === "Signature");
      return row?.nextElementSibling?.textContent;
    })()`);
    assert(poolSignature?.length > 40, "pool signature not rendered");
    step("poolSubmitted", { signature: poolSignature });
    let poolConfirmation = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      await session.evaluate(`(() => {
        [...document.querySelectorAll(".meteora-pool-builder button")].find(b => b.textContent.includes("Check confirmation"))?.click();
      })()`);
      await delay(2000);
      poolConfirmation = await session.evaluate(
        `document.querySelector(".meteora-pool-builder")?.textContent ?? ""`,
      );
      if (poolConfirmation.includes("Confirmation: protocol verified")) break;
    }
    assert(
      poolConfirmation.includes("Confirmation: protocol verified"),
      "pool not protocol verified",
    );
    const poolOnchain = await connection.getSignatureStatus(poolSignature, {
      searchTransactionHistory: true,
    });
    assert(
      poolOnchain.value && !poolOnchain.value.err,
      "pool signature not successful on devnet",
    );
    report.pool = {
      signature: poolSignature,
      explorer: `https://explorer.solana.com/tx/${poolSignature}?cluster=devnet`,
      slot: poolOnchain.value.slot,
      confirmationStatus: poolOnchain.value.confirmationStatus,
      protocolVerified: true,
    };
    step("poolProtocolVerified", report.pool);
    await session.evaluate(
      `document.querySelector(".meteora-pool-builder")?.scrollIntoView({block: "center"})`,
    );
    const { data: poolShot } = await session.send("Page.captureScreenshot", {
      format: "png",
    });
    await writeFile(
      join(shotDir, "task4-devnet-05-pool-verified.png"),
      Buffer.from(poolShot, "base64"),
    );
    report.passed = true;
  } catch (error) {
    if (session) {
      console.error(
        "page at failure:",
        await session
          .evaluate(
            `JSON.stringify({
        header: document.body.innerText.slice(0, 1200),
        errors: [...document.querySelectorAll('.wallet-error, .form-error')].map(e => e.textContent),
        flow: document.querySelector('.meteora-prepare')?.innerText
      })`,
          )
          .catch(() => ""),
      );
      await session
        .screenshot(join(shotDir, "task4-devnet-failure.png"))
        .catch(() => {});
    }
    throw error;
  } finally {
    browser.kill("SIGTERM");
    await writeFile(outFile, JSON.stringify(report, null, 2));
    if (!report.passed) {
      console.error("flow failed; browser stderr tail:", browserStderr.slice(-500));
    }
  }
}

main()
  .then(() => {
    console.log(report.passed ? "devnet DBC flow PASSED" : "devnet DBC flow FAILED");
    process.exit(report.passed ? 0 : 1);
  })
  .catch(async (error) => {
    console.error(error);
    report.error = error instanceof Error ? error.message : String(error);
    await writeFile(outFile, JSON.stringify(report, null, 2)).catch(() => {});
    process.exit(1);
  });
