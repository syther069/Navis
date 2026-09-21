"use client";

import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { riskPolicyDocumentSchema } from "../../lib/domain/risk-policy";
import { strategyDocumentSchema } from "../../lib/domain/strategy";

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

function newRequestKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
}: {
  persistenceAvailable: boolean;
  clawPumpAvailable: boolean;
  authenticated: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [linkClawPump, setLinkClawPump] = useState(false);
  const [creating, setCreating] = useState(false);
  // One key per reviewed mandate. A retry after a network or storage failure
  // reuses it, so the server returns the first agent instead of a second one.
  // Going back to edit the mandate issues a fresh key.
  const requestKey = useRef<string | null>(null);
  const inFlight = useRef(false);

  async function createAgent() {
    if (inFlight.current) return;
    inFlight.current = true;
    setCreating(true);
    setError(null);
    setFailure(null);
    requestKey.current ??= newRequestKey();
    try {
      let response: Response;
      try {
        response = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            linkClawPump,
            clientRequestId: requestKey.current,
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
    requestKey.current = newRequestKey();
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
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={linkClawPump}
            disabled={!clawPumpAvailable}
            onChange={(event) => setLinkClawPump(event.target.checked)}
          />
          <span>
            Link a ClawPump agent after local creation
            <small>
              {clawPumpAvailable
                ? "Provider failure will preserve the local draft."
                : "External agent creation is unavailable for this safe demo draft."}
            </small>
          </span>
        </label>
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
        <strong>Not saved: storage unavailable.</strong>
        <p>
          {failure.message} Nothing was stored for this mandate. You can try again with
          the same details; a retry will not create a second agent.
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
