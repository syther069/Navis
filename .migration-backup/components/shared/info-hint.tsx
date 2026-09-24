"use client";

import { Info, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";

import { infoHintContent, type InfoHintKey } from "./info-hint-content";

/**
 * Accessible disclosure for an unfamiliar action. A real button toggles an
 * in-DOM panel that answers what / why / next. Opens on click, tap or
 * keyboard; closes on Escape, outside click or the close control. Never
 * hover-only, and never the only place the information lives.
 */
export function InfoHint({
  topic,
  label,
  align = "start",
  inline = false,
}: {
  topic: InfoHintKey;
  /** Accessible name for the trigger, e.g. "About running a decision". */
  label?: string;
  /** Float the panel from the end edge of its anchor instead of the start. */
  align?: "start" | "end";
  /** Render the panel in flow (below the trigger) instead of floating. */
  inline?: boolean;
}) {
  const entry = infoHintContent[topic];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="info-hint"
      data-inline={inline || undefined}
      data-topic={topic}
    >
      <button
        ref={triggerRef}
        className="info-hint-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label ?? `About ${entry.title.toLowerCase()}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Info aria-hidden="true" size={16} />
      </button>
      <div
        id={panelId}
        className="info-hint-panel"
        role="region"
        aria-label={entry.title}
        data-align={align}
        hidden={!open}
      >
        <div className="info-hint-panel-heading">
          <span>{entry.title}</span>
          <button
            type="button"
            aria-label={`Close ${entry.title.toLowerCase()} help`}
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
        <dl>
          <div>
            <dt>What it is</dt>
            <dd>{entry.what}</dd>
          </div>
          <div>
            <dt>Why it matters</dt>
            <dd>{entry.why}</dd>
          </div>
          <div>
            <dt>What happens next</dt>
            <dd>{entry.next}</dd>
          </div>
        </dl>
      </div>
    </span>
  );
}
