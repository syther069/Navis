import type { SolanaCluster } from "@/lib/env-core";

/**
 * Server-approved quote profiles for Meteora DBC launches.
 *
 * Clients never send a raw quote mint. They send a profile id (and, for the
 * PreStocks-quoted profile, the PreStocks symbol they want to pair with). The
 * server resolves the profile against this allowlist and, for PreStocks, against
 * the live catalogue plus the onchain mint account. Anything not on this list is
 * rejected before a transaction is built.
 */

export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

export const METEORA_QUOTE_PROFILE_IDS = [
  "navis-equity-v1",
  "navis-stock-exposure-v1",
] as const;

export type MeteoraQuoteProfileId = (typeof METEORA_QUOTE_PROFILE_IDS)[number];

export type MeteoraQuoteSource = "wrapped_sol" | "prestocks";

export type MeteoraCurveRationale = Readonly<{
  summary: string;
  priceBand: string;
  feeSchedule: string;
  graduation: string;
  lockedLiquidity: string;
  issuerAndTreasury: string;
}>;

export type MeteoraQuoteProfileDefinition = Readonly<{
  id: MeteoraQuoteProfileId;
  label: string;
  quoteSource: MeteoraQuoteSource;
  /** Human unit used for market-cap figures in the preview. */
  quoteUnit: string;
  /** Quote mint decimals the curve is built for. Verified onchain for PreStocks. */
  quoteDecimals: 6 | 9;
  /** Clusters where a real quote mint exists. Never invent one elsewhere. */
  supportedClusters: readonly SolanaCluster[];
  /** Why the profile is unavailable on clusters outside supportedClusters. */
  unavailableReason: string;
  /** Market cap in quote units at the start of the curve. */
  initialMarketCap: number;
  /** Market cap in quote units that graduates the pool to DAMM v2. */
  migrationMarketCap: number;
  rationale: MeteoraCurveRationale;
}>;

const solRationale: MeteoraCurveRationale = Object.freeze({
  summary:
    "A modest SOL-quoted curve for an equity-themed community asset. It is the original Navis default and stays on the allowlist for devnet rehearsals, where no stock-exposure quote mint exists.",
  priceBand:
    "Market cap moves from 2 SOL at launch to 20 SOL at graduation, a 10x band that keeps the curve shallow enough for a thinly traded asset.",
  feeSchedule:
    "Flat 1% base trading fee (100 bps, no decay) with Meteora dynamic fees enabled so volatility raises the fee instead of the spread.",
  graduation:
    "The pool migrates to Meteora DAMM v2 once the quote reserve reaches the exact SDK-computed threshold shown below.",
  lockedLiquidity:
    "10% of migrated liquidity is permanently locked (5% partner, 5% creator). The rest is claimable, which is disclosed rather than hidden.",
  issuerAndTreasury:
    "Token authority is immutable at creation. Trading and migration fees are split 50/50 between the Navis partner key and the creator wallet; the agent treasury never holds the fee claimer role.",
});

const stockRationale: MeteoraCurveRationale = Object.freeze({
  summary:
    "A stock-paired curve: the launched token is quoted in a PreStocks exposure token, so the pool prices the new asset in units of pre-IPO stock exposure rather than SOL. This is the profile the Meteora DBC and ClawPump tracks ask for.",
  priceBand:
    "Market cap moves from 200 to 2,000 quote tokens, the same 10x band as the SOL profile but denominated in the chosen PreStocks token so the price path tracks the stock exposure, not SOL volatility.",
  feeSchedule:
    "Flat 1% base trading fee with dynamic fees enabled. PreStocks tokens trade thinly, so the fee floor is kept flat instead of front-loaded to avoid punishing early liquidity.",
  graduation:
    "The pool migrates to Meteora DAMM v2 at the SDK-computed quote threshold, paired against the same PreStocks token, so post-graduation liquidity stays stock-paired.",
  lockedLiquidity:
    "10% of migrated liquidity is permanently locked (5% partner, 5% creator). Locking more would strand stock exposure that the treasury may need to unwind under policy.",
  issuerAndTreasury:
    "Token authority is immutable. PreStocks is the issuer of the quote token and controls its mint; Navis controls only the launched base token. Fees accrue in the PreStocks quote token and are split 50/50 between partner and creator. PreStocks tokens are economic exposure only, restricted for U.S. persons, and carry issuer risk that the launch inherits.",
});

export const METEORA_QUOTE_PROFILES: Readonly<
  Record<MeteoraQuoteProfileId, MeteoraQuoteProfileDefinition>
> = Object.freeze({
  "navis-equity-v1": Object.freeze({
    id: "navis-equity-v1",
    label: "SOL-quoted equity theme",
    quoteSource: "wrapped_sol",
    quoteUnit: "SOL",
    quoteDecimals: 9,
    supportedClusters: [
      "devnet",
      "mainnet-beta",
    ] as const satisfies readonly SolanaCluster[],
    unavailableReason: "Wrapped SOL exists on every cluster.",
    initialMarketCap: 2,
    migrationMarketCap: 20,
    rationale: solRationale,
  }),
  "navis-stock-exposure-v1": Object.freeze({
    id: "navis-stock-exposure-v1",
    label: "Stock-paired (PreStocks quote)",
    quoteSource: "prestocks",
    quoteUnit: "PreStocks token",
    quoteDecimals: 9,
    supportedClusters: ["mainnet-beta"] as const satisfies readonly SolanaCluster[],
    unavailableReason:
      "PreStocks issues its exposure tokens on mainnet only. There is no devnet PreStocks mint, and Navis will not substitute a fake one.",
    initialMarketCap: 200,
    migrationMarketCap: 2000,
    rationale: stockRationale,
  }),
});

export function isMeteoraQuoteProfileId(
  value: unknown,
): value is MeteoraQuoteProfileId {
  return (
    typeof value === "string" &&
    (METEORA_QUOTE_PROFILE_IDS as readonly string[]).includes(value)
  );
}

export function getMeteoraQuoteProfile(id: MeteoraQuoteProfileId) {
  return METEORA_QUOTE_PROFILES[id];
}

export function isMeteoraQuoteProfileAvailable(
  id: MeteoraQuoteProfileId,
  cluster: SolanaCluster,
) {
  return METEORA_QUOTE_PROFILES[id].supportedClusters.includes(cluster);
}

export type MeteoraQuoteProfileStatus = "available" | "gated" | "unavailable";

export type MeteoraQuoteProfileAvailability = Readonly<{
  id: MeteoraQuoteProfileId;
  label: string;
  quoteSource: MeteoraQuoteSource;
  cluster: SolanaCluster;
  /** True when the server will attempt to resolve the profile on this cluster. */
  available: boolean;
  /** "gated" means resolvable in principle but blocked by an onchain precondition today. */
  status: MeteoraQuoteProfileStatus;
  reason: string;
  requiresQuoteSymbol: boolean;
}>;

export const PRESTOCKS_QUOTE_GATE_REASON =
  "PreStocks mints are Token-2022 with transfer hook, permanent delegate and transfer fee extensions. Meteora DBC only accepts such a quote mint when Meteora has issued a token badge for it. Navis checks the badge onchain at prepare time and refuses to build the config without it. As of 2026-09-20 no live PreStocks mint has a badge, so this profile is gated until Meteora issues one.";

export function getMeteoraQuoteProfileStatus(
  id: MeteoraQuoteProfileId,
  cluster: SolanaCluster,
): MeteoraQuoteProfileStatus {
  const profile = METEORA_QUOTE_PROFILES[id];
  if (!profile.supportedClusters.includes(cluster)) return "unavailable";
  return profile.quoteSource === "prestocks" ? "gated" : "available";
}

export function listMeteoraQuoteProfileAvailability(
  cluster: SolanaCluster,
): readonly MeteoraQuoteProfileAvailability[] {
  return METEORA_QUOTE_PROFILE_IDS.map((id) => {
    const profile = METEORA_QUOTE_PROFILES[id];
    const status = getMeteoraQuoteProfileStatus(id, cluster);
    return Object.freeze({
      id,
      label: profile.label,
      quoteSource: profile.quoteSource,
      cluster,
      available: status !== "unavailable",
      status,
      reason:
        status === "unavailable"
          ? profile.unavailableReason
          : status === "gated"
            ? PRESTOCKS_QUOTE_GATE_REASON
            : "Wrapped SOL quote mint.",
      requiresQuoteSymbol: profile.quoteSource === "prestocks",
    });
  });
}

/** A quote profile resolved to a concrete mint for one cluster. */
export type ResolvedMeteoraQuoteProfile = Readonly<{
  profileId: MeteoraQuoteProfileId;
  cluster: SolanaCluster;
  quoteSource: MeteoraQuoteSource;
  quoteMint: string;
  quoteDecimals: 6 | 9;
  quoteSymbol: string;
  quoteName: string;
  /** Where the mint came from, so the intent record can say why it was trusted. */
  provenance: string;
}>;

export class MeteoraQuoteProfileError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 = 400,
  ) {
    super(message);
    this.name = "MeteoraQuoteProfileError";
  }
}

export type PreStocksQuoteCandidate = Readonly<{
  symbol: string;
  name: string;
  contract_address: string;
}>;

/**
 * Resolve a client-selected profile id to an approved quote mint. Pure and
 * synchronous: the caller supplies the PreStocks catalogue it already fetched.
 * Onchain verification of the mint happens separately in the client.
 */
export function resolveMeteoraQuoteProfile(input: {
  profileId: unknown;
  cluster: SolanaCluster;
  quoteSymbol?: string | null;
  prestocksCatalogue?: readonly PreStocksQuoteCandidate[] | null;
}): ResolvedMeteoraQuoteProfile {
  if (!isMeteoraQuoteProfileId(input.profileId)) {
    throw new MeteoraQuoteProfileError(
      "Unknown Meteora quote profile. Choose one of the server-approved profiles.",
    );
  }
  const profile = METEORA_QUOTE_PROFILES[input.profileId];
  if (!profile.supportedClusters.includes(input.cluster)) {
    throw new MeteoraQuoteProfileError(
      `Profile ${profile.id} is not available on ${input.cluster}: ${profile.unavailableReason}`,
      409,
    );
  }

  if (profile.quoteSource === "wrapped_sol") {
    return Object.freeze({
      profileId: profile.id,
      cluster: input.cluster,
      quoteSource: "wrapped_sol",
      quoteMint: WRAPPED_SOL_MINT,
      quoteDecimals: profile.quoteDecimals,
      quoteSymbol: "SOL",
      quoteName: "Wrapped SOL",
      provenance: "Native wrapped SOL mint; constant on every cluster.",
    });
  }

  const symbol = input.quoteSymbol?.trim().toUpperCase();
  if (!symbol) {
    throw new MeteoraQuoteProfileError(
      "The stock-paired profile needs a PreStocks symbol to quote against.",
    );
  }
  if (!input.prestocksCatalogue || input.prestocksCatalogue.length === 0) {
    throw new MeteoraQuoteProfileError(
      "The PreStocks catalogue is unavailable, so the stock-paired quote mint cannot be verified right now.",
      409,
    );
  }
  const asset = input.prestocksCatalogue.find(
    (candidate) => candidate.symbol.toUpperCase() === symbol,
  );
  if (!asset) {
    throw new MeteoraQuoteProfileError(
      `PreStocks symbol ${symbol} is not in the live catalogue. Only catalogue mints are approved as quote tokens.`,
    );
  }

  return Object.freeze({
    profileId: profile.id,
    cluster: input.cluster,
    quoteSource: "prestocks",
    quoteMint: asset.contract_address,
    quoteDecimals: profile.quoteDecimals,
    quoteSymbol: asset.symbol,
    quoteName: asset.name,
    provenance:
      "Contract address read from the live PreStocks catalogue at prepare time; mint owner and decimals verified onchain before the transaction was built.",
  });
}
