import { FlaskConical } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import {
  browserStorage,
  clearPendingRun,
  runRequestKeyFor,
} from "@/components/decisions/run-request-key";
import { DecisionRecord } from "@/components/workspace/decision-record";
import { ErrorState, SkeletonRows } from "@/components/workspace/primitives";
import { WorkspaceHint } from "@/components/workspace/workspace-hint";
import { decisionScenarios, type DecisionScenario } from "@workspace/navis-core/lib/decisions/scenarios";
import {
  decisionUniverses,
  type DecisionUniverseSource,
} from "@workspace/navis-core/lib/decisions/universe";
import type { DecisionRunResult } from "@workspace/navis-core/lib/services/run-decision";

/**
 * Presentation of one decision run. Kept under its original name and props so
 * the decision detail route and any other caller render the new structured
 * record without changes.
 */
export function DecisionRunResultView({
  run,
  showDetailLink = true,
}: {
  run: DecisionRunResult;
  showDetailLink?: boolean;
}) {
  return <DecisionRecord run={run} showDetailLink={showDetailLink} />;
}

function OptionGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  disabled,
  testId,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string; description: string }[];
  onChange: (value: T) => void;
  disabled: boolean;
  testId?: string;
}) {
  return (
    <fieldset className="ws-options" data-testid={testId} disabled={disabled}>
      <legend>{legend}</legend>
      <div className="ws-options-grid">
        {options.map((option) => (
          <label
            key={option.value}
            className="ws-option"
            data-selected={option.value === value || undefined}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              data-testid={`radio-${name}-${option.value}`}
            />
            <span className="ws-option-copy">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RunDecisionPanel({
  agentSlug = "atlas",
  agentName,
  persisted = false,
  onRunComplete,
}: {
  agentSlug?: string;
  agentName?: string;
  persisted?: boolean;
  /** Called with the confirmed run so the caller can refresh its record list. */
  onRunComplete?: (run: DecisionRunResult) => void;
}) {
  const [scenario, setScenario] = useState<DecisionScenario>("balanced");
  // Stored agents keep their own immutable allowlist, so the universe choice
  // only applies to the in-memory Atlas demo run.
  const [universe, setUniverse] = useState<DecisionUniverseSource>(
    persisted ? "fixture" : "prestocks",
  );
  const [run, setRun] = useState<DecisionRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const onRunCompleteRef = useRef(onRunComplete);
  onRunCompleteRef.current = onRunComplete;
  const resultRef = useRef<HTMLDivElement>(null);

  async function execute() {
    setPending(true);
    setError(null);
    // One key per submission. It survives a failed or interrupted request so
    // a retry returns the stored run instead of a twin; a confirmed run
    // clears it so the next click produces a fresh decision.
    const store = browserStorage();
    const requestKey = persisted
      ? undefined
      : runRequestKeyFor(store, { agentSlug, scenario, universe });
    try {
      const response = await fetch("/api/decisions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agentSlug,
          scenario,
          universe,
          ...(requestKey ? { requestKey } : {}),
        }),
      });
      const body = (await response.json()) as DecisionRunResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Decision run failed.");
      if (requestKey) clearPendingRun(store);
      setRun(body);
      onRunCompleteRef.current?.(body);
      requestAnimationFrame(() => {
        resultRef.current?.focus({ preventScroll: true });
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Decision run failed.");
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void execute();
  }

  const title = `${persisted ? "Generate decision" : "Run new decision"}${agentName ? ` for ${agentName}` : ""}`;

  return (
    <section className="ws-run decision-run-panel" aria-labelledby="run-title">
      <div className="ws-run-head">
        <div className="ws-section-title">
          <span className="ws-eyebrow">Live service path · demo simulation</span>
          <div className="ws-heading-row">
            <h2 id="run-title">{title}</h2>
            <WorkspaceHint topic="runDecision" label="About running a decision" />
          </div>
          <p className="ws-lede">
            {persisted
              ? "Generate a fresh proposal, let the policy code approve or reject it, and store the decision, evaluation and receipt for this wallet."
              : "Generate a fresh proposal, let the policy code approve or reject it, and store the decision, evaluation and receipt as a public record with stable links."}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="ws-run-form">
        <OptionGroup
          legend="Scenario"
          name="scenario"
          value={scenario}
          options={decisionScenarios}
          onChange={(value) => setScenario(value as DecisionScenario)}
          disabled={pending}
          testId="decision-run-scenario"
        />
        {persisted ? null : (
          <OptionGroup
            legend="Asset universe"
            name="universe"
            value={universe}
            options={decisionUniverses}
            onChange={(value) => setUniverse(value as DecisionUniverseSource)}
            disabled={pending}
            testId="decision-run-universe"
          />
        )}

        <div className="ws-run-commit">
          <div className="ws-disclosure-note" role="note" data-testid="text-simulation-disclosure">
            <FlaskConical aria-hidden="true" size={16} />
            <p>
              <strong>Simulation only.</strong> Demo mode never submits an onchain
              transaction. No transaction is built, signed or sent, and no wallet is asked to
              approve anything.
            </p>
            <WorkspaceHint topic="simulation" label="About simulation" align="end" />
          </div>
          <button
            className="primary-button"
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            data-testid="button-run-decision"
          >
            {pending ? "Generating decision…" : persisted ? "Generate decision" : "Run decision"}
          </button>
        </div>
      </form>

      {error ? (
        <ErrorState
          title="The decision was not generated"
          error={error}
          retry={() => void execute()}
          testId="decision-run-error"
        />
      ) : null}

      <div ref={resultRef} tabIndex={-1} className="ws-run-result" aria-live="polite">
        {pending ? (
          <div className="ws-record-skeleton">
            <SkeletonRows rows={4} label="Generating decision record" />
          </div>
        ) : run ? (
          <DecisionRunResultView run={run} />
        ) : null}
      </div>
    </section>
  );
}
