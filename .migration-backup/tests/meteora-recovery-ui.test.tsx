// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedMeteoraLaunch } from "../lib/integrations/meteora/recovery";

const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  getBalance: vi.fn(async () => 1_000_000_000),
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useConnection: () => ({ connection: { getBalance: mocks.getBalance } }),
  useWallet: () => ({
    connected: true,
    publicKey: { toBase58: () => "wallet-address" },
    signTransaction: vi.fn(),
    wallet: { adapter: { name: "Test wallet" } },
  }),
}));

vi.mock("@solana/web3.js", () => ({
  Keypair: {
    generate: () => ({ publicKey: { toBase58: () => "generated-base-mint" } }),
  },
  Transaction: {
    from: () => ({ partialSign: vi.fn() }),
  },
}));

vi.mock("../lib/integrations/meteora/wallet-signing", () => ({
  signMeteoraDevnetTransaction: mocks.sign,
}));

import { MeteoraConfigPrepare } from "../components/markets/meteora-config-prepare";

const profile = {
  id: "navis-equity-v1" as const,
  label: "SOL quote",
  quoteSource: "wrapped_sol" as const,
  cluster: "devnet" as const,
  available: true,
  status: "available" as const,
  reason: "Available on devnet.",
  requiresQuoteSymbol: false,
};

const configLaunch: SavedMeteoraLaunch = {
  id: "launch-config",
  agentId: "agent-1",
  cluster: "devnet",
  status: "confirmed",
  phase: "config",
  transactionSignature: "config-signature",
  configSignature: "config-signature",
  configAddress: "saved-config-address",
  baseMint: null,
  poolAddress: null,
  configVerification: "protocol_verified",
  poolVerification: null,
};

function poolLaunch(status: string): SavedMeteoraLaunch {
  return {
    ...configLaunch,
    id: `launch-pool-${status}`,
    status,
    phase: "pool",
    transactionSignature: `pool-signature-${status}`,
    configSignature: "config-signature",
    baseMint: "saved-base-mint",
    poolAddress: "saved-pool-address",
    poolVerification: status === "confirmed" ? "protocol_verified" : null,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPrepare() {
  return render(
    <MeteoraConfigPrepare
      executionEnabled={true}
      cluster="devnet"
      broadcastAvailable={true}
      broadcastBlockedReason=""
      agents={[{ id: "agent-1", name: "Atlas", mode: "live", cluster: "devnet" }]}
      profiles={[profile]}
      prestocksSymbols={[]}
    />,
  );
}

function requestsFor(path: string) {
  return vi
    .mocked(fetch)
    .mock.calls.filter(
      ([input]) => (typeof input === "string" ? input : input.toString()) === path,
    );
}

async function recover(launch: SavedMeteoraLaunch) {
  fireEvent.click(screen.getByRole("button", { name: "Load saved launches" }));
  await screen.findByText(`Config: ${launch.configAddress}`);
  fireEvent.click(
    screen.getByRole("button", {
      name:
        launch.phase === "config" &&
        launch.status === "confirmed" &&
        launch.configVerification === "protocol_verified"
          ? "Resume pool creation"
          : "Resume confirmation",
    }),
  );
  await screen.findByText(/Saved launch restored/);
}

describe("Meteora saved-launch recovery UI", () => {
  beforeEach(() => {
    mocks.sign.mockReset();
    mocks.sign.mockResolvedValue({
      serialize: () => new Uint8Array([1, 2, 3]),
    });
    mocks.getBalance.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("resumes a protocol-verified config without signing or broadcasting and can recover again after remount", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (input.toString() === "/api/integrations/meteora/launches") {
        return response({ launches: [configLaunch] });
      }
      throw new Error(`unexpected request ${input.toString()}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = renderPrepare();
    await recover(configLaunch);

    expect(
      (
        screen.getByRole("button", {
          name: "Prepare pool transaction",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Prepare config transaction",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.unmount();
    renderPrepare();
    await recover(configLaunch);

    expect(
      (
        screen.getByRole("button", {
          name: "Prepare pool transaction",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(requestsFor("/api/integrations/meteora/launches")).toHaveLength(2);
    expect(
      fetchMock.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET"),
    ).toBe(true);
  });

  it.each(["submitted", "unknown", "confirmed"])(
    "allows confirmation but blocks a new pool preparation for a saved pool-phase %s launch",
    async (status) => {
      const launch = poolLaunch(status);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          if (input.toString() === "/api/integrations/meteora/launches") {
            return response({ launches: [launch] });
          }
          throw new Error(`unexpected request ${input.toString()}`);
        }),
      );

      renderPrepare();
      await recover(launch);

      expect(
        (
          screen.getByRole("button", {
            name: "Prepare pool transaction",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        (
          screen
            .getAllByRole("button", { name: "Check confirmation" })
            .at(-1) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
      expect(requestsFor("/api/integrations/meteora/pool/prepare")).toHaveLength(0);
      expect(mocks.sign).not.toHaveBeenCalled();
      expect(screen.getByLabelText("pool: saved-pool-address")).toBeTruthy();
      if (status === "confirmed") {
        expect(
          screen.getByText(
            /The pool account matches the recorded config and base mint/,
          ),
        ).toBeTruthy();
      } else {
        expect(
          screen.getByText(/Pool account verification is not complete/),
        ).toBeTruthy();
      }
    },
  );

  it("does not unlock pool creation when config protocol verification is missing", async () => {
    const launch: SavedMeteoraLaunch = {
      ...configLaunch,
      configVerification: "signature_confirmed",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ launches: [launch] })),
    );

    renderPrepare();
    await recover(launch);

    expect(
      (
        screen.getByRole("button", {
          name: "Prepare pool transaction",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Prepare config transaction",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("preserves the verified config and enables a fresh pool preparation after a mocked 410", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/integrations/meteora/launches") {
        return response({ launches: [configLaunch] });
      }
      if (url === "/api/integrations/meteora/pool/prepare") {
        return response({
          intentId: "pool-intent",
          kind: "meteora.createPool",
          cluster: "devnet",
          serializedTransaction: "ignored",
          accounts: {
            config: "saved-config-address",
            baseMint: "generated-base-mint",
            poolAddress: "derived-pool",
            payer: "wallet-address",
            poolCreator: "wallet-address",
            quoteMint: "quote-mint",
          },
          metadata: {
            name: "Navis Market",
            symbol: "NAVIS",
            uri: "https://example.com",
          },
          review: { instructions: 1, signaturesRequired: 2 },
          messageSha256: "hash",
          recentBlockhash: "blockhash",
          lastValidBlockHeight: 10,
          feePayer: "wallet-address",
          requiredSigners: ["wallet-address", "generated-base-mint"],
          programId: "meteora",
        });
      }
      if (url === "/api/integrations/meteora/pool/simulate") {
        return response({
          kind: "meteora.simulateConfig",
          cluster: "devnet",
          messageSha256: "hash",
          feePayer: "wallet-address",
          signatureCount: 2,
          contextSlot: 12,
          error: null,
          logs: [],
          unitsConsumed: 100,
        });
      }
      if (url === "/api/integrations/meteora/pool/submit") {
        return response({ error: "expired" }, 410);
      }
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPrepare();
    await recover(configLaunch);
    fireEvent.click(screen.getByRole("button", { name: "Prepare pool transaction" }));
    await screen.findByRole("button", { name: "Sign and simulate pool" });
    fireEvent.click(screen.getByRole("button", { name: "Sign and simulate pool" }));
    await screen.findByText("Simulation passed");
    fireEvent.click(screen.getByRole("button", { name: "Submit pool" }));

    await screen.findByText(/pool transaction expired before broadcast/i);
    expect(screen.getByText("launch-config")).toBeTruthy();
    expect(screen.getByLabelText("config: saved-config-address")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Prepare pool transaction",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(requestsFor("/api/integrations/meteora/pool/submit")).toHaveLength(1);
  });

  it.each(["transport", "accepted-with-launch"])(
    "never submits a pool twice after a %s outcome",
    async (outcome) => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === "/api/integrations/meteora/launches") {
          return response({ launches: [configLaunch] });
        }
        if (url === "/api/integrations/meteora/pool/prepare") {
          return response({
            intentId: "pool-intent",
            kind: "meteora.createPool",
            cluster: "devnet",
            serializedTransaction: "ignored",
            accounts: {
              config: "saved-config-address",
              baseMint: "generated-base-mint",
              poolAddress: "derived-pool",
              payer: "wallet-address",
              poolCreator: "wallet-address",
              quoteMint: "quote-mint",
            },
            metadata: { name: "Navis", symbol: "NAVIS", uri: "https://example.com" },
            review: { instructions: 1, signaturesRequired: 2 },
            messageSha256: "hash",
            recentBlockhash: "blockhash",
            lastValidBlockHeight: 10,
            feePayer: "wallet-address",
            requiredSigners: [],
            programId: "meteora",
          });
        }
        if (url === "/api/integrations/meteora/pool/simulate") {
          return response({
            kind: "meteora.simulateConfig",
            cluster: "devnet",
            messageSha256: "hash",
            feePayer: "wallet-address",
            signatureCount: 2,
            contextSlot: 12,
            error: null,
            logs: [],
            unitsConsumed: 100,
          });
        }
        if (url === "/api/integrations/meteora/pool/submit") {
          if (outcome === "transport") throw new Error("connection lost");
          return response(
            {
              error: "confirmation pending",
              launch: {
                id: "launch-config",
                status: "unknown",
                transactionSignature: "possibly-sent-signature",
              },
            },
            202,
          );
        }
        throw new Error(`unexpected request ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      renderPrepare();
      await recover(configLaunch);
      fireEvent.click(screen.getByRole("button", { name: "Prepare pool transaction" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Sign and simulate pool" }),
      );
      await screen.findByText("Simulation passed");
      const submit = screen.getByRole("button", { name: "Submit pool" });
      fireEvent.click(submit);
      await waitFor(() =>
        expect(requestsFor("/api/integrations/meteora/pool/submit")).toHaveLength(1),
      );
      if (outcome === "transport") {
        await screen.findByText(/Load saved launches to check the recorded outcome/i);
      } else {
        await screen.findByText("Pool transaction submitted");
      }

      fireEvent.click(screen.getByRole("button", { name: /Submit pool|Submitted/ }));
      expect(requestsFor("/api/integrations/meteora/pool/submit")).toHaveLength(1);
      expect(
        (
          screen.getByRole("button", {
            name: "Prepare pool transaction",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    },
  );
});
