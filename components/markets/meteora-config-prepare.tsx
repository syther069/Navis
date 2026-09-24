"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction } from "@solana/web3.js";
import {
  ArrowClockwise,
  FileMagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { AddressValue } from "@/components/shared/address-value";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { InfoHint } from "@/components/shared/info-hint";
import { StageTrack, type Stage } from "@/components/shared/stage-track";
import type {
  MeteoraQuoteProfileAvailability,
  MeteoraQuoteProfileId,
} from "@/lib/integrations/meteora/quote-profiles";
import { signMeteoraDevnetTransaction } from "@/lib/integrations/meteora/wallet-signing";
import type { SavedMeteoraLaunch } from "@/lib/integrations/meteora/recovery";

import { MeteoraLaunchRecovery } from "./meteora-launch-recovery";

/** Base58 transaction signature explorer link for the active cluster. */
function solanaExplorerTxUrl(signature: string, cluster: string) {
  const base = `https://explorer.solana.com/tx/${signature}`;
  return cluster === "mainnet-beta" ? base : `${base}?cluster=${cluster}`;
}

/** Lamports per signature on Solana; rent is embedded in the prepared tx. */
const LAMPORTS_PER_SIGNATURE = 5_000;

export type MeteoraPrepareProps = Readonly<{
  executionEnabled: boolean;
  /** Active Solana cluster; shown next to the wallet and used for explorer links. */
  cluster: string;
  /** True only when the server-side broadcast gate is released for this deployment. */
  broadcastAvailable: boolean;
  /** Why broadcast is blocked, when broadcastAvailable is false. */
  broadcastBlockedReason: string;
  agents: readonly {
    id: string;
    name: string;
    mode: string;
    cluster: string;
  }[];
  /** Server-approved quote profiles with availability for the active cluster. */
  profiles: readonly MeteoraQuoteProfileAvailability[];
  /** Live PreStocks symbols the stock-paired profile may quote against. */
  prestocksSymbols: readonly { symbol: string; name: string }[];
}>;

type PreparedConfigTransaction = Readonly<{
  intentId: string;
  kind: "meteora.createConfig";
  profileId: MeteoraQuoteProfileId;
  quote: {
    profileId: MeteoraQuoteProfileId;
    source: "wrapped_sol" | "prestocks";
    mint: string;
    decimals: number;
    symbol: string;
    name: string;
    provenance: string;
    onchain: {
      tokenProgram: string;
      decimals: number;
      extensions: string[];
      tokenBadge: string | null;
      verifiedAtSlot: number;
    } | null;
  };
  cluster: string;
  programId: string;
  sdkVersion: string;
  serializedTransaction: string;
  messageSha256: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  feePayer: string;
  requiredSigners: string[];
  accounts: {
    config: string;
    payer: string;
    feeClaimer: string;
    leftoverReceiver: string;
    quoteMint: string;
  };
  review: {
    instructions: number;
    signaturesRequired: number;
    migrationQuoteThresholdLamports: string;
    migrationQuoteThresholdSol: string;
  };
}>;

type PreparedPoolTransaction = Readonly<{
  intentId: string;
  kind: "meteora.createPool";
  cluster: string;
  programId: string;
  serializedTransaction: string;
  messageSha256: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  feePayer: string;
  requiredSigners: string[];
  accounts: {
    config: string;
    baseMint: string;
    poolAddress: string;
    payer: string;
    poolCreator: string;
    quoteMint: string;
  };
  metadata: {
    name: string;
    symbol: string;
    uri: string;
  };
  review: {
    instructions: number;
    signaturesRequired: number;
  };
}>;

type SimulationResult = Readonly<{
  kind: "meteora.simulateConfig";
  cluster: string;
  messageSha256: string;
  feePayer: string;
  signatureCount: number;
  contextSlot: number;
  error: unknown;
  logs: string[];
  unitsConsumed: number | null;
}>;

type SubmitResult = Readonly<{
  launch: {
    id?: string;
    status?: string;
    transactionSignature?: string | null;
    config?: string;
    poolAddress?: string | null;
  };
}>;

type ConfirmationResult = Readonly<{
  /** Label or pending state: protocol_verified, signature_confirmed, evidence_incomplete, or a pending reason. */
  confirmation: string;
  evidence?: {
    label: string | null;
    state: string;
    signature?: { slot: number; feeLamports: number; confirmedAt: string } | null;
    protocol?: { address: string | null; reason: string } | null;
  } | null;
  launch?: {
    id?: string;
    status?: string;
    transactionSignature?: string | null;
  };
}>;

type PrepareState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      prepared: PreparedConfigTransaction | null;
      error?: string;
      signedSerializedTransaction?: string;
      simulation?: SimulationResult;
      simulating?: boolean;
      submitting?: boolean;
      submitted?: SubmitResult;
      confirming?: boolean;
      confirmation?: ConfirmationResult;
      poolPreparing?: boolean;
      poolPrepared?: PreparedPoolTransaction;
      poolSignedSerializedTransaction?: string;
      poolSimulation?: SimulationResult;
      poolSimulating?: boolean;
      poolSubmitting?: boolean;
      poolSubmitted?: SubmitResult;
      poolConfirmation?: ConfirmationResult;
      poolSubmitUncertain?: boolean;
    }
  | { status: "error"; message: string };

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function base64ToBytes(value: string) {
  return Uint8Array.from(window.atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return window.btoa(binary);
}

export function MeteoraConfigPrepare({
  executionEnabled,
  cluster,
  broadcastAvailable,
  broadcastBlockedReason,
  agents,
  profiles,
  prestocksSymbols,
}: MeteoraPrepareProps) {
  const { connection } = useConnection();
  const { connected, publicKey, signTransaction, wallet } = useWallet();
  const configKeypairRef = useRef<Keypair | null>(null);
  const poolBaseMintKeypairRef = useRef<Keypair | null>(null);
  const [agentSelectionId, setSelectedAgentId] = useState("");
  // Authentication refreshes the server-owned list after this component mounts.
  const selectedAgentId = agents.some((agent) => agent.id === agentSelectionId)
    ? agentSelectionId
    : (agents[0]?.id ?? "");
  const [selectedProfileId, setSelectedProfileId] = useState<MeteoraQuoteProfileId>(
    profiles.find((profile) => profile.available)?.id ?? "navis-equity-v1",
  );
  const [selectedQuoteSymbol, setSelectedQuoteSymbol] = useState(
    prestocksSymbols[0]?.symbol ?? "",
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const needsQuoteSymbol = Boolean(selectedProfile?.requiresQuoteSymbol);
  const profileReady =
    Boolean(selectedProfile?.available) && (!needsQuoteSymbol || selectedQuoteSymbol);
  const [poolName, setPoolName] = useState("Navis Market");
  const [poolSymbol, setPoolSymbol] = useState("NAVIS");
  const [poolUri, setPoolUri] = useState("https://example.com/navis-token.json");
  const [state, setState] = useState<PrepareState>({ status: "idle" });
  const [balance, setBalance] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "loaded"; lamports: number }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const walletAddress = publicKey?.toBase58();

  useEffect(() => {
    if (!connected || !publicKey) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setBalance({ status: "loading" });
    });
    connection
      .getBalance(publicKey, "confirmed")
      .then((lamports) => {
        if (!controller.signal.aborted) setBalance({ status: "loaded", lamports });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setBalance({
          status: "error",
          message: cause instanceof Error ? cause.message : "Balance lookup failed.",
        });
      });
    return () => controller.abort();
  }, [connected, connection, publicKey]);

  const flow = state.status === "ready" ? state : null;
  const signedBytes = Boolean(flow?.signedSerializedTransaction);
  const simulationFailed = Boolean(flow?.simulation && flow.simulation.error !== null);
  const simulationPassed = Boolean(flow?.simulation && flow.simulation.error === null);
  const stages: Stage[] = [
    {
      key: "configuration",
      label: "Configuration",
      hint: "meteoraConfig",
      state:
        flow?.prepared || flow?.submitted
          ? "complete"
          : !executionEnabled || !profileReady
            ? "blocked"
            : "current",
      detail:
        flow?.submitted && !flow.prepared
          ? "Saved launch record restored; no signing material was restored."
          : flow?.prepared
            ? "Server-approved quote profile resolved for this prepared config."
            : !profileReady
              ? "The selected quote profile is not ready."
              : !executionEnabled
                ? "Transaction preparation is unavailable in this execution mode."
                : connected
                  ? "Choose a quote profile and prepare the config."
                  : "Connect a wallet to continue.",
    },
    {
      key: "preparation",
      label: "Transaction Preparation",
      hint: "preparation",
      state:
        flow?.prepared || flow?.submitted
          ? "complete"
          : state.status === "loading"
            ? "current"
            : "pending",
      detail:
        flow?.submitted && !flow.prepared
          ? "Saved launch record restored; prepared bytes are not available in this tab."
          : flow?.prepared
            ? "Unsigned transaction prepared; no transaction has been sent."
            : "Awaiting an unsigned transaction.",
    },
    {
      key: "simulation",
      label: "Simulation",
      hint: "simulation",
      state: simulationPassed
        ? "simulated"
        : simulationFailed
          ? "failed"
          : flow?.simulating
            ? "current"
            : flow?.prepared
              ? "current"
              : "pending",
      detail: simulationPassed
        ? "RPC simulation passed only. No transaction was executed."
        : simulationFailed
          ? "RPC simulation returned an error."
          : "No passing simulation recorded.",
    },
    {
      key: "approval",
      label: "Wallet Approval",
      hint: "signing",
      state: signedBytes ? "complete" : flow?.simulating ? "current" : "pending",
      detail: signedBytes
        ? "Wallet signed for RPC simulation only; not broadcast."
        : "The wallet signature is requested during simulation; a restored launch does not restore signed bytes.",
    },
    broadcastAvailable
      ? {
          key: "broadcast",
          label: "Broadcast",
          hint: "broadcast",
          state: flow?.submitted?.launch.transactionSignature
            ? "complete"
            : flow?.submitting
              ? "current"
              : "pending",
          detail: flow?.submitted?.launch.transactionSignature
            ? "Signed transaction sent; the signature is recorded on the launch."
            : "Not broadcast. Sending requires a passing simulation and your wallet signature.",
        }
      : {
          key: "broadcast",
          label: "Broadcast",
          hint: "broadcast",
          state: "disabled",
          detail: `Broadcasting is disabled for this deployment. ${broadcastBlockedReason} A prepared transaction is not executed.`,
        },
    broadcastAvailable
      ? {
          key: "confirmation",
          label: "Confirmation",
          hint: "confirmation",
          state:
            flow?.submitted?.launch.status === "confirmed" ? "complete" : "pending",
          detail:
            flow?.submitted?.launch.status === "confirmed"
              ? "The launch record reports a confirmed signature."
              : "No confirmation recorded. Submitted is not confirmed.",
        }
      : {
          key: "confirmation",
          label: "Confirmation",
          hint: "confirmation",
          state: "disabled",
          detail:
            "Unavailable while broadcast is disabled. A prepared transaction is not executed.",
        },
  ];

  function resumeLaunch(launch: SavedMeteoraLaunch) {
    if (launch.cluster !== cluster) return;
    configKeypairRef.current = null;
    poolBaseMintKeypairRef.current = null;
    setSelectedAgentId(launch.agentId);
    const configStatus =
      launch.phase === "config"
        ? launch.status
        : launch.configVerification === "protocol_verified"
          ? "confirmed"
          : "signature_confirmed";
    const configLaunch = {
      id: launch.id,
      status: configStatus,
      transactionSignature: launch.configSignature,
      config: launch.configAddress ?? undefined,
    };
    const poolLaunch = {
      id: launch.id,
      status: launch.status,
      transactionSignature: launch.transactionSignature,
      poolAddress: launch.poolAddress,
    };
    setState({
      status: "ready",
      prepared: null,
      submitted: { launch: configLaunch },
      confirmation: {
        confirmation: launch.configVerification ?? "pending",
        launch: configLaunch,
      },
      ...(launch.phase === "pool"
        ? {
            poolSubmitted: { launch: poolLaunch },
            poolConfirmation: {
              confirmation: launch.poolVerification ?? "pending",
              launch: poolLaunch,
            },
          }
        : {}),
    });
  }

  async function prepareTransaction() {
    if (!executionEnabled || !connected || !publicKey || !selectedAgentId) return;
    if (!profileReady) return;

    configKeypairRef.current ??= Keypair.generate();
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/integrations/meteora/config/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          config: configKeypairRef.current.publicKey.toBase58(),
          profileId: selectedProfileId,
          quoteSymbol: needsQuoteSymbol ? selectedQuoteSymbol : undefined,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora transaction preparation failed.",
        );
      }

      setState({
        status: "ready",
        prepared: payload as PreparedConfigTransaction,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Meteora transaction preparation failed.",
      });
    }
  }

  async function simulatePrepared() {
    if (
      state.status !== "ready" ||
      !state.prepared ||
      !configKeypairRef.current ||
      !signTransaction
    ) {
      return;
    }

    setState({ ...state, simulating: true });

    try {
      const transaction = Transaction.from(
        base64ToBytes(state.prepared.serializedTransaction),
      );
      transaction.partialSign(configKeypairRef.current);
      const signed = await signMeteoraDevnetTransaction({
        adapter: wallet?.adapter ?? null,
        transaction,
        cluster,
        preparedCluster: state.prepared.cluster,
      });
      const serializedTransaction = bytesToBase64(
        signed.serialize({
          requireAllSignatures: true,
          verifySignatures: true,
        }),
      );
      const response = await fetch("/api/integrations/meteora/config/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: state.prepared.intentId,
          serializedTransaction,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora transaction simulation failed.",
        );
      }

      setState({
        status: "ready",
        prepared: state.prepared,
        signedSerializedTransaction: serializedTransaction,
        simulation: payload as SimulationResult,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Meteora transaction simulation failed.",
      });
    }
  }

  async function submitPrepared() {
    if (
      state.status !== "ready" ||
      !state.prepared ||
      !state.signedSerializedTransaction ||
      !selectedAgentId ||
      state.simulation?.error !== null
    ) {
      return;
    }

    setState({ ...state, submitting: true });

    try {
      const response = await fetch("/api/integrations/meteora/config/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: state.prepared.intentId,
          serializedTransaction: state.signedSerializedTransaction,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora transaction submission failed.",
        );
      }

      setState({
        ...state,
        submitting: false,
        submitted: payload as SubmitResult,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Meteora transaction submission failed.",
      });
    }
  }

  async function confirmSubmitted() {
    if (state.status !== "ready" || !state.submitted?.launch.id) return;

    setState({ ...state, confirming: true });

    try {
      const response = await fetch("/api/integrations/meteora/config/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchId: state.submitted.launch.id }),
      });
      const payload = await readJson(response);

      if (!response.ok && response.status !== 202) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora confirmation check failed.",
        );
      }

      setState({
        ...state,
        confirming: false,
        confirmation: payload as ConfirmationResult,
      });
    } catch (error) {
      setState({
        ...state,
        confirming: false,
        error:
          error instanceof Error ? error.message : "Meteora confirmation check failed.",
      });
    }
  }

  async function preparePool() {
    if (
      state.status !== "ready" ||
      state.confirmation?.launch?.status !== "confirmed" ||
      state.confirmation.confirmation !== "protocol_verified" ||
      state.poolSubmitted ||
      state.poolSubmitUncertain
    ) {
      return;
    }

    poolBaseMintKeypairRef.current ??= Keypair.generate();
    setState({ ...state, poolPreparing: true, error: undefined });

    try {
      const response = await fetch("/api/integrations/meteora/pool/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          launchId: state.submitted?.launch.id,
          baseMint: poolBaseMintKeypairRef.current.publicKey.toBase58(),
          name: poolName,
          symbol: poolSymbol.toUpperCase(),
          uri: poolUri,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora pool preparation failed.",
        );
      }

      setState({
        ...state,
        poolPreparing: false,
        poolPrepared: payload as PreparedPoolTransaction,
      });
    } catch (error) {
      setState({
        ...state,
        poolPreparing: false,
        error:
          error instanceof Error ? error.message : "Meteora pool preparation failed.",
      });
    }
  }

  async function simulatePool() {
    if (
      state.status !== "ready" ||
      !state.poolPrepared ||
      !poolBaseMintKeypairRef.current ||
      !signTransaction
    ) {
      return;
    }

    setState({ ...state, poolSimulating: true, error: undefined });

    try {
      const transaction = Transaction.from(
        base64ToBytes(state.poolPrepared.serializedTransaction),
      );
      transaction.partialSign(poolBaseMintKeypairRef.current);
      const signed = await signMeteoraDevnetTransaction({
        adapter: wallet?.adapter ?? null,
        transaction,
        cluster,
        preparedCluster: state.poolPrepared.cluster,
      });
      const serializedTransaction = bytesToBase64(
        signed.serialize({
          requireAllSignatures: true,
          verifySignatures: true,
        }),
      );
      const response = await fetch("/api/integrations/meteora/pool/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: state.poolPrepared.intentId,
          serializedTransaction,
        }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora pool simulation failed.",
        );
      }

      setState({
        ...state,
        poolSimulating: false,
        poolSignedSerializedTransaction: serializedTransaction,
        poolSimulation: payload as SimulationResult,
      });
    } catch (error) {
      poolBaseMintKeypairRef.current = null;
      setState({
        ...state,
        poolPrepared: undefined,
        poolSignedSerializedTransaction: undefined,
        poolSimulation: undefined,
        poolSimulating: false,
        error:
          error instanceof Error ? error.message : "Meteora pool simulation failed.",
      });
    }
  }

  async function submitPool() {
    if (
      state.status !== "ready" ||
      !state.submitted?.launch.id ||
      !state.poolPrepared ||
      !state.poolSignedSerializedTransaction ||
      state.poolSubmitting ||
      state.poolSubmitted ||
      state.poolSubmitUncertain ||
      state.poolSimulation?.error !== null
    ) {
      return;
    }

    setState({ ...state, poolSubmitting: true, error: undefined });

    try {
      const response = await fetch("/api/integrations/meteora/pool/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentId: state.poolPrepared.intentId,
          serializedTransaction: state.poolSignedSerializedTransaction,
        }),
      });
      const payload = await readJson(response);

      // Keep any recorded send visible, including unknown outcomes and failures.
      // Recovery reconciles it; it must never become a new pool submission.
      if (payload.launch && typeof payload.launch === "object") {
        setState({
          ...state,
          poolSubmitting: false,
          poolSubmitted: payload as SubmitResult,
          error: typeof payload.error === "string" ? payload.error : undefined,
        });
        return;
      }
      if (response.status === 410) {
        poolBaseMintKeypairRef.current = null;
        setState({
          ...state,
          poolSubmitting: false,
          poolPrepared: undefined,
          poolSignedSerializedTransaction: undefined,
          poolSimulation: undefined,
          error:
            "The pool transaction expired before broadcast. Your verified config is safe. Click Prepare pool transaction, approve it again, and submit immediately after simulation passes.",
        });
        return;
      }
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora pool submission failed.",
        );
      }

      throw new Error("The server did not return a saved pool transaction.");
    } catch (error) {
      setState({
        ...state,
        poolSubmitting: false,
        poolSubmitUncertain: true,
        error: `${error instanceof Error ? error.message : "Meteora pool submission failed."} Load saved launches to check the recorded outcome before trying again.`,
      });
    }
  }

  async function confirmPool() {
    if (state.status !== "ready" || !state.submitted?.launch.id) return;

    setState({ ...state, confirming: true });

    try {
      const response = await fetch("/api/integrations/meteora/config/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchId: state.submitted.launch.id }),
      });
      const payload = await readJson(response);

      if (!response.ok && response.status !== 202) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora pool confirmation check failed.",
        );
      }

      setState({
        ...state,
        confirming: false,
        poolConfirmation: payload as ConfirmationResult,
      });
    } catch (error) {
      setState({
        ...state,
        confirming: false,
        error:
          error instanceof Error
            ? error.message
            : "Meteora pool confirmation check failed.",
      });
    }
  }

  const disabled =
    !executionEnabled ||
    !connected ||
    !selectedAgentId ||
    state.status === "loading" ||
    Boolean(flow?.submitted || flow?.submitting) ||
    !profileReady;

  return (
    <div className="meteora-prepare">
      <div className="meteora-profile-picker">
        <label className="form-field">
          <span>Quote profile</span>
          <select
            value={selectedProfileId}
            disabled={state.status === "loading"}
            onChange={(event) =>
              setSelectedProfileId(event.target.value as MeteoraQuoteProfileId)
            }
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label} · {profile.id}
                {profile.status === "gated"
                  ? " · gated (token badge required)"
                  : profile.available
                    ? ""
                    : " · unavailable here"}
              </option>
            ))}
          </select>
        </label>
        {needsQuoteSymbol && selectedProfile?.available ? (
          <label className="form-field">
            <span>PreStocks quote token</span>
            <select
              value={selectedQuoteSymbol}
              disabled={prestocksSymbols.length === 0 || state.status === "loading"}
              onChange={(event) => setSelectedQuoteSymbol(event.target.value)}
            >
              {prestocksSymbols.length === 0 ? (
                <option value="">PreStocks catalogue unavailable</option>
              ) : (
                prestocksSymbols.map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.symbol} · {asset.name}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : null}
        {selectedProfile ? (
          <p className="form-note" role="status">
            {selectedProfile.reason}
          </p>
        ) : null}
      </div>
      <button
        className="primary-button"
        type="button"
        disabled={disabled}
        onClick={() => void prepareTransaction()}
      >
        {state.status === "loading" ? (
          <ArrowClockwise aria-hidden="true" size={16} />
        ) : (
          <FileMagnifyingGlass aria-hidden="true" size={16} />
        )}
        {state.status === "loading" ? "Preparing" : "Prepare config transaction"}
      </button>

      {!connected ? (
        <p className="form-note">Connect and authenticate a wallet before preparing.</p>
      ) : null}

      {connected && agents.length === 0 ? (
        <p className="form-note">
          Create an owned Navis agent in this environment before submitting Meteora
          transactions.
        </p>
      ) : null}

      {executionEnabled ? (
        <div
          className="meteora-wallet-readiness"
          data-testid="meteora-wallet-readiness"
        >
          <dl className="meteora-readiness-list">
            <div>
              <dt>Wallet</dt>
              <dd>
                {connected && walletAddress ? (
                  <AddressValue value={walletAddress} label="wallet" />
                ) : (
                  "Not connected"
                )}
              </dd>
            </div>
            <div>
              <dt>Cluster</dt>
              <dd>
                <code>{cluster}</code>
              </dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>
                {balance.status === "loaded"
                  ? `${(balance.lamports / 1e9).toFixed(4)} SOL`
                  : balance.status === "loading"
                    ? "Checking…"
                    : balance.status === "error"
                      ? balance.message
                      : connected
                        ? "Not fetched"
                        : "—"}
              </dd>
            </div>
            <div>
              <dt>Network fee</dt>
              <dd>
                {state.status === "ready" && state.prepared
                  ? `${((state.prepared.review.signaturesRequired * LAMPORTS_PER_SIGNATURE) / 1e9).toFixed(6)} SOL plus account rent (itemized in the wallet approval)`
                  : "Shown after preparation"}
              </dd>
            </div>
          </dl>
          {balance.status === "loaded" &&
          state.status === "ready" &&
          state.prepared &&
          balance.lamports <
            state.prepared.review.signaturesRequired * LAMPORTS_PER_SIGNATURE ? (
            <p className="form-note" role="alert">
              This balance cannot cover the network fee and rent. Fund the wallet before
              broadcasting.
            </p>
          ) : null}
          {cluster === "devnet" && connected ? (
            <p className="form-note">
              Devnet SOL has no value. Fund this wallet from a devnet faucet before
              broadcasting.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="meteora-flow" aria-label="Config transaction lifecycle">
        <div className="meteora-section-heading">
          <span className="route-eyebrow">Execution pathway / config</span>
          <h3>Six stages. No broadcast.</h3>
          <p>Preparation and simulation are review steps, not onchain execution.</p>
        </div>
        <StageTrack stages={stages} label="Meteora config transaction stages" />
      </div>
      <MeteoraLaunchRecovery
        key={walletAddress ?? "disconnected"}
        cluster={cluster}
        disabled={
          !connected ||
          Boolean(
            flow?.submitting ||
            flow?.poolSubmitting ||
            flow?.simulating ||
            flow?.poolSimulating,
          )
        }
        onResume={resumeLaunch}
      />

      {state.status === "ready" ? (
        <PreparedTransactionReview
          prepared={state.prepared}
          simulation={state.simulation}
          simulating={Boolean(state.simulating)}
          submitting={Boolean(state.submitting)}
          submitted={state.submitted}
          confirming={Boolean(state.confirming)}
          confirmation={state.confirmation}
          poolName={poolName}
          poolSymbol={poolSymbol}
          poolUri={poolUri}
          poolPreparing={Boolean(state.poolPreparing)}
          poolPrepared={state.poolPrepared}
          poolSimulation={state.poolSimulation}
          poolSimulating={Boolean(state.poolSimulating)}
          poolSubmitting={Boolean(state.poolSubmitting)}
          poolSubmitted={state.poolSubmitted}
          poolConfirmation={state.poolConfirmation}
          canSimulate={Boolean(signTransaction) && !state.poolSubmitUncertain}
          cluster={cluster}
          broadcastAvailable={broadcastAvailable}
          broadcastBlockedReason={broadcastBlockedReason}
          agents={agents}
          selectedAgentId={selectedAgentId}
          onAgentChange={setSelectedAgentId}
          onPoolNameChange={setPoolName}
          onPoolSymbolChange={setPoolSymbol}
          onPoolUriChange={setPoolUri}
          onSimulate={() => void simulatePrepared()}
          onSubmit={() => void submitPrepared()}
          onConfirm={() => void confirmSubmitted()}
          onPreparePool={() => void preparePool()}
          onSimulatePool={() => void simulatePool()}
          onSubmitPool={() => void submitPool()}
          onConfirmPool={() => void confirmPool()}
        />
      ) : null}

      {state.status === "ready" && state.error ? (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      ) : null}
      {state.status === "error" ? (
        <div className="form-error" role="status">
          <WarningCircle aria-hidden="true" size={16} />
          <span>{state.message}</span>
        </div>
      ) : null}
    </div>
  );
}

function PreparedTransactionReview({
  prepared,
  simulation,
  simulating,
  submitting,
  submitted,
  confirming,
  confirmation,
  poolName,
  poolSymbol,
  poolUri,
  poolPreparing,
  poolPrepared,
  poolSimulation,
  poolSimulating,
  poolSubmitting,
  poolSubmitted,
  poolConfirmation,
  canSimulate,
  cluster,
  broadcastAvailable,
  broadcastBlockedReason,
  agents,
  selectedAgentId,
  onAgentChange,
  onPoolNameChange,
  onPoolSymbolChange,
  onPoolUriChange,
  onSimulate,
  onSubmit,
  onConfirm,
  onPreparePool,
  onSimulatePool,
  onSubmitPool,
  onConfirmPool,
}: {
  prepared: PreparedConfigTransaction | null;
  simulation?: SimulationResult;
  simulating: boolean;
  submitting: boolean;
  submitted?: SubmitResult;
  confirming: boolean;
  confirmation?: ConfirmationResult;
  poolName: string;
  poolSymbol: string;
  poolUri: string;
  poolPreparing: boolean;
  poolPrepared?: PreparedPoolTransaction;
  poolSimulation?: SimulationResult;
  poolSimulating: boolean;
  poolSubmitting: boolean;
  poolSubmitted?: SubmitResult;
  poolConfirmation?: ConfirmationResult;
  canSimulate: boolean;
  cluster: string;
  broadcastAvailable: boolean;
  broadcastBlockedReason: string;
  agents: readonly {
    id: string;
    name: string;
    mode: string;
    cluster: string;
  }[];
  selectedAgentId: string;
  onAgentChange: (agentId: string) => void;
  onPoolNameChange: (name: string) => void;
  onPoolSymbolChange: (symbol: string) => void;
  onPoolUriChange: (uri: string) => void;
  onSimulate: () => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onPreparePool: () => void;
  onSimulatePool: () => void;
  onSubmitPool: () => void;
  onConfirmPool: () => void;
}) {
  // Pool creation needs the protocol-verified config, not just a confirmed signature.
  const configConfirmed =
    confirmation?.launch?.status === "confirmed" &&
    confirmation.confirmation === "protocol_verified" &&
    !poolSubmitted;

  const poolReview = (
    <PoolCreationReview
      enabled={configConfirmed && canSimulate}
      poolName={poolName}
      poolSymbol={poolSymbol}
      poolUri={poolUri}
      preparing={poolPreparing}
      prepared={poolPrepared}
      simulation={poolSimulation}
      simulating={poolSimulating}
      submitting={poolSubmitting}
      submitted={poolSubmitted}
      confirmation={poolConfirmation}
      canSimulate={canSimulate}
      cluster={cluster}
      broadcastAvailable={broadcastAvailable}
      broadcastBlockedReason={broadcastBlockedReason}
      onNameChange={onPoolNameChange}
      onSymbolChange={onPoolSymbolChange}
      onUriChange={onPoolUriChange}
      onPrepare={onPreparePool}
      onSimulate={onSimulatePool}
      onSubmit={onSubmitPool}
      onConfirm={onConfirmPool}
    />
  );

  if (!prepared) {
    return (
      <div className="meteora-prepared-review">
        <p className="form-note">
          Saved launch restored. No signing keys or signed transactions were restored. A
          new pool preparation requires a new wallet approval.
        </p>
        {submitted ? (
          <SubmitReview
            submitted={submitted}
            confirming={confirming}
            confirmation={confirmation}
            cluster={cluster}
            onConfirm={onConfirm}
          />
        ) : null}
        {poolReview}
      </div>
    );
  }

  return (
    <div className="meteora-prepared-review">
      <div className="panel-heading">
        <div>
          <span>{prepared.cluster}</span>
          <h3>Unsigned config transaction prepared</h3>
        </div>
        <StatusBadge tone="pending">Unsigned</StatusBadge>
      </div>
      <p className="form-note">Built for review, not submitted to the network.</p>
      <details className="tech-disclosure">
        <summary>Inspect prepared transaction · accounts and metadata</summary>
        <div className="tech-disclosure-body">
          <dl className="meteora-address-list">
            <div>
              <dt>Config signer</dt>
              <dd>
                <AddressValue value={prepared.accounts.config} label="config signer" />
              </dd>
            </div>
            <div>
              <dt>Payer</dt>
              <dd>
                <AddressValue value={prepared.accounts.payer} label="payer" />
              </dd>
            </div>
            <div>
              <dt>Required signatures</dt>
              <dd>{prepared.review.signaturesRequired}</dd>
            </div>
            <div>
              <dt>Instructions</dt>
              <dd>{prepared.review.instructions}</dd>
            </div>
            <div>
              <dt>Message hash</dt>
              <dd>
                <code>{prepared.messageSha256}</code>
              </dd>
            </div>
            <div>
              <dt>Blockhash</dt>
              <dd>
                <code>{prepared.recentBlockhash}</code>
              </dd>
            </div>
            <div>
              <dt>Last valid block height</dt>
              <dd>{prepared.lastValidBlockHeight}</dd>
            </div>
            <div>
              <dt>Migration threshold</dt>
              <dd>
                {prepared.review.migrationQuoteThresholdSol} {prepared.quote.symbol}
              </dd>
            </div>
            <div>
              <dt>Quote profile</dt>
              <dd>
                <code>{prepared.quote.profileId}</code> · {prepared.quote.name} (
                {prepared.quote.symbol}, {prepared.quote.decimals} decimals)
              </dd>
            </div>
            <div>
              <dt>Quote mint</dt>
              <dd>
                <AddressValue value={prepared.quote.mint} label="quote mint" />
              </dd>
            </div>
            <div>
              <dt>Quote provenance</dt>
              <dd>
                {prepared.quote.provenance}
                {prepared.quote.onchain
                  ? ` Verified ${prepared.quote.onchain.tokenProgram} mint with ${prepared.quote.onchain.decimals} decimals at slot ${prepared.quote.onchain.verifiedAtSlot}${prepared.quote.onchain.tokenBadge ? `; Meteora token badge ${prepared.quote.onchain.tokenBadge}` : ""}.`
                  : ""}
              </dd>
            </div>
          </dl>
        </div>
      </details>
      <div className="meteora-simulation-actions">
        <label className="form-field">
          <span>Launch owner</span>
          <select
            value={selectedAgentId}
            disabled={agents.length === 0}
            onChange={(event) => onAgentChange(event.target.value)}
          >
            {agents.length === 0 ? (
              <option value="">No live-mode agent available</option>
            ) : (
              agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} · {agent.mode} · {agent.cluster}
                </option>
              ))
            )}
          </select>
        </label>
        <button
          className="secondary-button"
          type="button"
          disabled={!canSimulate || simulating}
          onClick={onSimulate}
        >
          <FileMagnifyingGlass aria-hidden="true" size={16} />
          {simulating ? "Simulating" : "Sign and simulate"}
        </button>
        <InfoHint topic="signing" label="About wallet signing for simulation" />
        <p className="form-note">
          This wallet signature authorizes the exact prepared transaction until the
          blockhash expires. Navis uses it here for RPC simulation only.
        </p>
      </div>
      {simulation ? <SimulationReview simulation={simulation} /> : null}
      <div className="meteora-submit-actions">
        <div className="meteora-action-title">
          Broadcast <InfoHint topic="broadcast" label="About broadcast" />
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={
            !broadcastAvailable ||
            submitting ||
            !simulation ||
            simulation.error !== null
          }
          onClick={onSubmit}
        >
          <FileMagnifyingGlass aria-hidden="true" size={16} />
          {submitting ? "Submitting" : submitted ? "Submitted" : "Submit config"}
        </button>
        <p className="form-note">
          {broadcastAvailable
            ? simulation && simulation.error === null
              ? `Simulation passed. Submission broadcasts the signed transaction to ${cluster}; the signature and outcome are recorded for reconciliation.`
              : "Submission unlocks after the signed transaction passes simulation."
            : `${broadcastBlockedReason} Broadcasting is intentionally disabled in Navis. A prepared transaction is not executed; preparation and simulation remain available for review.`}
        </p>
      </div>
      {submitted ? (
        <SubmitReview
          submitted={submitted}
          confirming={confirming}
          confirmation={confirmation}
          cluster={cluster}
          onConfirm={onConfirm}
        />
      ) : null}
      {poolReview}
      <p className="form-note">
        Signing keys remain only in this tab. After a refresh, use Load saved launches
        to recover a submitted config rather than creating another one.
      </p>
    </div>
  );
}

function PoolCreationReview({
  enabled,
  poolName,
  poolSymbol,
  poolUri,
  preparing,
  prepared,
  simulation,
  simulating,
  submitting,
  submitted,
  confirmation,
  canSimulate,
  cluster,
  broadcastAvailable,
  broadcastBlockedReason,
  onNameChange,
  onSymbolChange,
  onUriChange,
  onPrepare,
  onSimulate,
  onSubmit,
  onConfirm,
}: {
  enabled: boolean;
  poolName: string;
  poolSymbol: string;
  poolUri: string;
  preparing: boolean;
  prepared?: PreparedPoolTransaction;
  simulation?: SimulationResult;
  simulating: boolean;
  submitting: boolean;
  submitted?: SubmitResult;
  confirmation?: ConfirmationResult;
  canSimulate: boolean;
  cluster: string;
  broadcastAvailable: boolean;
  broadcastBlockedReason: string;
  onNameChange: (name: string) => void;
  onSymbolChange: (symbol: string) => void;
  onUriChange: (uri: string) => void;
  onPrepare: () => void;
  onSimulate: () => void;
  onSubmit: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="meteora-pool-builder" data-disabled={!enabled}>
      <div className="panel-heading">
        <div>
          <span>Pool creation</span>
          <h3>Virtual pool transaction</h3>
        </div>
        <StatusBadge tone={submitted ? "pending" : enabled ? "simulation" : "neutral"}>
          {submitted ? "Submitted" : enabled ? "Ready" : "Config required"}
        </StatusBadge>
      </div>
      <div className="meteora-pool-fields">
        <label className="form-field">
          <span>Token name</span>
          <input
            value={poolName}
            disabled={!enabled || Boolean(prepared)}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Symbol</span>
          <input
            value={poolSymbol}
            disabled={!enabled || Boolean(prepared)}
            onChange={(event) => onSymbolChange(event.target.value.toUpperCase())}
          />
        </label>
        <label className="form-field">
          <span>Metadata URI</span>
          <input
            value={poolUri}
            disabled={!enabled || Boolean(prepared)}
            onChange={(event) => onUriChange(event.target.value)}
          />
        </label>
      </div>
      <div className="meteora-submit-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={!enabled || preparing || Boolean(prepared)}
          onClick={onPrepare}
        >
          <FileMagnifyingGlass aria-hidden="true" size={16} />
          {preparing ? "Preparing" : "Prepare pool transaction"}
        </button>
        <p className="form-note">
          Navis creates a tab-local base mint signer and derives the pool address from
          the official Meteora program. No mint or pool is shown as live until the pool
          transaction confirms.
        </p>
      </div>
      {prepared ? (
        <div className="meteora-submit-review">
          <dl className="meteora-address-list">
            <div>
              <dt>Base mint signer</dt>
              <dd>
                <AddressValue value={prepared.accounts.baseMint} label="base mint" />
              </dd>
            </div>
            <div>
              <dt>Derived pool</dt>
              <dd>
                <AddressValue value={prepared.accounts.poolAddress} label="pool" />
              </dd>
            </div>
            <div>
              <dt>Required signatures</dt>
              <dd>{prepared.review.signaturesRequired}</dd>
            </div>
            <div>
              <dt>Message hash</dt>
              <dd>
                <code>{prepared.messageSha256}</code>
              </dd>
            </div>
          </dl>
          <div className="meteora-submit-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={!canSimulate || simulating || submitting || Boolean(submitted)}
              onClick={onSimulate}
            >
              <FileMagnifyingGlass aria-hidden="true" size={16} />
              {simulating ? "Simulating" : "Sign and simulate pool"}
            </button>
          </div>
          {simulation ? <SimulationReview simulation={simulation} /> : null}
          <div className="meteora-submit-actions">
            <div className="meteora-action-title">
              Broadcast <InfoHint topic="broadcast" label="About broadcast" />
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={
                !broadcastAvailable ||
                !canSimulate ||
                Boolean(submitted) ||
                submitting ||
                !simulation ||
                simulation.error !== null
              }
              onClick={onSubmit}
            >
              <FileMagnifyingGlass aria-hidden="true" size={16} />
              {submitting ? "Submitting" : submitted ? "Submitted" : "Submit pool"}
            </button>
            <p className="form-note">
              {broadcastAvailable
                ? simulation && simulation.error === null
                  ? `Pool simulation passed. Submission broadcasts to ${cluster} and records the signature.`
                  : "Pool submission unlocks after a passing pool simulation."
                : `${broadcastBlockedReason} Broadcasting is intentionally disabled in Navis. A prepared transaction is not executed.`}
            </p>
          </div>
        </div>
      ) : null}
      {submitted ? (
        <SubmitReview
          submitted={submitted}
          confirming={false}
          confirmation={confirmation}
          cluster={cluster}
          kind="pool"
          onConfirm={onConfirm}
        />
      ) : null}
    </div>
  );
}

function SubmitReview({
  submitted,
  confirming,
  confirmation,
  cluster,
  kind = "config",
  onConfirm,
}: {
  submitted: SubmitResult;
  confirming: boolean;
  confirmation?: ConfirmationResult;
  cluster: string;
  kind?: "config" | "pool";
  onConfirm: () => void;
}) {
  return (
    <div className="meteora-submit-review">
      <div className="panel-heading">
        <div>
          <span>
            {confirmation?.launch?.status ?? submitted.launch.status ?? "submitted"}
          </span>
          <h3>{kind === "pool" ? "Pool" : "Config"} transaction submitted</h3>
        </div>
        <StatusBadge
          tone={confirmation?.confirmation === "protocol_verified" ? "pass" : "pending"}
        >
          {confirmation?.confirmation === "protocol_verified"
            ? "Protocol verified"
            : "Pending confirmation"}
        </StatusBadge>
      </div>
      <dl className="meteora-address-list">
        <div>
          <dt>Launch record</dt>
          <dd>{submitted.launch.id ?? "Recorded"}</dd>
        </div>
        <div>
          <dt>Signature</dt>
          <dd>
            <code>{submitted.launch.transactionSignature ?? "Not returned"}</code>
          </dd>
        </div>
        <div>
          <dt>{kind === "pool" ? "Pool" : "Config"}</dt>
          <dd>
            <AddressValue
              value={
                kind === "pool"
                  ? (submitted.launch.poolAddress ?? null)
                  : (submitted.launch.config ?? null)
              }
              label={kind === "pool" ? "pool" : "config"}
            />
          </dd>
        </div>
      </dl>
      <div className="meteora-submit-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={confirming || !submitted.launch.id}
          onClick={onConfirm}
        >
          <FileMagnifyingGlass aria-hidden="true" size={16} />
          {confirming ? "Checking" : "Check confirmation"}
        </button>
        {submitted.launch.transactionSignature ? (
          <a
            className="secondary-button"
            href={solanaExplorerTxUrl(submitted.launch.transactionSignature, cluster)}
            target="_blank"
            rel="noreferrer"
          >
            View on Solana Explorer
          </a>
        ) : null}
        {confirmation ? (
          <p className="form-note">
            Confirmation: {confirmation.confirmation.replaceAll("_", " ")}
            {confirmation.evidence?.signature
              ? ` at slot ${confirmation.evidence.signature.slot}, fee ${confirmation.evidence.signature.feeLamports} lamports`
              : ""}
            {confirmation.evidence?.protocol?.address
              ? `, account ${confirmation.evidence.protocol.address.slice(0, 6)}…`
              : ""}
            .
            {kind === "config"
              ? " Pool creation is a separate transaction."
              : confirmation.confirmation === "protocol_verified"
                ? " The pool account matches the recorded config and base mint."
                : " Pool account verification is not complete."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SimulationReview({ simulation }: { simulation: SimulationResult }) {
  const failed = simulation.error !== null;

  return (
    <div className="meteora-simulation-review" data-status={failed ? "fail" : "pass"}>
      <div className="panel-heading">
        <div>
          <span>RPC slot {simulation.contextSlot}</span>
          <h3>{failed ? "Simulation returned an error" : "Simulation passed"}</h3>
        </div>
        <StatusBadge tone={failed ? "warn" : "simulation"}>
          {failed ? "Review" : "Simulated only"}
        </StatusBadge>
      </div>
      <p className="form-note">
        RPC simulation only. This is not an executed transaction.
      </p>
      <dl className="meteora-address-list">
        <div>
          <dt>Signed by</dt>
          <dd>{simulation.signatureCount} signer(s)</dd>
        </div>
        <div>
          <dt>Units consumed</dt>
          <dd>{simulation.unitsConsumed ?? "Not reported"}</dd>
        </div>
        <div>
          <dt>Error</dt>
          <dd>{failed ? JSON.stringify(simulation.error) : "None"}</dd>
        </div>
      </dl>
      {simulation.logs.length > 0 ? (
        <details className="tech-disclosure">
          <summary>RPC logs</summary>
          <div className="tech-disclosure-body">
            <pre>{simulation.logs.slice(0, 20).join("\n")}</pre>
          </div>
        </details>
      ) : null}
    </div>
  );
}
