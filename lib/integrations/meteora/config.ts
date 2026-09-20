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

export const METEORA_DBC_SDK_VERSION = "1.5.12";
export const METEORA_DBC_PROGRAM_ID = DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58();
export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * A deliberately modest, SOL-quoted launch profile for a thinly traded,
 * equity-themed asset. This is a product default, not investment advice and
 * not a claim that any token represents regulated equity.
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
  profileId: "navis-equity-v1";
  sdkVersion: string;
  programId: string;
  cluster: SolanaCluster;
  quoteMint: string;
  token: {
    standard: "SPL Token";
    baseDecimals: number;
    quoteDecimals: number;
    authority: "immutable";
    totalSupply: string;
    leftover: string;
  };
  pricing: {
    initialMarketCapSol: number;
    migrationMarketCapSol: number;
    migrationQuoteThresholdLamports: string;
    migrationQuoteThresholdSol: string;
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

export function buildNavisMeteoraConfig() {
  return buildCurveWithMarketCap(NAVIS_EQUITY_CURVE_INPUT);
}

export function validateNavisMeteoraConfig(leftoverReceiver: string) {
  const receiver = new PublicKey(leftoverReceiver);
  const generated = buildNavisMeteoraConfig();
  validateConfigParameters({ ...generated, leftoverReceiver: receiver });
  return generated;
}

export function getNavisMeteoraCurvePreview(
  cluster: SolanaCluster,
): MeteoraCurvePreview {
  const generated = buildNavisMeteoraConfig();
  const thresholdLamports = generated.migrationQuoteThreshold.toString(10);
  const thresholdSol = formatLamportsAsSol(thresholdLamports);
  const input = NAVIS_EQUITY_CURVE_INPUT;

  return Object.freeze({
    profileId: "navis-equity-v1",
    sdkVersion: METEORA_DBC_SDK_VERSION,
    programId: METEORA_DBC_PROGRAM_ID,
    cluster,
    quoteMint: WRAPPED_SOL_MINT,
    token: {
      standard: "SPL Token",
      baseDecimals: input.token.tokenBaseDecimal,
      quoteDecimals: input.token.tokenQuoteDecimal,
      authority: "immutable",
      totalSupply: String(input.token.totalTokenSupply),
      leftover: String(input.token.leftover),
    } as const,
    pricing: {
      initialMarketCapSol: input.initialMarketCap,
      migrationMarketCapSol: input.migrationMarketCap,
      migrationQuoteThresholdLamports: thresholdLamports,
      migrationQuoteThresholdSol: thresholdSol,
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

function formatLamportsAsSol(lamports: string) {
  const padded = lamports.padStart(10, "0");
  const whole = padded.slice(0, -9);
  const fraction = padded.slice(-9).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
