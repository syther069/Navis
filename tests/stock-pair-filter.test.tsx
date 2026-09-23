// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StockPairFilter } from "../components/markets/stock-pair-filter";

const PAIRS = [
  { mint: "mint-nvda", symbol: "NVDAx", name: "NVIDIA xStock" },
  { mint: "mint-tsla", symbol: "TSLAx", name: "Tesla xStock" },
  { mint: "mint-aapl", symbol: "AAPLx", name: "Apple xStock" },
] as const;

function renderGroup() {
  return render(
    <StockPairFilter pairs={PAIRS}>
      {PAIRS.map((pair) => (
        <div key={pair.mint} data-pair-mint={pair.mint} className="pair-card-slot">
          <article data-testid={`card-${pair.mint}`}>{pair.name}</article>
        </div>
      ))}
    </StockPairFilter>,
  );
}

function slot(container: HTMLElement, mint: string) {
  const element = container.querySelector(`[data-pair-mint="${mint}"]`);
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

describe("stock pair ticker filter", () => {
  afterEach(cleanup);

  it("shows every stock pair with the full count when the filter is empty", () => {
    const { container } = renderGroup();
    expect(screen.getByText("Tokenized stocks (3)")).toBeTruthy();
    for (const pair of PAIRS) expect(slot(container, pair.mint).hidden).toBe(false);
  });

  it("filters by ticker and updates the group count", () => {
    const { container } = renderGroup();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nvda" } });

    expect(screen.getByText("Tokenized stocks (1)")).toBeTruthy();
    expect(slot(container, "mint-nvda").hidden).toBe(false);
    expect(slot(container, "mint-tsla").hidden).toBe(true);
    expect(slot(container, "mint-aapl").hidden).toBe(true);
  });

  it("matches the on-chain name case-insensitively", () => {
    const { container } = renderGroup();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "TESLA" } });

    expect(screen.getByText("Tokenized stocks (1)")).toBeTruthy();
    expect(slot(container, "mint-tsla").hidden).toBe(false);
    expect(slot(container, "mint-nvda").hidden).toBe(true);
  });

  it("reports an empty result while keeping the cards in the document", () => {
    const { container } = renderGroup();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz" } });

    expect(screen.getByText("Tokenized stocks (0)")).toBeTruthy();
    expect(screen.getByText('No tokenized stocks match "zzzz".')).toBeTruthy();
    for (const pair of PAIRS) expect(slot(container, pair.mint).hidden).toBe(true);
  });

  it("restores every pair when the filter is cleared", () => {
    const { container } = renderGroup();
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "tesla" } });
    fireEvent.change(input, { target: { value: "" } });

    expect(screen.getByText("Tokenized stocks (3)")).toBeTruthy();
    for (const pair of PAIRS) expect(slot(container, pair.mint).hidden).toBe(false);
  });
});
