// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const WALLET_ADDRESS = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const OTHER_WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

const adapter = vi.hoisted(() => ({
  disconnect: vi.fn(async () => undefined),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: adapter.refresh, push: vi.fn() }),
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    wallets: [],
    wallet: { adapter: { name: "Phantom" } },
    publicKey: { toBase58: () => WALLET_ADDRESS },
    connected: true,
    connecting: false,
    disconnecting: false,
    select: vi.fn(),
    connect: vi.fn(async () => undefined),
    disconnect: adapter.disconnect,
    signMessage: vi.fn(),
  }),
}));

import { WalletControl } from "../components/wallet/wallet-control";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockSessionFetch({
  sessionWallet,
  deleteStatus,
}: {
  sessionWallet: string | null;
  deleteStatus: number;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url === "/api/auth/session" && method === "GET") {
        return jsonResponse(
          sessionWallet
            ? { authenticated: true, wallet: sessionWallet }
            : { authenticated: false },
        );
      }
      if (url === "/api/auth/session" && method === "DELETE") {
        return jsonResponse(
          deleteStatus === 200 ? { authenticated: false } : { error: "unavailable" },
          deleteStatus,
        );
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    }),
  );
}

function openMenu() {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`Wallet ${WALLET_ADDRESS}`) }),
  );
}

describe("wallet control session failure states", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    adapter.disconnect.mockClear();
    adapter.refresh.mockClear();
  });

  it("keeps the session and the menu open with a visible error when logout fails", async () => {
    mockSessionFetch({ sessionWallet: WALLET_ADDRESS, deleteStatus: 503 });
    render(<WalletControl authenticationConfigured={true} />);

    openMenu();
    await screen.findByText("Session authenticated");

    fireEvent.click(screen.getByRole("menuitem", { name: /^disconnect$/i }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "could not end the session on the server",
    );
    // The session is retained and the menu stays open so the error is visible
    // and the owner can retry.
    expect(screen.getByText("Session authenticated")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /^disconnect$/i })).toBeTruthy();
    expect(adapter.disconnect).not.toHaveBeenCalled();
  });

  it("disconnects the wallet and closes the menu after a successful logout", async () => {
    mockSessionFetch({ sessionWallet: WALLET_ADDRESS, deleteStatus: 200 });
    render(<WalletControl authenticationConfigured={true} />);

    openMenu();
    await screen.findByText("Session authenticated");

    fireEvent.click(screen.getByRole("menuitem", { name: /^disconnect$/i }));

    await waitFor(() => expect(adapter.disconnect).toHaveBeenCalledOnce());
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("blocks sign-in when switching wallets cannot end the previous session", async () => {
    mockSessionFetch({ sessionWallet: OTHER_WALLET, deleteStatus: 503 });
    render(<WalletControl authenticationConfigured={true} />);

    openMenu();
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "could not end the previous wallet session",
    );
    // The state stays "checking" so the new wallet cannot authenticate and
    // overwrite the only revocable cookie copy of the previous session.
    expect(screen.getByText("Checking session…")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /^authenticate$/i })).toBeNull();
  });

  it("offers sign-in once switching wallets has ended the previous session", async () => {
    mockSessionFetch({ sessionWallet: OTHER_WALLET, deleteStatus: 200 });
    render(<WalletControl authenticationConfigured={true} />);

    openMenu();
    await screen.findByText("Signature required");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("menuitem", { name: /^authenticate$/i })).toBeTruthy();
  });
});
