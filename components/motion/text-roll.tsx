import type { ReactNode } from "react";

/** Adapted from Skiper 58 TextRoll. Compact, CSS-only. Attribution: docs/ATTRIBUTIONS.md */
export function TextRoll({ children }: { children: ReactNode }) {
  const label = typeof children === "string" ? children : null;
  return (
    <span className="navis-text-roll">
      <span className="navis-text-roll-track">
        <span>{children}</span>
        <span aria-hidden="true">{label ?? children}</span>
      </span>
    </span>
  );
}
