import { describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import {
  prepareAgentCreation,
  type CreatePersistentAgentInput,
} from "../lib/services/agents";

function validInput(): CreatePersistentAgentInput {
  return {
    slug: "income-sentinel",
    name: "Income Sentinel",
    ownerWallet: "11111111111111111111111111111111",
    mode: "demo",
    cluster: "devnet",
    strategy: structuredClone(demoAgentBundle.strategy.document),
    riskPolicy: structuredClone(demoAgentBundle.riskPolicy.document),
    assets: structuredClone([...demoAgentBundle.assets]),
  };
}

describe("agent creation service", () => {
  it("prepares stable hashes for versioned documents", () => {
    const first = prepareAgentCreation(validInput());
    const reordered = validInput();
    reordered.strategy = {
      ...reordered.strategy,
      objective: reordered.strategy.objective,
    };
    const second = prepareAgentCreation(reordered);

    expect(first.strategyHash).toBe(second.strategyHash);
    expect(first.riskPolicyHash).toBe(second.riskPolicyHash);
    expect(first.strategyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a universe that is not fully backed by persisted assets", () => {
    const input = validInput();
    input.assets = input.assets.slice(1);

    expect(() => prepareAgentCreation(input)).toThrow(
      "Strategy universe contains an asset absent from the bundle",
    );
  });

  it("rejects a policy allowlist that differs from the strategy universe", () => {
    const input = validInput();
    const allowlist = input.riskPolicy.constraints.find(
      (constraint) => constraint.type === "allowed_mints",
    );
    if (allowlist?.type === "allowed_mints") allowlist.mints.pop();

    expect(() => prepareAgentCreation(input)).toThrow(
      "Strategy universe and risk-policy allowlist must match exactly",
    );
  });

  it("prevents demo identifiers from entering an onchain agent", () => {
    const input = validInput();
    input.mode = "devnet";

    expect(() => prepareAgentCreation(input)).toThrow(
      "Onchain agents cannot use demo asset identifiers",
    );
  });
});
