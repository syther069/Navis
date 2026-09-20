export function truncateIdentifier(value: string, edgeLength = 4) {
  if (value.length <= edgeLength * 2 + 1) return value;
  return `${value.slice(0, edgeLength)}…${value.slice(-edgeLength)}`;
}

export function formatAmount(
  value: number | null,
  maximumFractionDigits = 2,
): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function policyStatusLabel(status: "pass" | "warn" | "block") {
  if (status === "pass") return "Passed";
  if (status === "warn") return "Warning";
  return "Blocked";
}

export function formatBaseUnits(rawAmount: string, decimals: number) {
  if (!/^\d+$/.test(rawAmount) || !Number.isInteger(decimals) || decimals < 0) {
    throw new Error("Base-unit formatting requires an unsigned integer and decimals.");
  }
  if (decimals === 0) return rawAmount;

  const padded = rawAmount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
