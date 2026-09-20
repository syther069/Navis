import { z } from "zod";

import { solanaPublicKeySchema, timestampSchema } from "../../domain";

export const clawPumpMetaSchema = z.object({
  timestamp: timestampSchema,
  requestId: z.string().min(1),
});

export const clawPumpSkillSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  alwaysOn: z.boolean(),
});

export const clawPumpAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  walletAddress: solanaPublicKeySchema,
  skills: z.array(z.string()),
  model: z.string().nullable().optional(),
  persona: z.string().nullable().optional(),
  tokenAddress: z.string().nullable().optional(),
  createdAt: timestampSchema.optional(),
  updatedAt: timestampSchema.optional(),
});

export const clawPumpSkillsResponseSchema = z.object({
  skills: z.array(clawPumpSkillSchema),
  meta: clawPumpMetaSchema,
});

export const clawPumpAgentsResponseSchema = z.object({
  agents: z.array(clawPumpAgentSchema),
  meta: clawPumpMetaSchema,
});

export const clawPumpPairsResponseSchema = z.object({
  assets: z.array(
    z.object({
      mint: solanaPublicKeySchema,
      symbol: z.string().trim().min(1).max(16),
      name: z.string().trim().min(1).max(120),
      decimals: z.number().int().min(0).max(18),
      imageUrl: z.url().nullable(),
    }),
  ),
  creatorFeeBps: z.object({
    min: z.number().int().min(100).max(300),
    max: z.number().int().min(100).max(300),
    default: z.number().int().min(100).max(300),
  }),
  meta: clawPumpMetaSchema,
});

export const clawPumpAgentResponseSchema = clawPumpAgentSchema.extend({
  meta: clawPumpMetaSchema,
});

export const createClawPumpAgentInputSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    model: z.string().trim().min(1).optional(),
    persona: z.string().trim().min(1).max(1_000).optional(),
    system_prompt: z.string().trim().min(1).max(8_000).optional(),
    temperature: z.number().min(0).max(1).optional(),
    skills: z.array(z.string().trim().min(1)).min(1).max(16),
  })
  .strict();

export type CreateClawPumpAgentInput = z.infer<typeof createClawPumpAgentInputSchema>;

export const selfFundedLaunchPreflightInputSchema = z
  .object({
    name: z.string().trim().min(1).max(32),
    symbol: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9]+$/),
    description: z.string().trim().min(20).max(500),
    imageUrl: z.url().refine((value) => value.startsWith("https://"), {
      message: "Token image must use HTTPS.",
    }),
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    walletAddress: solanaPublicKeySchema,
    pumpQuoteMint: solanaPublicKeySchema,
    pumpCreatorFeeBps: z.number().int().min(100).max(300),
    devBuySol: z.number().finite().min(0).max(100),
    preflight: z.literal(true),
  })
  .strict();

export const selfFundedLaunchPreflightResponseSchema = z.object({
  payment: z.object({
    method: z.literal("sol"),
    amountLamports: z.number().int().positive(),
    amountSol: z.number().finite().positive(),
    payTo: solanaPublicKeySchema,
    payFrom: solanaPublicKeySchema,
    validForSeconds: z.number().int().positive(),
    breakdown: z
      .object({
        creationFeeSol: z.number().finite().nonnegative(),
        devBuySol: z.number().finite().nonnegative(),
      })
      .passthrough(),
  }),
  retryWith: z.object({
    txSignature: z.string().min(1),
    preflightToken: z.string().min(1),
  }),
  meta: clawPumpMetaSchema,
});

export type SelfFundedLaunchPreflightInput = z.infer<
  typeof selfFundedLaunchPreflightInputSchema
>;
