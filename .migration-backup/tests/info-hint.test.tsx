// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InfoHint } from "../components/shared/info-hint";
import { infoHintContent } from "../components/shared/info-hint-content";

afterEach(cleanup);

describe("contextual action help", () => {
  it("exposes what, why and next with a labelled disclosure", () => {
    render(<InfoHint topic="runDecision" />);
    const trigger = screen.getByRole("button", { name: "About running a decision" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region")).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", { name: "Running a decision" });
    expect(panel.id).toBe(trigger.getAttribute("aria-controls"));
    for (const heading of ["What it is", "Why it matters", "What happens next"]) {
      expect(panel.textContent).toContain(heading);
    }
  });

  it("dismisses on Escape and restores trigger focus", () => {
    render(<InfoHint topic="verifyReceipt" />);
    const trigger = screen.getByRole("button", { name: "About verifying a receipt" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("dismisses with the close control and outside pointer input", () => {
    render(<InfoHint topic="assurance" />);
    const trigger = screen.getByRole("button", { name: "About assurance level" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close assurance level help" }));
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole("region")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("keeps receipt verification limits explicit", () => {
    expect(infoHintContent.verifyReceipt.next).toContain(
      "policy input hash cannot be independently recomputed",
    );
    expect(infoHintContent.proofReceipt.why).toContain(
      "not independent proof of authorship",
    );
  });
});
