"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useEffect } from "react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="empty-state error-state">
      <div className="empty-state-icon">
        <WarningCircle aria-hidden="true" size={24} />
      </div>
      <span className="route-eyebrow">Route interrupted</span>
      <h1>Workspace data could not be rendered.</h1>
      <p>
        No transaction was submitted. Retry this route, or return to the agent overview.
      </p>
      <button className="secondary-button" type="button" onClick={reset}>
        Retry route
      </button>
    </section>
  );
}
