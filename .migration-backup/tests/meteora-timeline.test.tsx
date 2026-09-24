import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MeteoraTimeline,
  type MeteoraTimelineStep,
} from "../components/markets/meteora-timeline";

const steps: MeteoraTimelineStep[] = [
  { key: "wallet", label: "Wallet connected", state: "done" },
  { key: "configuration", label: "Configuration validated", state: "done" },
  { key: "prepared", label: "Transaction prepared", state: "done" },
  { key: "approval", label: "Awaiting wallet approval", state: "current" },
  { key: "signed", label: "Transaction signed", state: "pending" },
  { key: "simulation", label: "Simulation passed", state: "pending" },
  { key: "submission", label: "Submission", state: "pending" },
  { key: "confirmation", label: "Confirmation", state: "pending" },
  { key: "verification", label: "Onchain verification", state: "pending" },
];

describe("MeteoraTimeline", () => {
  it("renders every step label in order", () => {
    const html = renderToStaticMarkup(<MeteoraTimeline steps={steps} />);
    const labels = [...html.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(labels).toEqual(steps.map((step) => step.label));
  });

  it("marks each step with its state for styling and tests", () => {
    const html = renderToStaticMarkup(<MeteoraTimeline steps={steps} />);
    expect(html).toContain('data-state="done"');
    expect(html).toContain('data-state="current"');
    expect(html).toContain('data-state="pending"');
    // Three done, one current, five pending in this fixture.
    expect(html.match(/data-state="done"/g)).toHaveLength(3);
    expect(html.match(/data-state="pending"/g)).toHaveLength(5);
  });

  it("renders a failed simulation state distinctly", () => {
    const failed = steps.map((step) =>
      step.key === "simulation" ? { ...step, state: "failed" as const } : step,
    );
    const html = renderToStaticMarkup(<MeteoraTimeline steps={failed} />);
    expect(html).toContain('data-state="failed"');
  });
});
