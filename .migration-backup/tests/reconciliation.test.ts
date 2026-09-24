import { describe, expect, it } from "vitest";

import {
  calculateNativeBalanceDeltas,
  calculateTokenBalanceDeltas,
} from "../lib/services/reconciliation";

describe("execution reconciliation evidence", () => {
  it("computes native deltas from RPC base units", () => {
    expect(calculateNativeBalanceDeltas([10_000, 2_000], [9_500, 2_400])).toEqual([
      { accountIndex: 0, deltaLamports: "-500" },
      { accountIndex: 1, deltaLamports: "400" },
    ]);
  });

  it("computes token deltas without floating-point conversion", () => {
    const mint = "So11111111111111111111111111111111111111112";
    const owner = "11111111111111111111111111111111";
    const identity = {
      accountIndex: 2,
      mint,
      owner,
      uiTokenAmount: { decimals: 6, amount: "1000000" },
    };
    expect(
      calculateTokenBalanceDeltas(
        [identity],
        [{ ...identity, uiTokenAmount: { decimals: 6, amount: "1250000" } }],
      ),
    ).toEqual([
      {
        accountIndex: 2,
        mint,
        owner,
        decimals: 6,
        deltaRaw: "250000",
      },
    ]);
  });

  it("rejects inconsistent RPC decimal metadata", () => {
    const identity = {
      accountIndex: 2,
      mint: "So11111111111111111111111111111111111111112",
      uiTokenAmount: { decimals: 6, amount: "1000000" },
    };
    expect(() =>
      calculateTokenBalanceDeltas(
        [identity],
        [{ ...identity, uiTokenAmount: { decimals: 9, amount: "1000000" } }],
      ),
    ).toThrow("decimals changed");
  });
});
