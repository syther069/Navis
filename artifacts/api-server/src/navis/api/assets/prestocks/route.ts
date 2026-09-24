import { NextResponse } from "@workspace/navis-core/server/http";

import { getPreStocksCatalogue } from "@workspace/navis-core/lib/integrations/prestocks/client";

const disclosures = [
  "PreStocks are economic-exposure tokens, not legal shares.",
  "Navis exposes this catalogue read-only and does not provide PreStocks buy, sell, launch, or issuance actions.",
  "Eligibility is not assumed; U.S. persons and other ineligible persons must not use restricted PreStocks products.",
  "capturedAt is Navis's catalogue read time, not a verified quote timestamp. Responses may be cached; upstream price freshness is unknown. These are research prices, not execution quotes.",
] as const;

export async function GET() {
  try {
    const catalogue = await getPreStocksCatalogue();

    return NextResponse.json(
      {
        status: "available",
        catalogue,
        actions: {
          readOnly: true,
          valueMovementAvailable: false,
        },
        disclosures,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        error: "PreStocks catalogue is temporarily unavailable.",
        actions: {
          readOnly: true,
          valueMovementAvailable: false,
        },
        disclosures,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
