"use client";

import { ArrowRight, LockKey, Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { AddressValue } from "@/components/shared/address-value";
import { SourceStamp, StatusBadge } from "@/components/shared/domain-primitives";

type Pair = Readonly<{
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  imageUrl: string | null;
}>;

type LaunchAgent = Readonly<{ id: string; name: string }>;

type QuoteResult = Readonly<{
  state: "quoted";
  pair: Pair;
  creatorFeeBps: number;
  payoutWallet: string;
  payment: {
    method: "sol";
    amountLamports: number;
    amountSol: number;
    payTo: string;
    payFrom: string;
    validForSeconds: number;
    breakdown: { creationFeeSol: number; devBuySol: number };
  };
  meta: { timestamp: string; requestId: string };
}>;

type PaymentRequiredResult = Readonly<{
  state: "payment_required";
  error: string;
  requestId?: string;
}>;

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export function LaunchPreflightForm({
  pairs,
  creatorFeeBps,
  agents,
  authenticatedWallet,
}: {
  pairs: readonly Pair[];
  creatorFeeBps: { min: number; max: number; default: number };
  agents: readonly LaunchAgent[];
  authenticatedWallet: string | null;
}) {
  const [localAgentId, setLocalAgentId] = useState(agents[0]?.id ?? "");
  const [quoteMint, setQuoteMint] = useState(pairs[0]?.mint ?? "");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [feeBps, setFeeBps] = useState(creatorFeeBps.default);
  const [devBuySol, setDevBuySol] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResult | PaymentRequiredResult | null>(
    null,
  );

  const selectedPair = useMemo(
    () => pairs.find((pair) => pair.mint === quoteMint),
    [pairs, quoteMint],
  );
  const ready = Boolean(authenticatedWallet && localAgentId && selectedPair);

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

      if (response.status === 402 && body.state === "payment_required") {
        setResult({
          state: "payment_required",
          error:
            typeof body.error === "string"
              ? body.error
              : "The provider requires payment terms to continue.",
          requestId: typeof body.requestId === "string" ? body.requestId : undefined,
        });
        return;
      }
      if (!response.ok || body.state !== "quoted") {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Preflight could not be quoted.",
        );
      }

      setResult(body as unknown as QuoteResult);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Preflight could not be quoted.",
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
            <span>Navis agent</span>
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
                    {agent.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="form-field">
            <span>Stock-paired quote asset</span>
            <select
              value={quoteMint}
              onChange={(event) => {
                setQuoteMint(event.target.value);
                invalidate();
              }}
            >
              {pairs.map((pair) => (
                <option key={pair.mint} value={pair.mint}>
                  {pair.symbol} — {pair.name}
                </option>
              ))}
            </select>
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
            The selected pair and creator fee become fixed at launch. Creator fees
            accrue in the paired asset; the payout wallet receives the provider-defined
            75% share. ClawPump retains creator-wallet custody.
          </p>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
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
                : "Run exact preflight"}
        </button>
      </form>

      {result?.state === "quoted" ? (
        <div className="preflight-result" aria-live="polite">
          <div className="preflight-result-heading">
            <div>
              <span className="route-eyebrow">Provider quote</span>
              <h3>{result.payment.amountSol} SOL required</h3>
            </div>
            <StatusBadge tone="pending">Review only</StatusBadge>
          </div>
          <SourceStamp source="ClawPump preflight" timestamp={result.meta.timestamp} />
          <dl className="preflight-breakdown">
            <div>
              <dt>Exact amount</dt>
              <dd>{result.payment.amountLamports.toLocaleString()} lamports</dd>
            </div>
            <div>
              <dt>Creation fee</dt>
              <dd>{result.payment.breakdown.creationFeeSol} SOL</dd>
            </div>
            <div>
              <dt>Initial buy</dt>
              <dd>{result.payment.breakdown.devBuySol} SOL</dd>
            </div>
            <div>
              <dt>Quote lifetime</dt>
              <dd>{result.payment.validForSeconds} seconds</dd>
            </div>
          </dl>
          <div className="preflight-addresses">
            <span>Payment recipient</span>
            <AddressValue value={result.payment.payTo} label="Payment recipient" />
          </div>
          <p>
            Request {result.meta.requestId}. No transfer has been created or signed.
            Changing any launch term invalidates this review.
          </p>
          <button className="primary-button" type="button" disabled>
            Authorize payment <ArrowRight size={17} />
          </button>
          <small>
            Execution remains locked until guarded launch submission is enabled.
          </small>
        </div>
      ) : null}

      {result?.state === "payment_required" ? (
        <div className="preflight-payment-state" role="status">
          <Warning size={20} aria-hidden="true" />
          <div>
            <strong>Provider returned a payment review state</strong>
            <p>{result.error}</p>
            {result.requestId ? <small>Request {result.requestId}</small> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
