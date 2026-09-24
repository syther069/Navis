export function parseUnsignedInteger(value: string, label = "amount") {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be an unsigned integer`);
  return BigInt(value);
}

export function ratioBps(
  numerator: bigint,
  denominator: bigint,
  rounding: "floor" | "ceil" = "floor",
) {
  if (numerator < BigInt(0) || denominator <= BigInt(0)) {
    throw new Error(
      "Basis-point ratios require non-negative values and a positive total",
    );
  }
  const scaled = numerator * BigInt(10_000);
  const quotient = scaled / denominator;
  const remainder = scaled % denominator;
  return rounding === "ceil" && remainder > BigInt(0) ? quotient + BigInt(1) : quotient;
}

export function secondsBetween(earlier: string, later: string) {
  const delta = Date.parse(later) - Date.parse(earlier);
  if (!Number.isFinite(delta))
    throw new Error("Timestamps must be valid ISO datetimes");
  return Math.floor(delta / 1_000);
}
