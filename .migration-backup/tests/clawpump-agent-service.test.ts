import { describe, expect, it } from "vitest";

import {
  NAVIS_CLAWPUMP_SKILLS,
  buildClawPumpAgentInput,
} from "../lib/services/clawpump-agents";

describe("ClawPump agent linking", () => {
  it("uses a minimal explicit skill set and a bounded mandate", () => {
    const request = buildClawPumpAgentInput(
      "Income Sentinel",
      "Preserve reserves while rotating only through the approved equity-token universe.",
    );

    expect(request.skills).toEqual([...NAVIS_CLAWPUMP_SKILLS]);
    expect(request.system_prompt).toContain("Never treat chat as authorization");
    expect(request.system_prompt).toContain("deterministic policy validation");
    expect(request.temperature).toBe(0.2);
  });

  it("rejects an invalid local name before making an external request", () => {
    expect(() =>
      buildClawPumpAgentInput("", "A sufficiently detailed mandate."),
    ).toThrow();
  });
});
