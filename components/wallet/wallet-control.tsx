"use client";

import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { Check, Copy, ShieldCheck, SignOut, Wallet, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "The wallet could not complete that request.";
}

type SessionState = "checking" | "anonymous" | "authenticating" | "authenticated";

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export function WalletControl({
  authenticationConfigured,
}: {
  authenticationConfigured: boolean;
}) {
  const router = useRouter();
  const {
    wallets,
    wallet,
    publicKey,
    connected,
    connecting,
    disconnecting,
    select,
    connect,
    disconnect,
    signMessage,
  } = useWallet();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestedWallet, setRequestedWallet] = useState<WalletName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const connectingWalletRef = useRef<WalletName | null>(null);

  useEffect(() => {
    if (!requestedWallet || wallet?.adapter.name !== requestedWallet) return;
    if (connectingWalletRef.current === requestedWallet) return;

    connectingWalletRef.current = requestedWallet;
    void connect()
      .then(() => {
        setDialogOpen(false);
      })
      .catch((cause: unknown) => {
        setError(readableError(cause));
      })
      .finally(() => {
        connectingWalletRef.current = null;
        setRequestedWallet(null);
      });
  }, [connect, requestedWallet, wallet?.adapter.name]);

  useEffect(() => {
    if (!dialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDialogOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [dialogOpen]);

  const address = publicKey?.toBase58();

  useEffect(() => {
    if (!connected || !address || !authenticationConfigured) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setSessionState("checking");
    });

    void fetch("/api/auth/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const session = await readJson(response);
        if (controller.signal.aborted) return;

        if (session.authenticated === true && session.wallet === address) {
          setSessionState("authenticated");
          return;
        }

        if (session.authenticated === true && session.wallet !== address) {
          await fetch("/api/auth/session", { method: "DELETE" });
        }
        setSessionState("anonymous");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setSessionState("anonymous");
        setError(readableError(cause));
      });

    return () => controller.abort();
  }, [address, authenticationConfigured, connected]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  function chooseWallet(name: WalletName) {
    setError(null);
    setRequestedWallet(name);
    select(name);
  }

  async function authenticate() {
    if (!address || !signMessage) {
      setError("This wallet does not support message signing.");
      return;
    }

    setError(null);
    setSessionState("authenticating");

    try {
      const challengeResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const challenge = await readJson(challengeResponse);
      if (
        !challengeResponse.ok ||
        typeof challenge.challengeId !== "string" ||
        typeof challenge.nonce !== "string" ||
        typeof challenge.message !== "string"
      ) {
        throw new Error(
          typeof challenge.error === "string"
            ? challenge.error
            : "Navis could not create an authentication challenge.",
        );
      }

      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      const verificationResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          wallet: address,
          nonce: challenge.nonce,
          signature: bs58.encode(signature),
        }),
      });
      const verification = await readJson(verificationResponse);
      if (!verificationResponse.ok || verification.authenticated !== true) {
        throw new Error(
          typeof verification.error === "string"
            ? verification.error
            : "Navis could not verify the wallet signature.",
        );
      }

      setSessionState("authenticated");
      router.refresh();
    } catch (cause) {
      setSessionState("anonymous");
      setError(readableError(cause));
    }
  }

  async function disconnectWallet() {
    setMenuOpen(false);
    setError(null);
    if (sessionState === "authenticated") {
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    }
    setSessionState("anonymous");
    await disconnect();
    router.refresh();
  }

  if (connected && address) {
    return (
      <div className="wallet-control">
        <button
          ref={triggerRef}
          className="wallet-button"
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label={`Wallet ${address}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <span className="wallet-live-dot" aria-hidden="true" />
          <span>{shortenAddress(address)}</span>
        </button>
        {menuOpen ? (
          <div className="wallet-menu" role="menu">
            <div className="wallet-menu-heading">
              <span>Connected wallet</span>
              <strong>{wallet?.adapter.name ?? "Solana wallet"}</strong>
            </div>
            <div className="wallet-session-state" data-state={sessionState}>
              <span aria-hidden="true" />
              {authenticationConfigured
                ? sessionState === "authenticated"
                  ? "Session authenticated"
                  : sessionState === "checking"
                    ? "Checking session…"
                    : sessionState === "authenticating"
                      ? "Awaiting signature…"
                      : "Signature required"
                : "Authentication not configured"}
            </div>
            {authenticationConfigured && sessionState === "anonymous" ? (
              <button type="button" role="menuitem" onClick={authenticate}>
                <ShieldCheck size={17} />
                Authenticate
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={copyAddress}>
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? "Copied" : "Copy address"}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={disconnecting}
              onClick={() => void disconnectWallet()}
            >
              <SignOut size={17} />
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
            {error ? (
              <p className="wallet-menu-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="wallet-button"
        type="button"
        onClick={() => {
          setError(null);
          setDialogOpen(true);
        }}
        aria-label="Connect wallet"
      >
        <Wallet aria-hidden="true" size={18} />
        <span>{connecting ? "Connecting…" : "Connect wallet"}</span>
      </button>

      {dialogOpen ? (
        <div className="wallet-dialog-backdrop" role="presentation">
          <div
            ref={dialogRef}
            className="wallet-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
            tabIndex={-1}
          >
            <div className="wallet-dialog-heading">
              <div>
                <span className="eyebrow">SOLANA WALLET</span>
                <h2 id="wallet-dialog-title">Connect to Navis</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setDialogOpen(false)}
                aria-label="Close wallet selector"
              >
                <X size={20} />
              </button>
            </div>

            <p className="wallet-dialog-copy">
              Select a compatible wallet. Connecting shares your public address only;
              Navis will ask separately before any signature.
            </p>

            <div className="wallet-options">
              {wallets.length > 0 ? (
                wallets.map(({ adapter, readyState }) => {
                  const available =
                    readyState === WalletReadyState.Installed ||
                    readyState === WalletReadyState.Loadable;
                  const isPending = requestedWallet === adapter.name;

                  return (
                    <button
                      key={adapter.name}
                      type="button"
                      disabled={!available || connecting || isPending}
                      onClick={() => chooseWallet(adapter.name)}
                    >
                      <span className="wallet-option-mark" aria-hidden="true">
                        {adapter.name.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{adapter.name}</strong>
                        <small>{available ? "Detected" : "Not installed"}</small>
                      </span>
                      <span className="wallet-option-state">
                        {isPending ? "Opening…" : available ? "Connect" : "Unavailable"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="wallet-empty-state">
                  <Wallet size={24} aria-hidden="true" />
                  <strong>No compatible wallet detected</strong>
                  <span>
                    Install a Wallet Standard-compatible Solana wallet, then reload this
                    page.
                  </span>
                </div>
              )}
            </div>

            {error ? (
              <p className="wallet-error" role="alert">
                {error}
              </p>
            ) : null}
            <p className="wallet-dialog-footnote">
              Navis never requests a seed phrase or private key.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
