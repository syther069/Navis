/**
 * Shared prop types for the workspace surfaces. Every value here comes from
 * `GET /api/workspace?path=...` (see .local/navis-page-contract.md) or from the
 * existing `/api/decisions/run` response. Nothing in this folder reads
 * fixtures for the main surfaces.
 */
import type { PublicCapabilities } from "@workspace/navis-core/lib/env-core";
import type { StoredDecisionSummary } from "@workspace/navis-core/lib/services/decision-records";
import type { DecisionRunResult } from "@workspace/navis-core/lib/services/run-decision";

export type { PublicCapabilities, StoredDecisionSummary, DecisionRunResult };

/** Presentation-only extension for the existing bundled example, not an API run. */
export type PreparedExampleRecord = Omit<DecisionRunResult, "modelMetadata" | "persisted"> & {
  modelMetadata: {
    provider: "Static fixture";
    model: "No model invocation recorded";
    requestId: null;
    generatedAt: null;
    fallback?: undefined;
  };
  persisted: {
    store: "static_fixture";
    note: string;
  };
};
export type DecisionRecordInput = DecisionRunResult | PreparedExampleRecord;

/** Minimal verified session shape. `null` means no authenticated wallet. */
export type WorkspaceSession = Readonly<{ wallet: string }> | null;

/**
 * A value the page wrapper is loading. `retry` is optional; when present the
 * error state renders a retry control wired to it.
 */
export type Loadable<T> =
  | Readonly<{ state: "loading" }>
  | Readonly<{ state: "error"; error: string; retry?: () => void }>
  | Readonly<{ state: "ready"; data: T }>;
