import { randomUUID } from "node:crypto";

import {
  agentSchema,
  assetSchema,
  riskPolicyDocumentSchema,
  riskPolicyVersionSchema,
  strategyDocumentSchema,
  strategyVersionSchema,
} from "../../domain";
import { hashCanonical } from "../../proofs/canonical";
import type { AgentBundle, CreateAgentBundleInput, NavisRepository } from "./types";

const clone = <T>(value: T): T => structuredClone(value);

function generatedId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export class InMemoryNavisRepository implements NavisRepository {
  private readonly bundles = new Map<string, AgentBundle>();

  constructor(seedBundles: readonly AgentBundle[] = []) {
    for (const bundle of seedBundles)
      this.bundles.set(bundle.agent.slug, clone(bundle));
  }

  async listAgents() {
    return [...this.bundles.values()].map((bundle) => clone(bundle.agent));
  }

  async getAgentBundle(slug: string) {
    const bundle = this.bundles.get(slug);
    return bundle ? clone(bundle) : null;
  }

  async createAgentBundle(input: CreateAgentBundleInput) {
    if (this.bundles.has(input.slug))
      throw new Error(`Agent slug already exists: ${input.slug}`);

    const strategyDocument = strategyDocumentSchema.parse(input.strategy);
    const riskPolicyDocument = riskPolicyDocumentSchema.parse(input.riskPolicy);
    const assets = input.assets.map((asset) => assetSchema.parse(asset));
    const assetMints = new Set(assets.map((asset) => asset.mint));
    if (strategyDocument.universe.some((mint) => !assetMints.has(mint))) {
      throw new Error("Strategy universe contains an asset absent from the bundle");
    }
    const allowedMints = riskPolicyDocument.constraints.find(
      (constraint) => constraint.type === "allowed_mints",
    );
    if (
      !allowedMints ||
      allowedMints.mints.length !== strategyDocument.universe.length ||
      allowedMints.mints.some((mint) => !strategyDocument.universe.includes(mint))
    ) {
      throw new Error("Strategy universe and risk-policy allowlist must match exactly");
    }

    const now = new Date().toISOString();
    const agentId = generatedId(input.mode === "demo" ? "demo_agent" : "agent");
    const agent = agentSchema.parse({
      id: agentId,
      slug: input.slug,
      name: input.name,
      status: "active",
      mode: input.mode,
      cluster: input.cluster,
      ownerWallet: input.ownerWallet,
      activeStrategyVersion: 1,
      activeRiskPolicyVersion: 1,
      integrationStatus: "not_configured",
      createdAt: now,
      updatedAt: now,
    });
    const strategy = strategyVersionSchema.parse({
      id: generatedId(input.mode === "demo" ? "demo_strategy" : "strategy"),
      agentId,
      version: 1,
      document: strategyDocument,
      hash: hashCanonical(strategyDocument),
      createdAt: now,
    });
    const riskPolicy = riskPolicyVersionSchema.parse({
      id: generatedId(input.mode === "demo" ? "demo_policy" : "policy"),
      agentId,
      version: 1,
      document: riskPolicyDocument,
      hash: hashCanonical(riskPolicyDocument),
      createdAt: now,
    });

    const bundle = Object.freeze({ agent, strategy, riskPolicy, assets });
    this.bundles.set(input.slug, clone(bundle));
    return clone(bundle);
  }
}
