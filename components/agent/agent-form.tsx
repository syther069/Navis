"use client";

import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";

import { riskPolicyDocumentSchema } from "../../lib/domain/risk-policy";
import { strategyDocumentSchema } from "../../lib/domain/strategy";
import {
  browserStorage,
  clearPendingCreation,
  mandateFingerprint,
  PENDING_CREATION_STORAGE_KEY,
  readPendingCreation,
  requestKeyFor,
} from "./request-key";

type FormValues = {
  name: string;
  objective: string;
  maxTradeBps: number;
  maxPositionBps: number;
  minReserveBps: number;
  maxSlippageBps: number;
};

type CreationResult = Readonly<{
  agent: {
    id: string;
    slug: string;
    name: string;
    status: string;
    strategyHash: string;
    riskPolicyHash: string;
  };
  link:
    | { status: "not_requested" }
    | { status: "linked"; externalAgentId: string; wallet: string; requestId: string }
    | { status: "failed"; error: string };
}>;

type FormFailure = Readonly<{
  kind: "validation" | "authorization" | "storage" | "unknown";
  message: string;
}>;

/** Storage-side failure codes from lib/db/errors.ts. */
const STORAGE_CODES = new Set([
  "database_not_configured",
  "database_unreachable",
  "database_schema_mismatch",
  "database_timeout",
  "database_transaction_failed",
  "database_error",
]);

function classifyFailure(status: number, body: Record<string, unknown>): FormFailure {
  const code = typeof body.code === "string" ? body.code : undefined;
  const message =
    typeof body.error === "string" ? body.error : "Agent creation failed.";
  if (code && STORAGE_CODES.has(code)) return { kind: "storage", message };
  if (status === 401 || status === 403 || code === "authorization_failed") {
    return { kind: "authorization", message };
  }
  if (status === 400 || status === 409 || status === 422) {
    return { kind: "validation", message };
  }
  if (status >= 500) return { kind: "storage", message };
  return { kind: "unknown", message };
}

function readPendingRaw(): string | null {
  return browserStorage().getItem(PENDING_CREATION_STORAGE_KEY);
}

function subscribeToSessionStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const demoAssets = [
  "demo_mint_equity_a",
  "demo_mint_equity_b",
  "demo_mint_equity_c",
  "demo_mint_equity_d",
];

const initialValues: FormValues = {
  name: "",
  objective: "",
  maxTradeBps: 1_000,
  maxPositionBps: 3_500,
  minReserveBps: 2_000,
  maxSlippageBps: 75,
};

export function AgentForm({
  persistenceAvailable,
  clawPumpAvailable,
  authenticated,
  wallet,
}: {
  persistenceAvailable: boolean;
  clawPumpAvailable: boolean;
  authenticated: boolean;
  /** Session wallet, or null when not signed in. Scopes the pending record. */
  wallet: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  // Linking is a separate owner action on the saved agent; creation never
  // requests it, so the request key stays stable for the mandate alone.
  const linkClawPump = false;
  const [creating, setCreating] = useState(false);
  // One key per reviewed mandate, kept in localStorage with a fingerprint
  // of the mandate (components/agent/request-key.ts). A retry after a network
  // or storage failure, including after a reload or a closed and reopened browser, sends the same
  // key, so the server returns the first agent instead of a second one. A
  // changed mandate gets a fresh key.
  const inFlight = useRef(false);

  // After a reload or reopen with an unconfirmed save, offer the same mandate back so
  // the owner can review and retry it (same request key) rather than retype
  // it. Read through useSyncExternalStore so the server render stays empty
  // and no state is set from an effect.
  const pendingRaw = useSyncExternalStore(
    subscribeToSessionStorage,
    readPendingRaw,
    () => null,
  );
  const pending =
    pendingRaw && wallet ? readPendingCreation(browserStorage(), wallet) : null;
  const pendingIsCurrent =
    pending !== null &&
    wallet !== null &&
    mandateFingerprint(wallet, { ...values, linkClawPump }) === pending.fingerprint;

  function restorePending() {
    if (!pending) return;
    // The stored mandate carries the link flag; the form values do not.
    const pendingValues = { ...pending.mandate };
    delete (pendingValues as { linkClawPump?: boolean }).linkClawPump;
    setValues(pendingValues);
    setError(null);
  }

  async function createAgent() {
    if (inFlight.current) return;
    inFlight.current = true;
    setCreating(true);
    setError(null);
    setFailure(null);
    const clientRequestId = wallet
      ? requestKeyFor(browserStorage(), wallet, { ...values, linkClawPump })
      : undefined;
    try {
      let response: Response;
      try {
        response = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            linkClawPump,
            clientRequestId,
          }),
        });
      } catch {
        setFailure({
          kind: "storage",
          message: "No answer came back from Navis, so the save is unconfirmed.",
        });
        return;
      }
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || !body.agent) {
        setFailure(classifyFailure(response.status, body));
        return;
      }
      const result = body as unknown as CreationResult;
      clearPendingCreation(browserStorage());
      router.push(`/agents/${encodeURIComponent(result.agent.slug)}`);
    } finally {
      inFlight.current = false;
      setCreating(false);
    }
  }

  function update(name: keyof FormValues, value: string) {
    setValues((current) => ({
      ...current,
      [name]: name === "name" || name === "objective" ? value : Number(value),
    }));
  }

  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const strategy = strategyDocumentSchema.safeParse({
      objective: values.objective,
      horizon: "monthly",
      cadence: { kind: "manual" },
      universe: demoAssets,
      signals: ["Deterministic demo relative-strength fixture"],
      allowedActions: ["BUY", "SELL", "HOLD", "REBALANCE"],
      riskPolicyVersion: 1,
    });
    const policy = riskPolicyDocumentSchema.safeParse({
      constraints: [
        { type: "allowed_mints", mints: demoAssets },
        { type: "max_trade_bps", value: values.maxTradeBps },
        { type: "max_position_bps", value: values.maxPositionBps },
        { type: "min_reserve_bps", value: values.minReserveBps },
        { type: "max_slippage_bps", value: values.maxSlippageBps },
        { type: "max_daily_turnover_bps", value: 2_500 },
        { type: "cooldown_seconds", value: 3_600 },
        { type: "max_data_age_seconds", value: 300 },
        { type: "min_liquidity_usd_micros", value: "1000000000" },
        { type: "allowed_modes", modes: ["demo"] },
      ],
    });

    if (values.name.trim().length < 2 || !strategy.success || !policy.success) {
      setError(
        policy.error?.issues[0]?.message ??
          strategy.error?.issues[0]?.message ??
          "Agent name must contain at least two characters",
      );
      return;
    }

    setError(null);
    setFailure(null);
    // Remember the reviewed mandate now so a reload before or after the save
    // attempt restores it with the same request key.
    if (wallet) {
      requestKeyFor(browserStorage(), wallet, { ...values, linkClawPump });
    }
    setReviewing(true);
  }

  if (reviewing) {
    return (
      <section className="agent-form route-panel" aria-labelledby="agent-review-title">
        <span className="route-eyebrow">Review required</span>
        <h2 id="agent-review-title">Confirm the mandate before creation</h2>
        <dl className="review-list">
          <ReviewRow label="Agent" value={values.name} />
          <ReviewRow label="Objective" value={values.objective} />
          <ReviewRow label="Universe" value="4 explicit demo assets" />
          <ReviewRow
            label="Max trade / position"
            value={`${values.maxTradeBps / 100}% / ${values.maxPositionBps / 100}%`}
          />
          <ReviewRow label="Minimum reserve" value={`${values.minReserveBps / 100}%`} />
          <ReviewRow
            label="Maximum slippage"
            value={`${values.maxSlippageBps / 100}%`}
          />
        </dl>
        <div className="form-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={creating}
            onClick={() => {
              setFailure(null);
              setReviewing(false);
            }}
          >
            <ArrowLeft aria-hidden="true" size={17} /> Edit mandate
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!persistenceAvailable || creating}
            aria-busy={creating}
            onClick={() => void createAgent()}
          >
            <Check aria-hidden="true" size={17} />
            {creating ? "Saving…" : failure ? "Try again" : "Create agent"}
          </button>
        </div>
        <p className="form-note">
          {clawPumpAvailable
            ? "ClawPump is configured on this server. After saving, link this agent to a ClawPump identity from its agent page; a provider failure never touches the local draft."
            : "ClawPump is not configured (CLAWPUMP_API_KEY, a cpk_ Partner key). Linking becomes available on the agent page once the key exists."}
        </p>
        {failure ? <CreationFailure failure={failure} /> : null}
        <p className="form-note">
          {persistenceAvailable
            ? "The authenticated wallet will own this persistent draft."
            : authenticated
              ? "Creation is unavailable until persistent storage and wallet sessions are configured."
              : "Connect and authenticate a wallet before saving. You can still review the mandate without signing in."}
        </p>
      </section>
    );
  }

  return (
    <form className="agent-form route-panel" onSubmit={review} noValidate>
      {pending && !pendingIsCurrent ? (
        <div className="form-notice" role="status">
          <p>
            An earlier save of <strong>{pending.mandate.name}</strong> was not
            confirmed. Restoring it and creating again repeats the same request, so it
            cannot make a second agent.
          </p>
          <button className="secondary-button" type="button" onClick={restorePending}>
            Restore that mandate
          </button>
        </div>
      ) : null}
      <TextField label="Agent name" name="name" value={values.name} update={update} />
      <div className="form-field">
        <label htmlFor="objective">Objective</label>
        <textarea
          id="objective"
          value={values.objective}
          onChange={(event) => update("objective", event.target.value)}
          required
          minLength={20}
          rows={4}
        />
        <small>State the capital mandate in at least 20 characters.</small>
      </div>
      <fieldset>
        <legend>Risk limits</legend>
        <div className="numeric-grid">
          <NumberField
            label="Max trade (bps)"
            name="maxTradeBps"
            value={values.maxTradeBps}
            update={update}
          />
          <NumberField
            label="Max position (bps)"
            name="maxPositionBps"
            value={values.maxPositionBps}
            update={update}
          />
          <NumberField
            label="Minimum reserve (bps)"
            name="minReserveBps"
            value={values.minReserveBps}
            update={update}
          />
          <NumberField
            label="Max slippage (bps)"
            name="maxSlippageBps"
            value={values.maxSlippageBps}
            update={update}
          />
        </div>
      </fieldset>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary-button" type="submit">
        Review mandate <ArrowRight aria-hidden="true" size={18} />
      </button>
    </form>
  );
}

function CreationFailure({ failure }: { failure: FormFailure }) {
  if (failure.kind === "storage") {
    return (
      <div className="form-error form-error-storage" role="alert">
        <strong>Save not confirmed: storage problem.</strong>
        <p>
          {failure.message} Use Try again: it repeats this exact request, so it returns
          the agent if it was stored and creates it once if it was not. It cannot create
          a second agent. If you edit the mandate instead, check your agents list first.
        </p>
      </div>
    );
  }
  if (failure.kind === "authorization") {
    return (
      <div className="form-error" role="alert">
        <strong>Not saved: sign in required.</strong>
        <p>{failure.message} Authenticate the wallet again and retry.</p>
      </div>
    );
  }
  return (
    <div className="form-error" role="alert">
      <strong>Not saved: the mandate was rejected.</strong>
      <p>{failure.message} Edit the mandate and review it again.</p>
    </div>
  );
}

function TextField({
  label,
  name,
  value,
  update,
}: {
  label: string;
  name: "name";
  value: string;
  update: (name: keyof FormValues, value: string) => void;
}) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        value={value}
        onChange={(event) => update(name, event.target.value)}
        required
        minLength={2}
      />
    </div>
  );
}

function NumberField({
  label,
  name,
  value,
  update,
}: {
  label: string;
  name: Exclude<keyof FormValues, "name" | "objective">;
  value: number;
  update: (name: keyof FormValues, value: string) => void;
}) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        type="number"
        min={0}
        max={10_000}
        value={value}
        onChange={(event) => update(name, event.target.value)}
      />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
