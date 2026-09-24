import { demoAgentBundle } from "../../../fixtures/demo-agent";
import { InMemoryNavisRepository } from "./memory";

export function createDemoRepository() {
  return new InMemoryNavisRepository([demoAgentBundle]);
}
