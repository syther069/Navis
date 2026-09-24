import { createHash } from "node:crypto";

function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Canonical documents cannot contain non-finite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  throw new Error(`Unsupported canonical value type: ${typeof value}`);
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(normalize(value));
}

export function hashCanonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
