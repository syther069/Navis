import { describe, expect, it } from "vitest";

import { prestocksCatalogueSchema } from "../lib/integrations/prestocks/schemas";

const validAsset = {
  name: "OpenAI PreStock",
  symbol: "OAI.PRE",
  description:
    "PreStocks provide economic exposure only and do not represent ownership rights.",
  image: "https://prestocks.com/openai.png",
  external_url: "https://prestocks.com/products/openai",
  contract_address: "So11111111111111111111111111111111111111112",
  markPrice: 10,
  markValuation: 100_000_000,
  tokenPrice: 12,
  impliedValuation: 120_000_000,
  supply: 10_000_000,
};

describe("PreStocks catalogue client", () => {
  it("preserves provider contract addresses as the mint source of truth", async () => {
    const catalogue = prestocksCatalogueSchema.parse([validAsset]);

    expect(catalogue).toHaveLength(1);
    expect(catalogue[0]?.contract_address).toBe(validAsset.contract_address);
    expect(catalogue[0]?.symbol).toBe("OAI.PRE");
  });

  it("rejects ticker-like values in the contract address field", async () => {
    expect(() =>
      prestocksCatalogueSchema.parse([{ ...validAsset, contract_address: "OAI.PRE" }]),
    ).toThrow("Expected a Solana mint address");
  });

  it("rejects empty catalogues instead of inventing fallback assets", () => {
    expect(() => prestocksCatalogueSchema.parse([])).toThrow();
  });
});
