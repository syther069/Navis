"use client";

import { useMemo } from "react";

type NumberFlowProps = {
  value: number;
  format?: "decimal" | "currency" | "percent";
  currency?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
};

/**
 * Digit-stable number display. Animates only when the real value changes.
 * Does not invent progress or P&L.
 */
export function NumberFlow({
  value,
  format = "decimal",
  currency = "USD",
  decimals = 2,
  prefix,
  suffix,
}: NumberFlowProps) {
  const formatted = useMemo(() => {
    if (!Number.isFinite(value)) return "—";
    if (format === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    }
    if (format === "percent") {
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    }
    return `${prefix ?? ""}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)}${suffix ?? ""}`;
  }, [value, format, currency, decimals, prefix, suffix]);

  return (
    <span className="navis-number-flow" aria-label={formatted}>
      {formatted}
    </span>
  );
}
