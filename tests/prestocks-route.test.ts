import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/prestocks/client", () => ({
  getPreStocksCatalogue: vi.fn(),
}));

const { getPreStocksCatalogue } = await import("@/lib/integrations/prestocks/client");
const { GET } = await import("../app/api/assets/prestocks/route");

const mockedGetPreStocksCatalogue = vi.mocked(getPreStocksCatalogue);

describe("PreStocks asset API route", () => {
  it("returns a read-only catalogue with required disclosures", async () => {
    mockedGetPreStocksCatalogue.mockResolvedValueOnce({
      assets: [
        {
          name: "OpenAI PreStock",
          symbol: "OAI.PRE",
          description: "Economic exposure only.",
          image: "https://prestocks.com/openai.png",
          external_url: "https://prestocks.com/products/openai",
          contract_address: "So11111111111111111111111111111111111111112",
          markPrice: 10,
          markValuation: 100_000_000,
          tokenPrice: 12,
          impliedValuation: 120_000_000,
          supply: 10_000_000,
        },
      ],
      sourceUrl: "https://prestocks.com/api/prestocks",
      capturedAt: "2026-09-20T00:00:00.000Z",
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      status: "available",
      actions: {
        readOnly: true,
        valueMovementAvailable: false,
      },
    });
    expect(body.catalogue.assets[0].contract_address).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect(body.disclosures.join(" ")).toContain("not legal shares");
    expect(body.disclosures.join(" ")).toContain("does not provide PreStocks buy");
  });

  it("returns a safe unavailable response without exposing provider details", async () => {
    mockedGetPreStocksCatalogue.mockRejectedValueOnce(
      new Error("provider exploded with a private upstream trace"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "unavailable",
      error: "PreStocks catalogue is temporarily unavailable.",
      actions: {
        readOnly: true,
        valueMovementAvailable: false,
      },
    });
    expect(JSON.stringify(body)).not.toContain("private upstream trace");
  });
});
