import { describe, expect, it } from "vitest";

import type { TreasuryBalanceRead } from "../lib/integrations/solana/treasury";
import { preparePortfolioSnapshot } from "../lib/services/treasury";

const mint = "So11111111111111111111111111111111111111112";

function balanceRead(): TreasuryBalanceRead {
  return {
    owner: "11111111111111111111111111111111",
    cluster: "devnet",
    commitment: "finalized",
    source: "solana_rpc",
    capturedAt: "2026-09-17T00:00:00.000Z",
    balances: [
      {
        kind: "native",
        rawAmount: "2000000000",
        decimals: 9,
        slot: BigInt(902),
      },
      {
        kind: "spl-token",
        mint,
        tokenAccount: "SysvarRent111111111111111111111111111111111",
        rawAmount: "42000000",
        decimals: 6,
        slot: BigInt(903),
        program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      },
    ],
  };
}

describe("treasury snapshot service", () => {
  it("creates a stable, slot-bound content hash", () => {
    const input = {
      agentId: "11111111-1111-4111-8111-111111111111",
      custodyType: "watch_only" as const,
      balanceRead: balanceRead(),
      valuations: [
        {
          status: "priced" as const,
          mint,
          valueUsdMicros: "12340000",
          source: "fixture",
          observedAt: "2026-09-17T00:00:00.000Z",
        },
      ],
    };

    const first = preparePortfolioSnapshot(input);
    const second = preparePortfolioSnapshot(input);

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.document.slot).toBe("903");
    expect(first.document.balances[0]?.slot).toBe("902");
  });

  it("rejects valuations for balances that were not observed", () => {
    expect(() =>
      preparePortfolioSnapshot({
        agentId: "11111111-1111-4111-8111-111111111111",
        custodyType: "watch_only",
        balanceRead: balanceRead(),
        valuations: [
          {
            status: "unpriced",
            mint: "Vote111111111111111111111111111111111111111",
            reason: "No trusted quote is available.",
          },
        ],
      }),
    ).toThrow("was not observed");
  });
});
