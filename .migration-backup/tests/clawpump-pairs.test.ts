import { describe, expect, it, vi } from "vitest";

import {
  buildPairCatalogueView,
  classifyPair,
  matchTokenizedStockIssuer,
  indexPreStocksMints,
  readTokenPrograms,
  WRAPPED_SOL_MINT,
} from "../lib/integrations/clawpump/pairs";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const STOCK_MINT = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
const UNKNOWN_MINT = "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs";
const XSTOCK_MINT = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh";
const XSTOCK_METADATA = {
  name: "NVIDIA xStock",
  symbol: "NVDAx",
  uri: "https://xstocks-metadata.backed.fi/tokens/Solana/NVDAx/metadata.json",
  updateAuthority: "5aMNNLQJwAEeoemTEMkv5NVjqKwvvefRYCQ5Z67HFvEq",
};
const meta = { timestamp: "2026-09-21T10:00:00.000Z", requestId: "req-pairs" };

function pairs(
  assets: { mint: string; symbol: string; name: string; decimals: number }[],
) {
  return {
    assets: assets.map((asset) => ({ ...asset, imageUrl: null })),
    creatorFeeBps: { min: 100, max: 300, default: 200 },
    meta,
  };
}

describe("ClawPump pair catalogue classification", () => {
  const prestocks = indexPreStocksMints([
    { contract_address: STOCK_MINT, symbol: "TSLAx", name: "Tesla pre-stock" },
  ]);

  it("never classifies wrapped SOL or a stablecoin as a stock pair", () => {
    expect(
      classifyPair({ mint: WRAPPED_SOL_MINT, symbol: "SOL" }, prestocks).classification,
    ).toBe("wrapped_sol");
    expect(classifyPair({ mint: USDC, symbol: "USDC" }, prestocks).classification).toBe(
      "stablecoin",
    );
    // A misleading symbol does not promote a mint the PreStocks catalogue does not list.
    expect(
      classifyPair({ mint: UNKNOWN_MINT, symbol: "AAPLx" }, prestocks).classification,
    ).toBe("unclassified");
    expect(
      classifyPair({ mint: STOCK_MINT, symbol: "TSLAx" }, prestocks),
    ).toMatchObject({
      classification: "tokenized_stock",
    });
  });

  it("classifies a tokenized stock from on-chain issuer metadata only when host and authority both match", () => {
    expect(matchTokenizedStockIssuer(XSTOCK_METADATA)).toBe("Backed xStocks");
    expect(
      matchTokenizedStockIssuer({ ...XSTOCK_METADATA, updateAuthority: UNKNOWN_MINT }),
    ).toBeNull();
    expect(
      matchTokenizedStockIssuer({
        ...XSTOCK_METADATA,
        uri: "https://evil.example/x.json",
      }),
    ).toBeNull();
    expect(
      matchTokenizedStockIssuer({
        name: "Tesla xStock",
        symbol: "TSLAx",
        uri: null,
        updateAuthority: null,
      }),
    ).toBeNull();

    const verified = {
      status: "verified" as const,
      program: "spl-token-2022" as const,
      decimals: 8,
      slot: 1,
      metadata: XSTOCK_METADATA,
    };
    expect(
      classifyPair({ mint: XSTOCK_MINT, symbol: "NVDA" }, prestocks, verified),
    ).toMatchObject({
      classification: "tokenized_stock",
    });
    // Unverified reads never classify, whatever the symbol says.
    expect(
      classifyPair({ mint: XSTOCK_MINT, symbol: "NVDA" }, prestocks, {
        status: "unverified",
        reason: "x",
      }).classification,
    ).toBe("unclassified");
  });

  it("annotates cluster, token program and PreStocks match and keeps the empty stock state honest", () => {
    const tokenPrograms = new Map([
      [
        STOCK_MINT,
        {
          status: "verified" as const,
          program: "spl-token-2022" as const,
          decimals: 8,
          slot: 1,
          metadata: null,
        },
      ],
      [
        WRAPPED_SOL_MINT,
        {
          status: "verified" as const,
          program: "spl-token" as const,
          decimals: 9,
          slot: 1,
          metadata: null,
        },
      ],
    ]);
    const view = buildPairCatalogueView({
      pairs: pairs([
        { mint: WRAPPED_SOL_MINT, symbol: "SOL", name: "Wrapped SOL", decimals: 9 },
        { mint: STOCK_MINT, symbol: "TSLAx", name: "Tesla", decimals: 8 },
        { mint: UNKNOWN_MINT, symbol: "MYSTERY", name: "Unknown quote", decimals: 6 },
      ]),
      prestocks,
      tokenPrograms,
      tokenProgramSource: "test rpc",
    });

    expect(view.venue).toBe("Pump.fun creation pairs (not Meteora pools)");
    expect(view.pairs.every((pair) => pair.cluster === "mainnet-beta")).toBe(true);
    expect(view.pairs.every((pair) => pair.meteoraPool === null)).toBe(true);
    expect(view.stockPairs.map((pair) => pair.mint)).toEqual([STOCK_MINT]);
    const stock = view.pairs.find((pair) => pair.mint === STOCK_MINT)!;
    expect(stock.prestocks).toEqual({ symbol: "TSLAx", name: "Tesla pre-stock" });
    expect(stock.tokenProgram).toMatchObject({ program: "spl-token-2022" });
    expect(stock.eligibleForStockPreflight).toBe(true);
    const unknown = view.pairs.find((pair) => pair.mint === UNKNOWN_MINT)!;
    expect(unknown.tokenProgram.status).toBe("unverified");
    expect(unknown.eligibleForStockPreflight).toBe(false);
    expect(
      view.pairs.find((pair) => pair.mint === WRAPPED_SOL_MINT)
        ?.eligibleForStockPreflight,
    ).toBe(false);

    const solOnly = buildPairCatalogueView({
      pairs: pairs([
        { mint: WRAPPED_SOL_MINT, symbol: "SOL", name: "Wrapped SOL", decimals: 9 },
      ]),
      prestocks,
      tokenPrograms,
      tokenProgramSource: "test rpc",
    });
    expect(solOnly.stockPairs).toEqual([]);
  });

  it("fails closed on token programs when no RPC or a bad read exists", async () => {
    const none = await readTokenPrograms([STOCK_MINT], null);
    expect(none.get(STOCK_MINT)).toMatchObject({ status: "unverified" });

    const failing = { request: vi.fn(async () => ({ garbage: true })) };
    const bad = await readTokenPrograms([STOCK_MINT], failing);
    expect(bad.get(STOCK_MINT)).toMatchObject({ status: "unverified" });

    const good = {
      request: vi.fn(async () => ({
        context: { slot: 42 },
        value: [
          {
            owner: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
            data: {
              program: "spl-token-2022",
              parsed: {
                type: "mint",
                info: {
                  decimals: 8,
                  extensions: [
                    {
                      extension: "metadataPointer",
                      state: { metadataAddress: STOCK_MINT },
                    },
                    { extension: "tokenMetadata", state: XSTOCK_METADATA },
                  ],
                },
              },
            },
          },
        ],
      })),
    };
    const verified = await readTokenPrograms([STOCK_MINT], good);
    expect(verified.get(STOCK_MINT)).toEqual({
      status: "verified",
      program: "spl-token-2022",
      decimals: 8,
      slot: 42,
      metadata: XSTOCK_METADATA,
    });
  });
});
