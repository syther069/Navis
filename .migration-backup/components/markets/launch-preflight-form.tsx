"use client";

import { ArrowRight, LockKey, Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";
import type { LaunchPreflightResult } from "@/lib/services/launch-preflight";

export type PreflightPairOption = Readonly<{
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  classification: "wrapped_sol" | "stablecoin" | "tokenized_stock" | "unclassified";
  tokenProgram: string;
  eligible: boolean;
}>;

type LaunchAgent = Readonly<{ id: string; name: string; externalAgentId: string }>;

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function classificationLabel(classification: PreflightPairOption["classification"]) {
  switch (classification) {
    case "tokenized_stock":
      return "tokenized stock";
    case "wrapped_sol":
      return "wrapped SOL, not a stock pair";
    case "stablecoin":
      return "stablecoin, not a stock pair";
    default:
      return "stock status unconfirmed";
  }
}

export function PreflightResultView({ result }: { result: LaunchPreflightResult }) {
  const blocking = result.prerequisites.filter((item) => item.severity === "blocking");
  const advisory = result.prerequisites.filter((item) => item.severity === "advisory");
  return (
    <div
      className="preflight-result"
      aria-live="polite"
      data-testid={`preflight-${result.state}`}
    >
      <div className="preflight-result-heading">
        <div>
          <span className="route-eyebrow">
            {result.state === "quoted" ? "Provider quote" : "Preflight rejected"}
          </span>
          <h3>
            {result.state === "quoted" && result.quote
              ? `${result.quote.payment.amountSol} SOL required`
              : result.rejectionOrigin === "local"
                ? "Rejected by Navis before any provider call"
                : "Rejected by the provider"}
          </h3>
        </div>
        <StatusBadge tone={result.state === "quoted" ? "pending" : "block"}>
          {result.state === "quoted" ? "Preflight successful" : "Preflight rejected"}
        </StatusBadge>
      </div>
      {result.rejectionReason ? (
        <p className="form-error" role="alert">
          <strong>
            {result.rejectionOrigin === "local" ? "Local: " : "Provider: "}
          </strong>
          {result.rejectionReason}
        </p>
      ) : null}
      {result.quote ? (
        <SourceStamp
          source="ClawPump preflight"
          timestamp={result.quote.meta.timestamp}
        />
      ) : null}
      <dl className="preflight-breakdown">
        <div>
          <dt>Agent</dt>
          <dd>
            {result.agent.name} → {result.agent.externalAgentId}
          </dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>
            {result.tokenConfig.name} ({result.tokenConfig.symbol}), fee{" "}
            {result.tokenConfig.creatorFeeBps} bps, initial buy{" "}
            {result.tokenConfig.devBuySol} SOL
          </dd>
        </div>
        <div>
          <dt>Quote asset</dt>
          <dd>
            {result.quoteAsset
              ? `${result.quoteAsset.symbol} · ${classificationLabel(result.quoteAsset.classification)} · ${
                  result.quoteAsset.tokenProgram.status === "verified"
                    ? result.quoteAsset.tokenProgram.program
                    : "token program unverified"
                }`
              : "not in catalogue"}
          </dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{result.network}</dd>
        </div>
        <div>
          <dt>Provider validation</dt>
          <dd>
            {result.providerValidation.result === "accepted"
              ? `accepted (request ${result.providerValidation.requestId})`
              : result.providerValidation.result === "rejected"
                ? `rejected${result.providerValidation.httpStatus ? ` HTTP ${result.providerValidation.httpStatus}` : ""}${
                    result.providerValidation.code
                      ? ` [${result.providerValidation.code}]`
                      : ""
                  }`
                : `not requested: ${result.providerValidation.reason}`}
          </dd>
        </div>
        <div>
          <dt>Required wallet</dt>
          <dd>
            <AddressValue value={result.requiredWallet} label="Required wallet" />
          </dd>
        </div>
        {result.costEstimate ? (
          <div>
            <dt>Cost discovery</dt>
            <dd>
              {result.costEstimate.standardCostSol} SOL standard (creation{" "}
              {result.costEstimate.creationFeeSol} SOL), request{" "}
              {result.costEstimate.requestId}
            </dd>
          </div>
        ) : null}
        {result.quote ? (
          <>
            <div>
              <dt>Exact amount</dt>
              <dd>{result.quote.payment.amountLamports.toLocaleString()} lamports</dd>
            </div>
            <div>
              <dt>Pay to</dt>
              <dd>
                <AddressValue
                  value={result.quote.payment.payTo}
                  label="Payment recipient"
                />
              </dd>
            </div>
            <div>
              <dt>Pay from</dt>
              <dd>
                <AddressValue value={result.quote.payment.payFrom} label="Payer" />
              </dd>
            </div>
            <div>
              <dt>Validity</dt>
              <dd>{result.quote.payment.validForSeconds} seconds</dd>
            </div>
            <div>
              <dt>Breakdown</dt>
              <dd>
                {Object.entries(result.quote.payment.breakdown)
                  .map(([key, value]) => `${key} ${String(value)}`)
                  .join(", ")}
              </dd>
            </div>
          </>
        ) : null}
        {result.walletBalanceLamports !== null ? (
          <div>
            <dt>Payer mainnet balance</dt>
            <dd>{result.walletBalanceLamports.toLocaleString()} lamports</dd>
          </div>
        ) : null}
      </dl>
      <div className="preflight-prerequisites" data-testid="preflight-prerequisites">
        <span className="route-eyebrow">Outstanding prerequisites</span>
        {result.prerequisites.length === 0 ? (
          <p>None outstanding.</p>
        ) : (
          <ul>
            {blocking.map((item) => (
              <li key={item.code} data-severity="blocking">
                <StatusBadge tone="block">blocking</StatusBadge> <em>{item.origin}</em>{" "}
                {item.message}
              </li>
            ))}
            {advisory.map((item) => (
              <li key={item.code} data-severity="advisory">
                <StatusBadge tone="warn">advisory</StatusBadge> <em>{item.origin}</em>{" "}
                {item.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p>
        <strong>
          {result.readyForAuthorisedExecution
            ? "Ready for a separate authorised execution step. Nothing launched."
            : "Not ready for execution. Nothing launched."}
        </strong>{" "}
        {result.statement}
      </p>
      <button className="primary-button" type="button" disabled>
        Launch not submitted <ArrowRight size={17} />
      </button>
    </div>
  );
}

export function LaunchPreflightForm({
  pairs,
  creatorFeeBps,
  agents,
  authenticatedWallet,
  latest,
}: {
  pairs: readonly PreflightPairOption[];
  creatorFeeBps: { min: number; max: number; default: number };
  agents: readonly LaunchAgent[];
  authenticatedWallet: string | null;
  latest: LaunchPreflightResult | null;
}) {
  const selectable = useMemo(() => pairs.filter((pair) => pair.eligible), [pairs]);
  const [localAgentId, setLocalAgentId] = useState(agents[0]?.id ?? "");
  const [quoteMint, setQuoteMint] = useState(selectable[0]?.mint ?? "");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [feeBps, setFeeBps] = useState(creatorFeeBps.default);
  const [devBuySol, setDevBuySol] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchPreflightResult | null>(null);

  const selectedPair = useMemo(
    () => pairs.find((pair) => pair.mint === quoteMint),
    [pairs, quoteMint],
  );
  const ready = Boolean(authenticatedWallet && localAgentId && selectedPair);
  const shown = result ?? latest;

  function invalidate() {
    setResult(null);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/integrations/clawpump/launch/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localAgentId,
          name,
          symbol,
          description,
          imageUrl,
          quoteMint,
          creatorFeeBps: feeBps,
          devBuySol,
        }),
      });
      const body = await readJson(response);
      if (!response.ok || (body.state !== "quoted" && body.state !== "rejected")) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Preflight could not be completed.",
        );
      }
      setResult(body as unknown as LaunchPreflightResult);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Preflight could not be completed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="route-panel launch-preflight-panel">
      <form className="launch-form" onSubmit={submit} noValidate>
        <div className="panel-heading">
          <LockKey aria-hidden="true" size={20} />
          <div>
            <span>Bound preflight</span>
            <h2>Define exact launch terms</h2>
          </div>
        </div>

        <div className="launch-form-grid">
          <label className="form-field">
            <span>Linked Navis agent</span>
            <select
              value={localAgentId}
              onChange={(event) => {
                setLocalAgentId(event.target.value);
                invalidate();
              }}
              disabled={agents.length === 0}
            >
              {agents.length === 0 ? (
                <option value="">No linked agent available</option>
              ) : (
                agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} → {agent.externalAgentId}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="form-field">
            <span>Stock-paired quote asset</span>
            <select
              value={quoteMint}
              disabled={selectable.length === 0}
              onChange={(event) => {
                setQuoteMint(event.target.value);
                invalidate();
              }}
            >
              {selectable.length === 0 ? (
                <option value="">
                  No stock-paired quote asset in the live catalogue
                </option>
              ) : (
                selectable.map((pair) => (
                  <option key={pair.mint} value={pair.mint}>
                    {pair.symbol} · {pair.name} ·{" "}
                    {classificationLabel(pair.classification)}
                  </option>
                ))
              )}
            </select>
            <small>
              Wrapped SOL and stablecoin pairs are excluded: they are not stock pairs.
            </small>
          </label>
          <label className="form-field">
            <span>Token name</span>
            <input
              value={name}
              maxLength={32}
              required
              onChange={(event) => {
                setName(event.target.value);
                invalidate();
              }}
            />
          </label>
          <label className="form-field">
            <span>Symbol</span>
            <input
              value={symbol}
              maxLength={10}
              required
              onChange={(event) => {
                setSymbol(event.target.value.toUpperCase());
                invalidate();
              }}
            />
          </label>
          <label className="form-field launch-form-wide">
            <span>Description</span>
            <textarea
              value={description}
              minLength={20}
              maxLength={500}
              rows={3}
              required
              onChange={(event) => {
                setDescription(event.target.value);
                invalidate();
              }}
            />
          </label>
          <label className="form-field launch-form-wide">
            <span>HTTPS image URL</span>
            <input
              value={imageUrl}
              type="url"
              placeholder="https://…"
              required
              onChange={(event) => {
                setImageUrl(event.target.value);
                invalidate();
              }}
            />
          </label>
          <label className="form-field">
            <span>Creator fee (bps)</span>
            <input
              value={feeBps}
              type="number"
              min={creatorFeeBps.min}
              max={creatorFeeBps.max}
              required
              onChange={(event) => {
                setFeeBps(Number(event.target.value));
                invalidate();
              }}
            />
            <small>
              Provider range {creatorFeeBps.min}–{creatorFeeBps.max} bps.
            </small>
          </label>
          <label className="form-field">
            <span>Initial buy (SOL)</span>
            <input
              value={devBuySol}
              type="number"
              min={0}
              max={100}
              step="0.001"
              onChange={(event) => {
                setDevBuySol(Number(event.target.value));
                invalidate();
              }}
            />
            <small>0 makes no initial purchase.</small>
          </label>
        </div>

        <div className="preflight-fixed-terms">
          <div>
            <span>Quote mint</span>
            {selectedPair ? (
              <AddressValue value={selectedPair.mint} label="Selected quote mint" />
            ) : (
              <strong>Not selected</strong>
            )}
          </div>
          <div>
            <span>Payer and payout wallet</span>
            {authenticatedWallet ? (
              <AddressValue value={authenticatedWallet} label="Authenticated wallet" />
            ) : (
              <strong>Authenticate wallet</strong>
            )}
          </div>
          <p>
            Network: Solana mainnet (ClawPump exposes no cluster selector). The selected
            pair and creator fee become fixed at launch. Creator fees accrue in the
            paired asset; the payout wallet receives the provider-defined 75% share.
            ClawPump retains creator-wallet custody. This form only requests a read-only
            quote.
          </p>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            <Warning size={16} aria-hidden="true" /> {error}
          </p>
        ) : null}
        <button
          className="primary-button"
          type="submit"
          disabled={!ready || submitting}
        >
          <LockKey size={17} aria-hidden="true" />
          {submitting
            ? "Requesting exact quote…"
            : !authenticatedWallet
              ? "Authenticate wallet to preflight"
              : agents.length === 0
                ? "Link an agent to continue"
                : selectable.length === 0
                  ? "No stock pair available"
                  : "Run exact preflight"}
        </button>
      </form>

      {shown ? (
        <>
          {!result && latest ? (
            <small className="route-copy">
              Latest stored preflight for this wallet.
            </small>
          ) : null}
          <PreflightResultView result={shown} />
        </>
      ) : null}
    </section>
  );
}
