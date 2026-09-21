import { createHash } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";

import * as schema from "../db/schema";
import {
  CLAWPUMP_NETWORK,
  ClawPumpError,
  describeClawPumpError,
  type ClawPumpClient,
} from "../integrations/clawpump/client";
import {
  buildPairCatalogueView,
  readTokenPrograms,
  type AnnotatedPair,
  type PreStocksMintIndex,
} from "../integrations/clawpump/pairs";
import type { SolanaRpcClient } from "../integrations/solana/rpc";
import { solanaPublicKeySchema, type SolanaCluster } from "../domain";

const launchPreflightRequestSchema = z
  .object({
    localAgentId: z.uuid(),
    name: z.string().trim().min(1).max(32),
    symbol: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9]+$/),
    description: z.string().trim().min(20).max(500),
    imageUrl: z.url().refine((value) => value.startsWith("https://")),
    quoteMint: solanaPublicKeySchema,
    creatorFeeBps: z.number().int().min(100).max(300),
    devBuySol: z.number().finite().min(0).max(100).default(0),
  })
  .strict();

export type LaunchPreflightRequest = z.input<typeof launchPreflightRequestSchema>;
type NavisDatabase = NodePgDatabase<typeof schema>;

export const LAUNCH_PREFLIGHT_OPERATION = "launch_preflight";

export type PreflightPrerequisite = Readonly<{
  code:
    | "network_mismatch"
    | "wallet_mismatch"
    | "insufficient_funding"
    | "funding_unverified"
    | "token_program_unverified"
    | "stock_classification_unconfirmed"
    | "cost_discovery_unavailable"
    | "execution_disabled";
  severity: "blocking" | "advisory";
  origin: "local" | "provider";
  message: string;
}>;

export type ProviderValidation =
  | { result: "accepted"; requestId: string; timestamp: string }
  | {
      result: "rejected";
      kind: ClawPumpError["kind"];
      httpStatus: number | null;
      code: string | null;
      reason: string;
      requestId: string | null;
      details: {
        missing?: readonly string[];
        invalidFields?: readonly string[];
        expectedWalletAddress?: string;
      };
    }
  | { result: "not_requested"; reason: string };

export type PreflightQuoteAsset = Readonly<{
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  classification: AnnotatedPair["classification"];
  classificationSource: string;
  tokenProgram: AnnotatedPair["tokenProgram"];
  cluster: typeof CLAWPUMP_NETWORK;
}>;

export type LaunchPreflightResult = Readonly<{
  state: "quoted" | "rejected";
  /** Who rejected: Navis rules before any provider call, or the provider. */
  rejectionOrigin: "local" | "provider" | null;
  rejectionReason: string | null;
  agent: {
    localAgentId: string;
    name: string;
    externalAgentId: string;
    externalWallet: string | null;
    cluster: SolanaCluster;
    mode: string;
  };
  tokenConfig: {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    creatorFeeBps: number;
    devBuySol: number;
  };
  quoteAsset: PreflightQuoteAsset | null;
  network: typeof CLAWPUMP_NETWORK;
  costEstimate: {
    standardCostSol: number;
    creationFeeSol: number;
    defaultDevBuySol: number;
    payTo: string;
    quoteValidForSeconds: number;
    requestId: string;
  } | null;
  quote: {
    payment: {
      method: "sol";
      amountLamports: number;
      amountSol: number;
      payTo: string;
      payFrom: string;
      validForSeconds: number;
      breakdown: Record<string, unknown>;
    };
    meta: { requestId: string; timestamp: string };
  } | null;
  requiredWallet: string;
  walletBalanceLamports: number | null;
  providerValidation: ProviderValidation;
  prerequisites: readonly PreflightPrerequisite[];
  readyForAuthorisedExecution: boolean;
  launchSubmitted: false;
  statement: string;
}>;

export const NOTHING_LAUNCHED_STATEMENT =
  "Ready for a separate authorised execution step only when no blocking prerequisite remains. Nothing was launched, paid or signed.";

export function buildLaunchPreflightEvidence(input: {
  localAgentId: string;
  externalAgentId: string;
  agentName: string;
  walletAddress: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  pair: {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    imageUrl: string | null;
  };
  creatorFeeBps: number;
  devBuySol: number;
  payment: {
    method: "sol";
    amountLamports: number;
    amountSol: number;
    payTo: string;
    payFrom: string;
    validForSeconds: number;
    breakdown: Record<string, unknown>;
  };
  preflightToken: string;
  providerTimestamp: string;
}) {
  return {
    localAgentId: input.localAgentId,
    launchTerms: {
      name: input.name,
      symbol: input.symbol.toUpperCase(),
      description: input.description,
      imageUrl: input.imageUrl,
      externalAgentId: input.externalAgentId,
      agentName: input.agentName,
      walletAddress: input.walletAddress,
      pumpQuoteMint: input.pair.mint,
      pumpCreatorFeeBps: input.creatorFeeBps,
      devBuySol: input.devBuySol,
    },
    pair: input.pair,
    payment: input.payment,
    preflightTokenSha256: createHash("sha256")
      .update(input.preflightToken)
      .digest("hex"),
    providerTimestamp: input.providerTimestamp,
  };
}

/** Documented launch error codes mapped to owner-readable outcomes. */
export function mapProviderRejection(
  error: ClawPumpError,
): Extract<ProviderValidation, { result: "rejected" }> {
  const code = error.details.code ?? null;
  let reason: string;
  switch (true) {
    case error.kind === "payment_required":
      reason =
        "Provider answered with x402 payment terms (USDC on Solana mainnet). Navis does not relay payments; use the self-funded SOL path.";
      break;
    case code === "WALLET_ADDRESS_MISMATCH":
      reason = error.details.expectedWalletAddress
        ? `Provider rejected the payer: this agent's registered wallet is ${error.details.expectedWalletAddress}, not the session wallet.`
        : "Provider rejected the payer: the session wallet is not this agent's registered wallet.";
      break;
    case code === "AGENT_ALREADY_HAS_TOKEN":
      reason = error.details.mintAddress
        ? `Provider refused: this ClawPump agent already launched token ${error.details.mintAddress}.`
        : "Provider refused: this ClawPump agent already has a token.";
      break;
    case code === "LAUNCH_BLOCKED" || code === "RESERVED_AGENT_ID":
      reason = `Provider blocked the launch for this agent [${code}].`;
      break;
    case error.kind === "forbidden":
      reason = "Provider refused: the Partner key does not own this agent.";
      break;
    case code === "QUOTE_UNAVAILABLE" || code === "SELF_FUNDED_WALLET_LOW":
      reason = `Provider cannot quote right now [${code}]; retry later.`;
      break;
    case typeof code === "string" && code.startsWith("PAYMENT_"):
      reason = `Provider reported a payment problem [${code}].`;
      break;
    case error.kind === "validation":
      reason = `Provider rejected the launch parameters${
        error.details.missing?.length
          ? `; missing ${error.details.missing.join(", ")}`
          : ""
      }${
        error.details.invalidFields?.length
          ? `; invalid ${error.details.invalidFields.join(", ")}`
          : ""
      }.`;
      break;
    default:
      reason = describeClawPumpError(error);
  }
  return {
    result: "rejected",
    kind: error.kind,
    httpStatus: error.status ?? null,
    code,
    reason,
    requestId: error.requestId ?? null,
    details: {
      missing: error.details.missing,
      invalidFields: error.details.invalidFields,
      expectedWalletAddress: error.details.expectedWalletAddress,
    },
  };
}

export type LaunchPreflightContext = Readonly<{
  userId: string;
  wallet: string;
  client: Pick<
    ClawPumpClient,
    "getPumpPairs" | "preflightSelfFundedLaunch" | "getSelfFundedLaunchCost"
  >;
  database: NavisDatabase;
  prestocksMints: PreStocksMintIndex;
  /** Read-only mainnet RPC for mint programs and payer balance; null fails closed. */
  mainnetRpc: Pick<SolanaRpcClient, "request"> | null;
  mainnetRpcSource: string;
  /** App execution cluster; devnet cannot fund a mainnet launch. */
  appCluster: SolanaCluster;
  mainnetExecutionEnabled: boolean;
}>;

export class LaunchPreflightRefused extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "LaunchPreflightRefused";
  }
}

const balanceSchema = z.object({ value: z.number().int().nonnegative() });

export async function createLaunchPreflight(
  candidate: unknown,
  context: LaunchPreflightContext,
): Promise<LaunchPreflightResult> {
  const input = launchPreflightRequestSchema.parse(candidate);
  const [agent] = await context.database
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      externalAgentId: schema.agents.externalAgentId,
      externalWallet: schema.agents.externalWallet,
      integrationStatus: schema.agents.integrationStatus,
      isPublicDemo: schema.agents.isPublicDemo,
      cluster: schema.agents.cluster,
      mode: schema.agents.mode,
    })
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.id, input.localAgentId),
        eq(schema.agents.ownerId, context.userId),
      ),
    )
    .limit(1);

  if (!agent) {
    throw new LaunchPreflightRefused(
      "The selected Navis agent is not owned by this session.",
      404,
    );
  }
  if (agent.isPublicDemo) {
    throw new LaunchPreflightRefused("Atlas is never launched.", 403);
  }
  if (agent.integrationStatus !== "linked" || !agent.externalAgentId) {
    throw new LaunchPreflightRefused(
      "The selected Navis agent is not linked to ClawPump.",
      409,
    );
  }

  const tokenConfig = {
    name: input.name,
    symbol: input.symbol.toUpperCase(),
    description: input.description,
    imageUrl: input.imageUrl,
    creatorFeeBps: input.creatorFeeBps,
    devBuySol: input.devBuySol,
  };
  const agentSummary = {
    localAgentId: agent.id,
    name: agent.name,
    externalAgentId: agent.externalAgentId,
    externalWallet: agent.externalWallet,
    cluster: agent.cluster,
    mode: agent.mode,
  };
  const startedAt = performance.now();
  const prerequisites: PreflightPrerequisite[] = [];

  const finish = async (
    result: Omit<LaunchPreflightResult, "launchSubmitted" | "statement">,
    preflightToken: string | null,
  ): Promise<LaunchPreflightResult> => {
    const full: LaunchPreflightResult = {
      ...result,
      launchSubmitted: false,
      statement: NOTHING_LAUNCHED_STATEMENT,
    };
    await context.database.insert(schema.externalCalls).values({
      provider: "clawpump",
      requestId:
        full.quote?.meta.requestId ??
        (full.providerValidation.result === "rejected"
          ? full.providerValidation.requestId
          : null),
      operation: LAUNCH_PREFLIGHT_OPERATION,
      status: full.state,
      latencyMs: Math.round(performance.now() - startedAt),
      safeError: full.rejectionReason,
      metadata: {
        ownerUserId: context.userId,
        result: full,
        preflightTokenSha256: preflightToken
          ? createHash("sha256").update(preflightToken).digest("hex")
          : null,
      },
    });
    return full;
  };

  const localReject = (reason: string, quoteAsset: PreflightQuoteAsset | null) =>
    finish(
      {
        state: "rejected",
        rejectionOrigin: "local",
        rejectionReason: reason,
        agent: agentSummary,
        tokenConfig,
        quoteAsset,
        network: CLAWPUMP_NETWORK,
        costEstimate: null,
        quote: null,
        requiredWallet: context.wallet,
        walletBalanceLamports: null,
        providerValidation: {
          result: "not_requested",
          reason: "Local validation failed before any provider call.",
        },
        prerequisites,
        readyForAuthorisedExecution: false,
      },
      null,
    );

  const pairs = await context.client.getPumpPairs();
  const rawPair = pairs.assets.find((asset) => asset.mint === input.quoteMint);
  if (!rawPair) {
    return localReject(
      "The selected quote mint is not in the live ClawPump pair catalogue.",
      null,
    );
  }
  const catalogue = buildPairCatalogueView({
    pairs,
    prestocks: context.prestocksMints,
    tokenPrograms: await readTokenPrograms([rawPair.mint], context.mainnetRpc),
    tokenProgramSource: context.mainnetRpcSource,
  });
  const pair = catalogue.pairs.find((entry) => entry.mint === rawPair.mint)!;
  const quoteAsset: PreflightQuoteAsset = {
    mint: pair.mint,
    symbol: pair.symbol,
    name: pair.name,
    decimals: pair.decimals,
    classification: pair.classification,
    classificationSource: pair.classificationSource,
    tokenProgram: pair.tokenProgram,
    cluster: CLAWPUMP_NETWORK,
  };

  if (pair.classification === "wrapped_sol" || pair.classification === "stablecoin") {
    return localReject(
      `Unsupported quote asset for a stock-paired launch: ${pair.symbol} is ${
        pair.classification === "wrapped_sol" ? "the wrapped SOL pair" : "a stablecoin"
      }, not a tokenized stock.`,
      quoteAsset,
    );
  }
  if (
    input.creatorFeeBps < pairs.creatorFeeBps.min ||
    input.creatorFeeBps > pairs.creatorFeeBps.max
  ) {
    return localReject(
      `Creator fee ${input.creatorFeeBps} bps is outside the provider's live range ${pairs.creatorFeeBps.min}-${pairs.creatorFeeBps.max}.`,
      quoteAsset,
    );
  }

  if (pair.classification === "unclassified") {
    prerequisites.push({
      code: "stock_classification_unconfirmed",
      severity: "advisory",
      origin: "local",
      message: pair.classificationSource,
    });
  }
  if (pair.tokenProgram.status !== "verified") {
    prerequisites.push({
      code: "token_program_unverified",
      severity: "blocking",
      origin: "local",
      message: `Quote mint token program could not be verified on mainnet: ${pair.tokenProgram.reason}`,
    });
  }
  if (context.appCluster !== "mainnet-beta" || agent.cluster !== "mainnet-beta") {
    prerequisites.push({
      code: "network_mismatch",
      severity: "blocking",
      origin: "local",
      message: `ClawPump launches only on Solana mainnet. The app runs on ${context.appCluster} and this agent is a ${agent.mode} agent on ${agent.cluster}, so no execution can be authorised from here.`,
    });
  }
  if (!context.mainnetExecutionEnabled) {
    prerequisites.push({
      code: "execution_disabled",
      severity: "blocking",
      origin: "local",
      message:
        "Mainnet execution is disabled in this deployment; the quote is review-only.",
    });
  }

  let costEstimate: LaunchPreflightResult["costEstimate"] = null;
  try {
    const cost = await context.client.getSelfFundedLaunchCost(pair.mint);
    costEstimate = {
      standardCostSol: cost.standardCostSol,
      creationFeeSol: cost.creationFeeSol,
      defaultDevBuySol: cost.defaultDevBuySol,
      payTo: cost.payTo,
      quoteValidForSeconds: cost.quoteValidForSeconds,
      requestId: cost.meta.requestId,
    };
  } catch (error) {
    prerequisites.push({
      code: "cost_discovery_unavailable",
      severity: "advisory",
      origin: "provider",
      message:
        error instanceof ClawPumpError
          ? describeClawPumpError(error)
          : "Cost discovery failed.",
    });
  }

  let quote: LaunchPreflightResult["quote"] = null;
  let preflightToken: string | null = null;
  let providerValidation: ProviderValidation;
  try {
    const response = await context.client.preflightSelfFundedLaunch({
      name: tokenConfig.name,
      symbol: tokenConfig.symbol,
      description: tokenConfig.description,
      imageUrl: tokenConfig.imageUrl,
      agentId: agent.externalAgentId,
      agentName: agent.name,
      walletAddress: context.wallet,
      pumpQuoteMint: pair.mint,
      pumpCreatorFeeBps: input.creatorFeeBps,
      devBuySol: input.devBuySol,
      preflight: true,
    });
    quote = { payment: response.payment, meta: response.meta };
    preflightToken = response.retryWith.preflightToken;
    providerValidation = {
      result: "accepted",
      requestId: response.meta.requestId,
      timestamp: response.meta.timestamp,
    };
  } catch (error) {
    if (!(error instanceof ClawPumpError)) throw error;
    providerValidation = mapProviderRejection(error);
  }

  if (providerValidation.result === "rejected") {
    return finish(
      {
        state: "rejected",
        rejectionOrigin: "provider",
        rejectionReason: providerValidation.reason,
        agent: agentSummary,
        tokenConfig,
        quoteAsset,
        network: CLAWPUMP_NETWORK,
        costEstimate,
        quote: null,
        requiredWallet:
          providerValidation.details.expectedWalletAddress ?? context.wallet,
        walletBalanceLamports: null,
        providerValidation,
        prerequisites,
        readyForAuthorisedExecution: false,
      },
      null,
    );
  }

  const payment = quote!.payment;
  if (payment.payFrom !== context.wallet) {
    prerequisites.push({
      code: "wallet_mismatch",
      severity: "blocking",
      origin: "provider",
      message: `Provider quoted payer ${payment.payFrom}, which is not the authenticated wallet.`,
    });
  }
  let walletBalanceLamports: number | null = null;
  if (context.mainnetRpc) {
    try {
      const raw = await context.mainnetRpc.request("getBalance", [
        payment.payFrom,
        { commitment: "confirmed" },
      ]);
      walletBalanceLamports = balanceSchema.parse(raw).value;
    } catch {
      walletBalanceLamports = null;
    }
  }
  if (walletBalanceLamports === null) {
    prerequisites.push({
      code: "funding_unverified",
      severity: "blocking",
      origin: "local",
      message:
        "Mainnet balance of the payer wallet could not be read, so funding is unverified.",
    });
  } else if (walletBalanceLamports < payment.amountLamports) {
    prerequisites.push({
      code: "insufficient_funding",
      severity: "blocking",
      origin: "local",
      message: `Payer holds ${walletBalanceLamports.toLocaleString()} lamports on mainnet; the quote requires ${payment.amountLamports.toLocaleString()} lamports plus network fees.`,
    });
  }

  return finish(
    {
      state: "quoted",
      rejectionOrigin: null,
      rejectionReason: null,
      agent: agentSummary,
      tokenConfig,
      quoteAsset,
      network: CLAWPUMP_NETWORK,
      costEstimate,
      quote,
      requiredWallet: payment.payFrom,
      walletBalanceLamports,
      providerValidation,
      prerequisites,
      readyForAuthorisedExecution: !prerequisites.some(
        (item) => item.severity === "blocking",
      ),
    },
    preflightToken,
  );
}

/** Latest stored preflight outcome for one owner, for the section state model. */
export async function getLatestLaunchPreflightForOwner(
  database: NavisDatabase,
  userId: string,
): Promise<{
  outcome: "quoted" | "rejected";
  createdAt: string;
  result: LaunchPreflightResult;
} | null> {
  const [row] = await database
    .select({
      status: schema.externalCalls.status,
      metadata: schema.externalCalls.metadata,
      createdAt: schema.externalCalls.createdAt,
    })
    .from(schema.externalCalls)
    .where(
      and(
        eq(schema.externalCalls.provider, "clawpump"),
        eq(schema.externalCalls.operation, LAUNCH_PREFLIGHT_OPERATION),
        sql`${schema.externalCalls.metadata} ->> 'ownerUserId' = ${userId}`,
      ),
    )
    .orderBy(desc(schema.externalCalls.createdAt))
    .limit(1);
  if (!row) return null;
  const metadata = row.metadata as { result?: LaunchPreflightResult };
  if (!metadata.result || (row.status !== "quoted" && row.status !== "rejected")) {
    return null;
  }
  return {
    outcome: row.status,
    createdAt: row.createdAt.toISOString(),
    result: metadata.result,
  };
}

/**
 * The two launch states are gated on a stored market_launches row with a real
 * transaction signature. Navis writes none today, so this returns null.
 */
export async function getStoredClawPumpLaunchForOwner(
  database: NavisDatabase,
  userId: string,
): Promise<{ transactionSignature: string | null; verifiedOnchain: boolean } | null> {
  const [row] = await database
    .select({
      transactionSignature: schema.marketLaunches.transactionSignature,
      status: schema.marketLaunches.status,
    })
    .from(schema.marketLaunches)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.marketLaunches.agentId))
    .where(
      and(
        eq(schema.marketLaunches.provider, "clawpump"),
        eq(schema.agents.ownerId, userId),
      ),
    )
    .orderBy(desc(schema.marketLaunches.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    transactionSignature: row.transactionSignature,
    verifiedOnchain:
      row.status === "verified_onchain" && Boolean(row.transactionSignature),
  };
}
