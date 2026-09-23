import { afterEach, describe, expect, it, vi } from "vitest";

import { getPreStocksCatalogue } from "../lib/integrations/prestocks/client";
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
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fetches without a stale cache and timestamps only a successful response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T10:00:00.000Z"));
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-09-23T10:00:01.000Z"));
      return new Response(JSON.stringify([validAsset]));
    });

    const result = await getPreStocksCatalogue(fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("next");
    expect(timeout).toHaveBeenCalledWith(5_000);
    expect(result.capturedAt).toBe("2026-09-23T10:00:01.000Z");
    expect(result.assets).toEqual([validAsset]);
  });

  it("surfaces an aborted fetch instead of returning an old catalogue", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(options.signal?.reason),
          );
        }),
    );
    const result = getPreStocksCatalogue(fetcher);
    const assertion = expect(result).rejects.toThrow("Timed out");
    controller.abort(new DOMException("Timed out", "TimeoutError"));
    await assertion;
  });

  it("surfaces upstream HTTP and schema failures without manufacturing freshness", async () => {
    await expect(
      getPreStocksCatalogue(
        vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 503 })),
      ),
    ).rejects.toThrow("HTTP 503");
    await expect(
      getPreStocksCatalogue(
        vi.fn<typeof fetch>().mockResolvedValue(new Response("[]")),
      ),
    ).rejects.toThrow();
  });

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
