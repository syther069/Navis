"use client";

import { MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";

import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";

type PoolStatus = Readonly<{
  source: "Meteora DBC onchain account";
  cluster: string;
  programId: string;
  fetchedAt: string;
  contextSlot: number;
  poolAddress: string;
  baseMint: string;
  configAddress: string;
  quoteReserveRaw: string;
  migrationQuoteThresholdRaw: string;
  progressRatio: number;
  migrated: boolean;
  launch: {
    launchId: string | null;
    status: string;
    evidence: {
      label: string;
      state: string;
      slot: number | null;
      feeLamports: number | null;
      confirmedAt: string | null;
      account: string | null;
      checks: {
        field: string;
        expected: string | null;
        actual: string | null;
        ok: boolean;
      }[];
    } | null;
  } | null;
}>;

function evidenceTone(label: string) {
  if (label === "protocol_verified") return "pass" as const;
  if (label === "signature_confirmed") return "simulation" as const;
  return "block" as const;
}

type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; data: PoolStatus }
  | { status: "empty"; message: string }
  | { status: "error"; message: string };

export function MeteoraPoolMonitor({ rpcConfigured }: { rpcConfigured: boolean }) {
  const [baseMint, setBaseMint] = useState("");
  const [state, setState] = useState<QueryState>({ status: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mint = baseMint.trim();
    if (!mint) return;

    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/integrations/meteora/pools/${encodeURIComponent(mint)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();

      if (response.ok) {
        setState({ status: "found", data: payload as PoolStatus });
        return;
      }

      setState({
        status: response.status === 404 ? "empty" : "error",
        message:
          typeof payload?.error === "string"
            ? payload.error
            : "Meteora pool lookup failed.",
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Meteora pool lookup failed.",
      });
    }
  }

  const disabled = !rpcConfigured || state.status === "loading";

  return (
    <div className="meteora-monitor">
      <form onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Base mint</span>
          <input
            value={baseMint}
            onChange={(event) => setBaseMint(event.target.value)}
            placeholder="Paste a confirmed DBC base mint"
            disabled={!rpcConfigured}
          />
        </label>
        <button className="secondary-button" type="submit" disabled={disabled}>
          <MagnifyingGlass aria-hidden="true" size={16} />
          {state.status === "loading" ? "Reading" : "Check pool"}
        </button>
      </form>

      {!rpcConfigured ? (
        <p className="form-note">
          Set the server-only Solana RPC URL to read confirmed Meteora pool state.
        </p>
      ) : null}

      {state.status === "found" ? <PoolResult pool={state.data} /> : null}

      {state.status === "empty" || state.status === "error" ? (
        <div className="form-error" role="status">
          <WarningCircle aria-hidden="true" size={16} />
          <span>{state.message}</span>
        </div>
      ) : null}
    </div>
  );
}

function PoolResult({ pool }: { pool: PoolStatus }) {
  const progress = Math.max(0, Math.min(100, pool.progressRatio * 100));

  return (
    <div className="meteora-pool-result">
      <div className="panel-heading">
        <div>
          <span>{pool.cluster}</span>
          <h3>{progress.toFixed(2)}% to migration</h3>
        </div>
        <StatusBadge tone={pool.migrated ? "pass" : "simulation"}>
          {pool.migrated ? "Migrated" : "Bonding"}
        </StatusBadge>
      </div>
      <SourceStamp source={pool.source} timestamp={pool.fetchedAt} />
      <dl className="meteora-address-list">
        <div>
          <dt>Pool</dt>
          <dd>
            <AddressValue value={pool.poolAddress} label="Meteora pool" />
          </dd>
        </div>
        <div>
          <dt>Config</dt>
          <dd>
            <AddressValue value={pool.configAddress} label="Meteora config" />
          </dd>
        </div>
        <div>
          <dt>Base mint</dt>
          <dd>
            <AddressValue value={pool.baseMint} label="base mint" />
          </dd>
        </div>
        <div>
          <dt>Quote reserve</dt>
          <dd>{pool.quoteReserveRaw} lamports</dd>
        </div>
        <div>
          <dt>Migration threshold</dt>
          <dd>{pool.migrationQuoteThresholdRaw} lamports</dd>
        </div>
        <div>
          <dt>RPC slot</dt>
          <dd>{pool.contextSlot}</dd>
        </div>
      </dl>
      <LaunchEvidence launch={pool.launch} />
    </div>
  );
}

function LaunchEvidence({ launch }: { launch: PoolStatus["launch"] }) {
  if (!launch) {
    return (
      <p className="form-note">
        No Navis launch record for this pool. The onchain state above is real, but Navis
        did not submit it.
      </p>
    );
  }
  if (!launch.evidence) {
    return (
      <p className="form-note">
        Navis launch record {launch.status.replaceAll("_", " ")}: not yet reconciled.
      </p>
    );
  }
  const evidence = launch.evidence;
  return (
    <div className="meteora-launch-evidence">
      <div className="panel-heading">
        <div>
          <span>Navis launch record</span>
          <h3>{launch.status.replaceAll("_", " ")}</h3>
        </div>
        <StatusBadge tone={evidenceTone(evidence.label)}>
          {evidence.label.replaceAll("_", " ")}
        </StatusBadge>
      </div>
      <dl className="meteora-address-list">
        <div>
          <dt>Confirmed slot</dt>
          <dd>{evidence.slot ?? "not confirmed"}</dd>
        </div>
        <div>
          <dt>Fee</dt>
          <dd>
            {evidence.feeLamports === null ? "n/a" : `${evidence.feeLamports} lamports`}
          </dd>
        </div>
        <div>
          <dt>Verified account</dt>
          <dd>
            {evidence.account ? (
              <AddressValue value={evidence.account} label="verified account" />
            ) : (
              "none"
            )}
          </dd>
        </div>
        {evidence.checks.map((check) => (
          <div key={check.field}>
            <dt>{check.field}</dt>
            <dd>
              {check.ok
                ? "matches"
                : `expected ${check.expected ?? "?"}, got ${check.actual ?? "missing"}`}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
