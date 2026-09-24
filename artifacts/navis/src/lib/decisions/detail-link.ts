import type { DecisionRunResult } from "@workspace/navis-core/lib/services/run-decision";

export type DecisionDetailAccess = Readonly<{
  /** Whether a link to `/decisions/<id>` can be offered without risk of failing. */
  linkable: boolean;
  note: string;
}>;

/**
 * Decides whether a fresh run may be linked to its own detail page.
 *
 * Runs kept only in server memory live in one serverless instance; a follow-up
 * request may land elsewhere and fail. Those runs are shown inline only.
 */
export function describeDecisionDetailAccess(
  persisted: DecisionRunResult["persisted"],
): DecisionDetailAccess {
  if (persisted.store === "memory") {
    return {
      linkable: false,
      note: "This is the complete decision record. Demo runs without a database are not stored, so there is no separate page to open; run again to produce a fresh one.",
    };
  }
  if (persisted.visibility === "public") {
    return {
      linkable: true,
      note: "Stored as a public Atlas record; the decision and proof pages reload it from the database in any browser, with no wallet.",
    };
  }
  return {
    linkable: true,
    note: "Stored for the connected wallet; the detail page reloads it from the database.",
  };
}
