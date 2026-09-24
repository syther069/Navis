import type {
  Agent,
  Asset,
  RiskPolicyDocument,
  RiskPolicyVersion,
  StrategyDocument,
  StrategyVersion,
} from "../../domain";

export type AgentBundle = Readonly<{
  agent: Agent;
  strategy: StrategyVersion;
  riskPolicy: RiskPolicyVersion;
  assets: readonly Asset[];
}>;

export type CreateAgentBundleInput = Readonly<{
  slug: string;
  name: string;
  mode: Agent["mode"];
  cluster: Agent["cluster"];
  ownerWallet?: string;
  strategy: StrategyDocument;
  riskPolicy: RiskPolicyDocument;
  assets: readonly Asset[];
}>;

export interface NavisRepository {
  listAgents(): Promise<readonly Agent[]>;
  getAgentBundle(slug: string): Promise<AgentBundle | null>;
  createAgentBundle(input: CreateAgentBundleInput): Promise<AgentBundle>;
}
