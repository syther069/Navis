import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PreStocksResearchView } from "../components/markets/prestocks/prestocks-research";
import { PolicyExplanationPanel } from "../components/shared/policy-explanation-panel";
import { demoProof } from "../fixtures/demo-proof";
import { researchRow } from "../lib/integrations/prestocks/research";

const row = researchRow({
  name: "SpaceX PreStocks",
  symbol: "SPACEX",
  description: "Economic exposure only.",
  image: "https://prestocks.com/spacex.png",
  external_url: "https://prestocks.com/products/spacex",
  contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
  markPrice: 150,
  tokenPrice: 120,
  markValuation: 2_000_000_000_000,
  impliedValuation: 1_600_000_000_000,
  supply: 43_712.53,
});

describe("PreStocks research view", () => {
  it("shows premium or discount, valuation gap, supply, freshness and allocation impact", () => {
    const html = renderToStaticMarkup(
      <PreStocksResearchView
        research={[row]}
        capturedAt="2026-09-20T10:00:00.000Z"
        sourceUrl="https://prestocks.com/api/prestocks"
        portfolioValueUsdMicros="400000000"
        positions={[
          {
            mint: row.mint,
            symbol: "SPACEX",
            role: "rotation target",
            startValueUsdMicros: "35000000",
            valueUsdMicros: "70000000",
            portfolioShareBps: 1_750,
            impliedValuationShareBps: 1,
          },
        ]}
        excluded={[{ symbol: "ZERO", reason: "Mark price is zero." }]}
      />,
    );
    expect(html).toContain("20.00% discount");
    expect(html).toContain("-20.00%");
    expect(html).toContain("2026-09-20T10:00:00.000Z");
    expect(html).toContain("https://prestocks.com/api/prestocks");
    expect(html).toContain("Research data, not execution quotes");
    expect(html).toContain("43,712.53");
    expect(html).toContain("$35.00 to $70.00");
    expect(html).toContain("1750 bps of portfolio");
    expect(html).toContain("Excluded from the universe");
  });

  it("renders the PreStocks fact under the policy check it fed", () => {
    const { approved, checks } = demoProof.document.policyEvaluation;
    const html = renderToStaticMarkup(
      <PolicyExplanationPanel
        approved={approved}
        checks={checks}
        factSources={{
          allowed_mints: "Allowlist is the PreStocks contract_address set.",
        }}
        factSourceLabel="PreStocks fact"
      />,
    );
    expect(html).toContain('data-testid="policy-fact-allowed_mints"');
    expect(html).toContain("PreStocks fact:");
    expect(html).toContain("Allowlist is the PreStocks contract_address set.");
    expect(html).not.toContain('data-testid="policy-fact-max_trade_bps"');
  });
});
