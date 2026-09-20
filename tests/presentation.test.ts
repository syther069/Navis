import { describe, expect, it } from "vitest";

import {
  formatBaseUnits,
  formatAmount,
  policyStatusLabel,
  truncateIdentifier,
} from "../lib/presentation";

describe("domain presentation", () => {
  it("middle-truncates long identifiers without altering short values", () => {
    expect(truncateIdentifier("1234567890abcdef", 4)).toBe("1234…cdef");
    expect(truncateIdentifier("short", 4)).toBe("short");
  });

  it("formats finite amounts and preserves unknown states", () => {
    expect(formatAmount(1234.567, 2)).toBe("1,234.57");
    expect(formatAmount(null)).toBeNull();
    expect(formatAmount(Number.NaN)).toBeNull();
  });

  it("returns explicit policy labels that do not rely on color", () => {
    expect(policyStatusLabel("pass")).toBe("Passed");
    expect(policyStatusLabel("warn")).toBe("Warning");
    expect(policyStatusLabel("block")).toBe("Blocked");
  });

  it("formats token base units without floating-point arithmetic", () => {
    expect(formatBaseUnits("1000000", 6)).toBe("1");
    expect(formatBaseUnits("1", 6)).toBe("0.000001");
    expect(formatBaseUnits("1234500", 6)).toBe("1.2345");
  });
});
