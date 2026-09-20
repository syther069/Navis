import { describe, expect, it } from "vitest";

import { demoAgentBundle } from "../fixtures/demo-agent";
import { createDemoRepository } from "../lib/db/repositories/demo";
import type { CreateAgentBundleInput } from "../lib/db/repositories/types";
import { canonicalJson, hashCanonical } from "../lib/proofs/canonical";

function validCreateInput(): CreateAgentBundleInput {
  return {
    slug: "second-agent",
    name: "Second agent",
    mode: "demo",
    cluster: "devnet",
    strategy: structuredClone(demoAgentBundle.strategy.document),
    riskPolicy: structuredClone(demoAgentBundle.riskPolicy.document),
    assets: structuredClone(demoAgentBundle.assets),
  };
}

describe("demo repository", () => {
  it("loads one coherent, visibly demo agent bundle", async () => {
    const repository = createDemoRepository();
    const bundle = await repository.getAgentBundle("atlas");

    expect(bundle?.agent.id.startsWith("demo_agent_")).toBe(true);
    expect(bundle?.assets.every((asset) => asset.mint.startsWith("demo_mint_"))).toBe(
      true,
    );
    expect(bundle?.strategy.hash).toBe(hashCanonical(bundle?.strategy.document));
  });

  it("creates all versioned records as one coherent write", async () => {
    const repository = createDemoRepository();
    const created = await repository.createAgentBundle(validCreateInput());

    expect(created.agent.activeStrategyVersion).toBe(created.strategy.version);
    expect(created.agent.activeRiskPolicyVersion).toBe(created.riskPolicy.version);
    expect(await repository.getAgentBundle("second-agent")).toEqual(created);
  });

  it("does not retain partial records after validation failure", async () => {
    const repository = createDemoRepository();
    const input = validCreateInput();
    const maxTrade = input.riskPolicy.constraints.find(
      (constraint) => constraint.type === "max_trade_bps",
    );
    if (maxTrade?.type === "max_trade_bps") maxTrade.value = 9_000;

    await expect(repository.createAgentBundle(input)).rejects.toThrow();
    expect(await repository.getAgentBundle("second-agent")).toBeNull();
    expect(await repository.listAgents()).toHaveLength(1);
  });
});

describe("canonical documents", () => {
  it("hashes semantically identical object key order identically", () => {
    expect(hashCanonical({ b: 2, a: { d: 4, c: 3 } })).toBe(
      hashCanonical({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("changes the hash when versioned content changes", () => {
    expect(hashCanonical({ version: 1 })).not.toBe(hashCanonical({ version: 2 }));
  });
});
