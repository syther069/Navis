import { z } from "zod";

import {
  entityIdSchema,
  executionModeSchema,
  solanaClusterSchema,
  solanaPublicKeySchema,
  timestampSchema,
  versionSchema,
} from "./common";

export const agentStatusSchema = z.enum(["draft", "active", "paused", "error"]);
export const integrationStatusSchema = z.enum([
  "not_configured",
  "pending",
  "linked",
  "failed",
]);

export const agentSchema = z
  .object({
    id: entityIdSchema,
    slug: z
      .string()
      .min(2)
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(2).max(60),
    status: agentStatusSchema,
    mode: executionModeSchema,
    cluster: solanaClusterSchema,
    ownerWallet: solanaPublicKeySchema.optional(),
    activeStrategyVersion: versionSchema.optional(),
    activeRiskPolicyVersion: versionSchema.optional(),
    integrationStatus: integrationStatusSchema,
    externalAgentId: z.string().trim().min(1).max(160).optional(),
    externalWallet: solanaPublicKeySchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((agent, context) => {
    if (agent.mode === "devnet" && agent.cluster !== "devnet") {
      context.addIssue({
        code: "custom",
        message: "Devnet mode requires devnet cluster",
        path: ["cluster"],
      });
    }
    if (agent.mode === "mainnet" && agent.cluster !== "mainnet-beta") {
      context.addIssue({
        code: "custom",
        message: "Mainnet mode requires mainnet-beta cluster",
        path: ["cluster"],
      });
    }
    if (
      agent.integrationStatus === "linked" &&
      (!agent.externalAgentId || !agent.externalWallet)
    ) {
      context.addIssue({
        code: "custom",
        message: "Linked agents require a real external agent ID and wallet",
        path: ["integrationStatus"],
      });
    }
    if (
      agent.status === "active" &&
      (!agent.activeStrategyVersion || !agent.activeRiskPolicyVersion)
    ) {
      context.addIssue({
        code: "custom",
        message: "Active agents require strategy and policy versions",
        path: ["status"],
      });
    }
  });

export type Agent = z.infer<typeof agentSchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;
