import { z } from "zod";

import {
  assetIdentifierSchema,
  entityIdSchema,
  sha256Schema,
  timestampSchema,
  versionSchema,
} from "./common";

export const strategyActionSchema = z.enum(["BUY", "SELL", "HOLD", "REBALANCE"]);

export const decisionCadenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }),
  z.object({
    kind: z.literal("interval"),
    seconds: z.number().int().min(300).max(604_800),
  }),
]);

export const strategyDocumentSchema = z
  .object({
    objective: z.string().trim().min(20).max(600),
    horizon: z.enum(["intraday", "weekly", "monthly", "long_term"]),
    cadence: decisionCadenceSchema,
    universe: z.array(assetIdentifierSchema).min(1).max(32),
    signals: z.array(z.string().trim().min(3).max(160)).max(12),
    allowedActions: z.array(strategyActionSchema).min(1),
    riskPolicyVersion: versionSchema,
  })
  .superRefine((value, context) => {
    if (new Set(value.universe).size !== value.universe.length) {
      context.addIssue({
        code: "custom",
        message: "Strategy universe mints must be unique",
        path: ["universe"],
      });
    }
    if (new Set(value.allowedActions).size !== value.allowedActions.length) {
      context.addIssue({
        code: "custom",
        message: "Allowed actions must be unique",
        path: ["allowedActions"],
      });
    }
  });

export const strategyVersionSchema = z.object({
  id: entityIdSchema,
  agentId: entityIdSchema,
  version: versionSchema,
  document: strategyDocumentSchema,
  hash: sha256Schema,
  createdAt: timestampSchema,
});

export type StrategyAction = z.infer<typeof strategyActionSchema>;
export type StrategyDocument = z.infer<typeof strategyDocumentSchema>;
export type StrategyVersion = z.infer<typeof strategyVersionSchema>;
