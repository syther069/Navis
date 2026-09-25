"use client";

import { Check, CopySimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { truncateIdentifier } from "@/lib/presentation";

/**
 * Phosphor copy-hash control. Navis original; not Skiper 42.
 */
export function CopyHash({
  value,
  label = "value",
  href,
}: {
  value: string | null;
  label?: string;
  href?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  if (!value) {
    return <span className="address-value address-value-empty">Not available</span>;
  }

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value as string);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const renderedValue = (
    <code title={value} aria-label={`${label}: ${value}`}>
      {truncateIdentifier(value, 6)}
    </code>
  );

  return (
    <span className="address-value navis-copy-hash">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {renderedValue}
        </a>
      ) : (
        renderedValue
      )}
      <button
        type="button"
        className="navis-copy-hash-button"
        onClick={copyValue}
        aria-label={copyState === "copied" ? `${label} copied` : `Copy ${label}`}
        data-state={copyState}
      >
        {copyState === "copied" ? (
          <Check aria-hidden="true" size={15} weight="bold" />
        ) : (
          <CopySimple aria-hidden="true" size={15} weight="regular" />
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copyState === "copied"
          ? `${label} copied`
          : copyState === "failed"
            ? `Could not copy ${label}`
            : ""}
      </span>
    </span>
  );
}
