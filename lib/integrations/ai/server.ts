import "server-only";

import { env } from "../../env";
import { DemoDecisionProvider } from "./demo";
import { OpenAiDecisionProvider } from "./openai";

export function createDecisionProvider() {
  if (env.aiProvider === "demo") return new DemoDecisionProvider();
  if (!env.openaiApiKey || !env.openaiModel) {
    throw new Error("OpenAI decision provider is not fully configured");
  }
  return new OpenAiDecisionProvider({
    apiKey: env.openaiApiKey,
    model: env.openaiModel,
  });
}
