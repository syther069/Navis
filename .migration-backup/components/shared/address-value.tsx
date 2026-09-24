"use client";

import { Check, CopySimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { truncateIdentifier } from "../../lib/presentation";

export function AddressValue({
  value,
  label = "address",
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
    <span className="address-value">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {renderedValue}
        </a>
      ) : (
        renderedValue
      )}
      <button type="button" onClick={copyValue} aria-label={`Copy ${label}`}>
        {copyState === "copied" ? (
          <Check aria-hidden="true" size={15} />
        ) : (
          <CopySimple aria-hidden="true" size={15} />
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
