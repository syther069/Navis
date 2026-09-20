import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "../app/(workspace)/page";
import { LANDING_PROOF_POINTS, LANDING_SENTENCE } from "../lib/landing-copy";

describe("landing page", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("shows the one-sentence pitch and the three proof points", () => {
    expect(html).toContain(LANDING_SENTENCE);
    for (const point of LANDING_PROOF_POINTS) {
      expect(html).toContain(point.title);
    }
    expect(LANDING_PROOF_POINTS).toHaveLength(3);
  });

  it("carries the mode and cluster banner and the three assurance levels", () => {
    expect(html).toContain('data-testid="landing-mode-banner"');
    expect(html).toMatch(/class="mode-stamp" data-mode="(demo|devnet|mainnet)"/);
    expect(html).toContain('class="cluster-stamp"');
    expect(html).toContain("Offchain integrity");
    expect(html).toContain("Wallet authorization");
    expect(html).toContain("Onchain settlement");
  });

  it("links to the Atlas demo, agent creation and Markets Launch", () => {
    expect(html).toContain('href="/agents/atlas"');
    expect(html).toContain('href="/agents/new"');
    expect(html).toContain('href="/markets/launch"');
    expect(html).toContain('href="/proofs/demo-proof"');
  });

  it("uses plain punctuation in the pitch copy", () => {
    expect(LANDING_SENTENCE).not.toMatch(/—/);
    for (const point of LANDING_PROOF_POINTS) {
      expect(point.body).not.toMatch(/—/);
    }
  });
});
