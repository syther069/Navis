"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction } from "@solana/web3.js";
import {
  ArrowClockwise,
  FileMagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { AddressValue } from "@/components/shared/address-value";
import { StatusBadge } from "@/components/shared/domain-primitives";
import { METEORA_BROADCAST_UNAVAILABLE_REASON } from "@/lib/integrations/meteora/broadcast-safety";

type PreparedConfigTransaction = Readonly<{
  intentId: string;
  kind: "meteora.createConfig";
  profileId: "navis-equity-v1";
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
  };
}>;

type ConfirmationResult = Readonly<{
  confirmation: "confirmed" | "unknown_pending" | "failed";
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
      prepared: PreparedConfigTransaction;
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
  agents,
}: {
  executionEnabled: boolean;
  agents: readonly {
    id: string;
    name: string;
    mode: string;
    cluster: string;
  }[];
}) {
  const { connected, publicKey, signTransaction } = useWallet();
  const configKeypairRef = useRef<Keypair | null>(null);
  const poolBaseMintKeypairRef = useRef<Keypair | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [poolName, setPoolName] = useState("Navis Market");
  const [poolSymbol, setPoolSymbol] = useState("NAVIS");
  const [poolUri, setPoolUri] = useState("https://example.com/navis-token.json");
  const [state, setState] = useState<PrepareState>({ status: "idle" });

  async function prepareTransaction() {
    if (!executionEnabled || !connected || !publicKey || !selectedAgentId) return;

    configKeypairRef.current ??= Keypair.generate();
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/integrations/meteora/config/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          config: configKeypairRef.current.publicKey.toBase58(),
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
    if (state.status !== "ready" || !configKeypairRef.current || !signTransaction) {
      return;
    }

    setState({ ...state, simulating: true });

    try {
      const transaction = Transaction.from(
        base64ToBytes(state.prepared.serializedTransaction),
      );
      transaction.partialSign(configKeypairRef.current);
      const signed = await signTransaction(transaction);
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
        status: "error",
        message:
          error instanceof Error ? error.message : "Meteora confirmation check failed.",
      });
    }
  }

  async function preparePool() {
    if (state.status !== "ready" || state.confirmation?.confirmation !== "confirmed") {
      return;
    }

    poolBaseMintKeypairRef.current ??= Keypair.generate();
    setState({ ...state, poolPreparing: true });

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
        status: "error",
        message:
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

    setState({ ...state, poolSimulating: true });

    try {
      const transaction = Transaction.from(
        base64ToBytes(state.poolPrepared.serializedTransaction),
      );
      transaction.partialSign(poolBaseMintKeypairRef.current);
      const signed = await signTransaction(transaction);
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
      setState({
        status: "error",
        message:
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
      state.poolSimulation?.error !== null
    ) {
      return;
    }

    setState({ ...state, poolSubmitting: true });

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

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Meteora pool submission failed.",
        );
      }

      setState({
        ...state,
        poolSubmitting: false,
        poolSubmitted: payload as SubmitResult,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Meteora pool submission failed.",
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
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Meteora pool confirmation check failed.",
      });
    }
  }

  const disabled = !executionEnabled || !connected || state.status === "loading";

  return (
    <div className="meteora-prepare">
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
          Create or import an owned live-mode Navis agent before submitting Meteora
          transactions.
        </p>
      ) : null}

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
          canSimulate={Boolean(signTransaction)}
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
  prepared: PreparedConfigTransaction;
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
  const configConfirmed = confirmation?.confirmation === "confirmed";

  return (
    <div className="meteora-prepared-review">
      <div className="panel-heading">
        <div>
          <span>{prepared.cluster}</span>
          <h3>Unsigned config transaction prepared</h3>
        </div>
        <StatusBadge tone="pending">Unsigned</StatusBadge>
      </div>
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
          <dd>{prepared.review.migrationQuoteThresholdSol} SOL</dd>
        </div>
      </dl>
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
        <p className="form-note">
          This wallet signature authorizes the exact prepared transaction until the
          blockhash expires. Navis uses it here for RPC simulation only.
        </p>
      </div>
      {simulation ? <SimulationReview simulation={simulation} /> : null}
      <div className="meteora-submit-actions">
        <button className="primary-button" type="button" disabled onClick={onSubmit}>
          <FileMagnifyingGlass aria-hidden="true" size={16} />
          {submitting ? "Submitting" : submitted ? "Submitted" : "Submit config"}
        </button>
        <p className="form-note">
          {METEORA_BROADCAST_UNAVAILABLE_REASON} Preparation and simulation remain
          available for review.
        </p>
      </div>
      {submitted ? (
        <SubmitReview
          submitted={submitted}
          confirming={confirming}
          confirmation={confirmation}
          onConfirm={onConfirm}
        />
      ) : null}
      <PoolCreationReview
        enabled={configConfirmed}
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
        onNameChange={onPoolNameChange}
        onSymbolChange={onPoolSymbolChange}
        onUriChange={onPoolUriChange}
        onPrepare={onPreparePool}
        onSimulate={onSimulatePool}
        onSubmit={onSubmitPool}
        onConfirm={onConfirmPool}
      />
      <p className="form-note">
        The config private key is retained only in this browser tab for the next signing
        step. Refreshing the page discards it and requires a new prepared transaction.
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
              disabled={!canSimulate || simulating}
              onClick={onSimulate}
            >
              <FileMagnifyingGlass aria-hidden="true" size={16} />
              {simulating ? "Simulating" : "Sign and simulate pool"}
            </button>
          </div>
          {simulation ? <SimulationReview simulation={simulation} /> : null}
          <div className="meteora-submit-actions">
            <button
              className="primary-button"
              type="button"
              disabled
              onClick={onSubmit}
            >
              <FileMagnifyingGlass aria-hidden="true" size={16} />
              {submitting ? "Submitting" : submitted ? "Submitted" : "Submit pool"}
            </button>
            <p className="form-note">{METEORA_BROADCAST_UNAVAILABLE_REASON}</p>
          </div>
        </div>
      ) : null}
      {submitted ? (
        <SubmitReview
          submitted={submitted}
          confirming={false}
          confirmation={confirmation}
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
  onConfirm,
}: {
  submitted: SubmitResult;
  confirming: boolean;
  confirmation?: ConfirmationResult;
  onConfirm: () => void;
}) {
  return (
    <div className="meteora-submit-review">
      <div className="panel-heading">
        <div>
          <span>{submitted.launch.status ?? "submitted"}</span>
          <h3>Config transaction submitted</h3>
        </div>
        <StatusBadge tone="pending">Pending confirmation</StatusBadge>
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
          <dt>Config</dt>
          <dd>
            <AddressValue value={submitted.launch.config ?? null} label="config" />
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
        {confirmation ? (
          <p className="form-note">
            Confirmation state: {confirmation.confirmation}. Real pool creation remains
            separate from this config transaction.
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
        <StatusBadge tone={failed ? "warn" : "pass"}>
          {failed ? "Review" : "Pass"}
        </StatusBadge>
      </div>
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
        <details>
          <summary>RPC logs</summary>
          <pre>{simulation.logs.slice(0, 20).join("\n")}</pre>
        </details>
      ) : null}
    </div>
  );
}
