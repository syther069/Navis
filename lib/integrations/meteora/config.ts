import {
  ActivationType,
  BaseFeeMode,
  buildCurveWithMarketCap,
  CollectFeeMode,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  validateConfigParameters,
  type BuildCurveWithMarketCapParams,
  type ConfigParameters,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { PublicKey } from "@solana/web3.js";

import type { SolanaCluster } from "@/lib/env-core";

import {
  METEORA_QUOTE_PROFILES,
  PRESTOCKS_QUOTE_GATE_REASON,
  WRAPPED_SOL_MINT,
  getMeteoraQuoteProfile,
  getMeteoraQuoteProfileStatus,
  type MeteoraCurveRationale,
  type MeteoraQuoteProfileStatus,
  type MeteoraQuoteProfileId,
  type MeteoraQuoteSource,
} from "./quote-profiles";

export { WRAPPED_SOL_MINT };

export const METEORA_DBC_SDK_VERSION = "1.5.12";
export const METEORA_DBC_PROGRAM_ID = DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58();

/**
 * The shared curve shape. Quote decimals and the market-cap band come from the
 * selected quote profile; everything else is the same conservative default.
 * This is a product default, not investment advice and not a claim that any
 * token represents regulated equity.
 */
export const NAVIS_EQUITY_CURVE_INPUT = Object.freeze({
  token: Object.freeze({
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: TokenDecimal.SIX,
    tokenQuoteDecimal: TokenDecimal.NINE,
    tokenAuthorityOption: TokenAuthorityOption.Immutable,
    totalTokenSupply: 1_000_000_000,
    leftover: 0,
  }),
  fee: Object.freeze({
    baseFeeParams: Object.freeze({
      baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
      feeSchedulerParam: Object.freeze({
        startingFeeBps: 100,
        endingFeeBps: 100,
        numberOfPeriod: 0,
        totalDuration: 0,
      }),
    }),
    dynamicFeeEnabled: true,
    collectFeeMode: CollectFeeMode.QuoteToken,
    creatorTradingFeePercentage: 50,
    poolCreationFee: 0,
    enableFirstSwapWithMinFee: false,
  }),
  migration: Object.freeze({
    migrationOption: MigrationOption.MET_DAMM_V2,
    migrationFeeOption: MigrationFeeOption.FixedBps200,
    migrationFee: Object.freeze({
      feePercentage: 2,
      creatorFeePercentage: 50,
    }),
  }),
  liquidityDistribution: Object.freeze({
    partnerPermanentLockedLiquidityPercentage: 5,
    partnerLiquidityPercentage: 50,
    creatorPermanentLockedLiquidityPercentage: 5,
    creatorLiquidityPercentage: 40,
  }),
  lockedVesting: Object.freeze({
    totalLockedVestingAmount: 0,
    numberOfVestingPeriod: 0,
    cliffUnlockAmount: 0,
    totalVestingDuration: 0,
    cliffDurationFromMigrationTime: 0,
  }),
  activationType: ActivationType.Timestamp,
  initialMarketCap: 2,
  migrationMarketCap: 20,
}) satisfies BuildCurveWithMarketCapParams;

export type MeteoraCurvePreview = Readonly<{
  profileId: MeteoraQuoteProfileId;
  profileLabel: string;
  sdkVersion: string;
  programId: string;
  cluster: SolanaCluster;
  quoteSource: MeteoraQuoteSource;
  /** Concrete mint when it is a constant; null when it is resolved per request. */
  quoteMint: string | null;
  quoteUnit: string;
  availability: {
    available: boolean;
    status: MeteoraQuoteProfileStatus;
    reason: string;
  };
  rationale: MeteoraCurveRationale;
  token: {
    standard: "SPL Token";
    baseDecimals: number;
    quoteDecimals: number;
    authority: "immutable";
    totalSupply: string;
    leftover: string;
  };
  pricing: {
    initialMarketCapQuote: number;
    migrationMarketCapQuote: number;
    migrationQuoteThresholdRaw: string;
    migrationQuoteThreshold: string;
  };
  fees: {
    baseTradingFeeBps: number;
    baseFeeMode: "linear scheduler";
    endingTradingFeeBps: number;
    feePeriods: number;
    feeDurationSeconds: number;
    dynamicFeeEnabled: boolean;
    collectedIn: "quote token";
    creatorTradingFeeSharePercent: number;
    poolCreationFeeLamports: string;
    firstSwapMinimumFeeEnabled: boolean;
    migrationFeePercent: number;
    creatorMigrationFeeSharePercent: number;
  };
  activation: {
    type: "timestamp";
  };
  vesting: {
    totalLockedAmount: string;
    cliffUnlockAmount: string;
    periods: number;
    totalDurationSeconds: number;
    cliffDurationSeconds: number;
  };
  migration: {
    destination: "Meteora DAMM v2";
    partnerClaimablePercent: number;
    partnerPermanentlyLockedPercent: number;
    creatorClaimablePercent: number;
    creatorPermanentlyLockedPercent: number;
    totalPermanentlyLockedPercent: number;
  };
  generated: ConfigParameters;
}>;

export function getNavisMeteoraCurveInput(
  profileId: MeteoraQuoteProfileId = "navis-equity-v1",
): BuildCurveWithMarketCapParams {
  const profile = getMeteoraQuoteProfile(profileId);
  return {
    ...NAVIS_EQUITY_CURVE_INPUT,
    token: {
      ...NAVIS_EQUITY_CURVE_INPUT.token,
      tokenQuoteDecimal:
        profile.quoteDecimals === 6 ? TokenDecimal.SIX : TokenDecimal.NINE,
    },
    initialMarketCap: profile.initialMarketCap,
    migrationMarketCap: profile.migrationMarketCap,
  };
}

export function buildNavisMeteoraConfig(
  profileId: MeteoraQuoteProfileId = "navis-equity-v1",
) {
  return buildCurveWithMarketCap(getNavisMeteoraCurveInput(profileId));
}

export function validateNavisMeteoraConfig(
  leftoverReceiver: string,
  profileId: MeteoraQuoteProfileId = "navis-equity-v1",
) {
  const receiver = new PublicKey(leftoverReceiver);
  const generated = buildNavisMeteoraConfig(profileId);
  validateConfigParameters({ ...generated, leftoverReceiver: receiver });
  return generated;
}

export function getNavisMeteoraCurvePreviews(
  cluster: SolanaCluster,
): readonly MeteoraCurvePreview[] {
  return (Object.keys(METEORA_QUOTE_PROFILES) as MeteoraQuoteProfileId[]).map((id) =>
    getNavisMeteoraCurvePreview(cluster, id),
  );
}

export function getNavisMeteoraCurvePreview(
  cluster: SolanaCluster,
  profileId: MeteoraQuoteProfileId = "navis-equity-v1",
): MeteoraCurvePreview {
  const profile = getMeteoraQuoteProfile(profileId);
  const generated = buildNavisMeteoraConfig(profileId);
  const thresholdRaw = generated.migrationQuoteThreshold.toString(10);
  const threshold = formatRawQuoteAmount(thresholdRaw, profile.quoteDecimals);
  const input = NAVIS_EQUITY_CURVE_INPUT;
  const status = getMeteoraQuoteProfileStatus(profileId, cluster);

  return Object.freeze({
    profileId,
    profileLabel: profile.label,
    sdkVersion: METEORA_DBC_SDK_VERSION,
    programId: METEORA_DBC_PROGRAM_ID,
    cluster,
    quoteSource: profile.quoteSource,
    quoteMint: profile.quoteSource === "wrapped_sol" ? WRAPPED_SOL_MINT : null,
    quoteUnit: profile.quoteUnit,
    availability: {
      available: status !== "unavailable",
      status,
      reason:
        status === "unavailable"
          ? profile.unavailableReason
          : status === "gated"
            ? PRESTOCKS_QUOTE_GATE_REASON
            : "Wrapped SOL quote mint.",
    },
    rationale: profile.rationale,
    token: {
      standard: "SPL Token",
      baseDecimals: input.token.tokenBaseDecimal,
      quoteDecimals: profile.quoteDecimals,
      authority: "immutable",
      totalSupply: String(input.token.totalTokenSupply),
      leftover: String(input.token.leftover),
    } as const,
    pricing: {
      initialMarketCapQuote: profile.initialMarketCap,
      migrationMarketCapQuote: profile.migrationMarketCap,
      migrationQuoteThresholdRaw: thresholdRaw,
      migrationQuoteThreshold: threshold,
    },
    fees: {
      baseTradingFeeBps: input.fee.baseFeeParams.feeSchedulerParam.startingFeeBps,
      baseFeeMode: "linear scheduler",
      endingTradingFeeBps: input.fee.baseFeeParams.feeSchedulerParam.endingFeeBps,
      feePeriods: input.fee.baseFeeParams.feeSchedulerParam.numberOfPeriod,
      feeDurationSeconds: input.fee.baseFeeParams.feeSchedulerParam.totalDuration,
      dynamicFeeEnabled: input.fee.dynamicFeeEnabled,
      collectedIn: "quote token",
      creatorTradingFeeSharePercent: input.fee.creatorTradingFeePercentage,
      poolCreationFeeLamports: String(input.fee.poolCreationFee),
      firstSwapMinimumFeeEnabled: input.fee.enableFirstSwapWithMinFee,
      migrationFeePercent: input.migration.migrationFee.feePercentage,
      creatorMigrationFeeSharePercent:
        input.migration.migrationFee.creatorFeePercentage,
    } as const,
    activation: {
      type: "timestamp",
    } as const,
    vesting: {
      totalLockedAmount: String(input.lockedVesting.totalLockedVestingAmount),
      cliffUnlockAmount: String(input.lockedVesting.cliffUnlockAmount),
      periods: input.lockedVesting.numberOfVestingPeriod,
      totalDurationSeconds: input.lockedVesting.totalVestingDuration,
      cliffDurationSeconds: input.lockedVesting.cliffDurationFromMigrationTime,
    },
    migration: {
      destination: "Meteora DAMM v2",
      partnerClaimablePercent: input.liquidityDistribution.partnerLiquidityPercentage,
      partnerPermanentlyLockedPercent:
        input.liquidityDistribution.partnerPermanentLockedLiquidityPercentage,
      creatorClaimablePercent: input.liquidityDistribution.creatorLiquidityPercentage,
      creatorPermanentlyLockedPercent:
        input.liquidityDistribution.creatorPermanentLockedLiquidityPercentage,
      totalPermanentlyLockedPercent:
        input.liquidityDistribution.partnerPermanentLockedLiquidityPercentage +
        input.liquidityDistribution.creatorPermanentLockedLiquidityPercentage,
    } as const,
    generated,
  });
}

function formatRawQuoteAmount(raw: string, decimals: number) {
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
