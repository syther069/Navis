import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ failure: new Error("infrastructure failure") }));

vi.mock("../lib/env", () => ({
  env: {
    executionMode: "devnet",
    cluster: "devnet",
    enableDevnetExecution: true,
    solanaRpcUrl: "https://rpc.test",
    databaseUrl: "configured",
    appUrl: "https://navis.test",
  },
}));
vi.mock("../lib/auth/server", () => ({
  SESSION_COOKIE_NAME: "navis_session",
  readSessionToken: vi.fn().mockResolvedValue({
    userId: "user-1",
    wallet: "11111111111111111111111111111111",
  }),
}));
vi.mock("../lib/db/client", () => ({
  getDatabase: () => {
    throw mocks.failure;
  },
}));

import { POST as prepareConfig } from "../app/api/integrations/meteora/config/prepare/route";
import { POST as preparePool } from "../app/api/integrations/meteora/pool/prepare/route";
import { POST as simulateConfig } from "../app/api/integrations/meteora/config/simulate/route";
import { POST as simulatePool } from "../app/api/integrations/meteora/pool/simulate/route";
import {
  MeteoraClusterError,
  meteoraPublicErrorMessage,
} from "../lib/integrations/meteora/errors";
import { MeteoraQuoteProfileError } from "../lib/integrations/meteora/quote-profiles";

const id = "58eddfb8-d139-42cd-baf8-1b69896752ce";
const address = "11111111111111111111111111111111";
const cases = [
  {
    handler: prepareConfig,
    path: "config/prepare",
    body: { agentId: id, config: address, profileId: "navis-equity-v1" },
    message: "Meteora config transaction could not be prepared.",
  },
  {
    handler: preparePool,
    path: "pool/prepare",
    body: {
      launchId: id,
      baseMint: address,
      name: "Test",
      symbol: "TEST",
      uri: "https://example.com/token.json",
    },
    message: "Meteora pool transaction could not be prepared.",
  },
  {
    handler: simulateConfig,
    path: "config/simulate",
    body: { intentId: id, serializedTransaction: "a".repeat(120) },
    message: "Meteora config transaction could not be simulated.",
  },
  {
    handler: simulatePool,
    path: "pool/simulate",
    body: { intentId: id, serializedTransaction: "a".repeat(120) },
    message: "Meteora pool transaction could not be simulated.",
  },
];

describe("Meteora route infrastructure error redaction", () => {
  it.each(cases)(
    "$path never returns raw infrastructure errors",
    async ({ handler, path, body, message }) => {
      for (const raw of [
        "RPC failed https://provider.test/?api-key=secret-token",
        "Failed query: SELECT private_data FROM users; postgres://user:password@host/db",
      ]) {
        mocks.failure = new Error(raw);
        const response = await handler(
          new NextRequest(`https://navis.test/api/integrations/meteora/${path}`, {
            method: "POST",
            headers: {
              origin: "https://navis.test",
              cookie: "navis_session=test",
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
          }),
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: message });
        expect(response.headers.get("Cache-Control")).toBe("no-store");
      }
    },
  );

  it("preserves locally authored safe prerequisite failures", () => {
    const cluster = new MeteoraClusterError();
    const quote = new MeteoraQuoteProfileError("Unknown Meteora quote profile.");
    expect(meteoraPublicErrorMessage(cluster, "fallback")).toBe(cluster.message);
    expect(meteoraPublicErrorMessage(quote, "fallback")).toBe(quote.message);
    expect(meteoraPublicErrorMessage({ message: "secret" }, "fallback")).toBe(
      "fallback",
    );
  });
});
