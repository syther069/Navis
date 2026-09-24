import { z } from "zod";

import {
  assetIdentifierSchema,
  entityIdSchema,
  executionModeSchema,
  sha256Schema,
  timestampSchema,
  versionSchema,
} from "./common";

const bpsValueSchema = z.number().int().min(0).max(10_000);
const rawUsdMicrosSchema = z.string().regex(/^\d+$/);

export const riskConstraintSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("allowed_mints"),
    mints: z.array(assetIdentifierSchema).min(1).max(32),
  }),
  z.object({ type: z.literal("max_trade_bps"), value: bpsValueSchema.min(1) }),
  z.object({ type: z.literal("max_position_bps"), value: bpsValueSchema.min(1) }),
  z.object({ type: z.literal("min_reserve_bps"), value: bpsValueSchema }),
  z.object({
    type: z.literal("max_slippage_bps"),
    value: bpsValueSchema.min(1).max(2_000),
  }),
  z.object({ type: z.literal("max_daily_turnover_bps"), value: bpsValueSchema.min(1) }),
  z.object({
    type: z.literal("cooldown_seconds"),
    value: z.number().int().min(0).max(2_592_000),
  }),
  z.object({
    type: z.literal("max_data_age_seconds"),
    value: z.number().int().min(10).max(86_400),
  }),
  z.object({
    type: z.literal("min_liquidity_usd_micros"),
    value: rawUsdMicrosSchema,
  }),
  z.object({
    type: z.literal("allowed_modes"),
    modes: z.array(executionModeSchema).min(1).max(3),
  }),
]);

const requiredConstraintTypes = [
  "allowed_mints",
  "max_trade_bps",
  "max_position_bps",
  "min_reserve_bps",
  "max_slippage_bps",
  "max_daily_turnover_bps",
  "cooldown_seconds",
  "max_data_age_seconds",
  "min_liquidity_usd_micros",
  "allowed_modes",
] as const;

export const riskPolicyDocumentSchema = z
  .object({
    constraints: z.array(riskConstraintSchema),
  })
  .superRefine((document, context) => {
    const typeCounts = new Map<string, number>();
    for (const constraint of document.constraints) {
      typeCounts.set(constraint.type, (typeCounts.get(constraint.type) ?? 0) + 1);
      if (
        constraint.type === "allowed_mints" &&
        new Set(constraint.mints).size !== constraint.mints.length
      ) {
        context.addIssue({
          code: "custom",
          message: "Allowed mints must be unique",
          path: ["constraints"],
        });
      }
      if (
        constraint.type === "allowed_modes" &&
        new Set(constraint.modes).size !== constraint.modes.length
      ) {
        context.addIssue({
          code: "custom",
          message: "Allowed execution modes must be unique",
          path: ["constraints"],
        });
      }
    }

    for (const type of requiredConstraintTypes) {
      if (typeCounts.get(type) !== 1) {
        context.addIssue({
          code: "custom",
          message: `Risk policy requires exactly one ${type} constraint`,
          path: ["constraints"],
        });
      }
    }

    const maxTrade = document.constraints.find(
      (constraint) => constraint.type === "max_trade_bps",
    );
    const maxPosition = document.constraints.find(
      (constraint) => constraint.type === "max_position_bps",
    );
    if (
      maxTrade?.type === "max_trade_bps" &&
      maxPosition?.type === "max_position_bps" &&
      maxTrade.value > maxPosition.value
    ) {
      context.addIssue({
        code: "custom",
        message: "Maximum trade weight cannot exceed maximum position weight",
        path: ["constraints"],
      });
    }
  });

export const riskPolicyVersionSchema = z.object({
  id: entityIdSchema,
  agentId: entityIdSchema,
  version: versionSchema,
  document: riskPolicyDocumentSchema,
  hash: sha256Schema,
  createdAt: timestampSchema,
});

export type RiskConstraint = z.infer<typeof riskConstraintSchema>;
export type RiskPolicyDocument = z.infer<typeof riskPolicyDocumentSchema>;
export type RiskPolicyVersion = z.infer<typeof riskPolicyVersionSchema>;
