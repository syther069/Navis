import { z } from "zod";

import type { SolanaRpcClient } from "../solana/rpc";
import { CLAWPUMP_NETWORK } from "./client";
import type { ClawPumpPairAsset, ClawPumpPairsResponse } from "./schemas";

export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

/** Well-known mainnet stablecoins: a SOL/USDC style pair is never a stock pair. */
const STABLECOIN_MINTS: ReadonlyMap<string, string> = new Map([
  ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC"],
  ["Es9vMFrzaCERmJfrF4H2FYD4KCKUCtwECR8gUeTVfsPu", "USDT"],
]);

const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export type PairClassification =
  "wrapped_sol" | "stablecoin" | "tokenized_stock" | "unclassified";

export type TokenProgram = "spl-token" | "spl-token-2022";

/** Token-2022 on-chain token metadata, when the mint carries the extension. */
export type OnchainTokenMetadata = Readonly<{
  name: string;
  symbol: string;
  uri: string | null;
  updateAuthority: string | null;
}>;

export type TokenProgramReading =
  | {
      status: "verified";
      program: TokenProgram;
      decimals: number;
      slot: number;
      metadata: OnchainTokenMetadata | null;
    }
  | { status: "unverified"; reason: string };

/**
 * Tokenized-stock issuers recognised from on-chain Token-2022 metadata. Both
 * the metadata URI host and the metadata update authority must match; a
 * symbol or name alone never classifies a mint.
 */
export const TOKENIZED_STOCK_ISSUERS: readonly Readonly<{
  issuer: string;
  uriHosts: readonly string[];
  updateAuthority: string;
}>[] = [
  {
    issuer: "Backed xStocks",
    uriHosts: ["xstocks-metadata.backed.fi"],
    updateAuthority: "5aMNNLQJwAEeoemTEMkv5NVjqKwvvefRYCQ5Z67HFvEq",
  },
  {
    issuer: "Backpack Securities",
    uriHosts: ["metadata.backpack.exchange", "trek-labs.github.io"],
    updateAuthority: "2cVYpagTt7ZGc3mmTXBa7fAznUtx5DUu6aCq8uVDaf4a",
  },
];

export function matchTokenizedStockIssuer(
  metadata: OnchainTokenMetadata | null | undefined,
): string | null {
  if (!metadata?.uri || !metadata.updateAuthority) return null;
  let host: string;
  try {
    host = new URL(metadata.uri).host;
  } catch {
    return null;
  }
  const match = TOKENIZED_STOCK_ISSUERS.find(
    (issuer) =>
      issuer.uriHosts.includes(host) &&
      issuer.updateAuthority === metadata.updateAuthority,
  );
  return match?.issuer ?? null;
}

export type AnnotatedPair = Readonly<{
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  imageUrl: string | null;
  /** ClawPump documents launches on Solana mainnet only. */
  cluster: typeof CLAWPUMP_NETWORK;
  classification: PairClassification;
  /** Why it was classified that way; shown to the owner. */
  classificationSource: string;
  /** Matching PreStocks catalogue entry when the mint is listed there. */
  prestocks: { symbol: string; name: string } | null;
  /** On-chain Token-2022 metadata when present (name, symbol, issuer URI). */
  onchainMetadata: OnchainTokenMetadata | null;
  tokenProgram: TokenProgramReading;
  /**
   * Pump.fun creation pairs are not Meteora pools. A DBC pool needs the
   * launched base mint, which does not exist before a launch, so no pool can
   * be linked at pair level.
   */
  meteoraPool: null;
  /** Selectable as a stock-paired quote asset in the preflight form. */
  eligibleForStockPreflight: boolean;
}>;

export type PairCatalogueView = Readonly<{
  pairs: readonly AnnotatedPair[];
  stockPairs: readonly AnnotatedPair[];
  creatorFeeBps: ClawPumpPairsResponse["creatorFeeBps"];
  meta: ClawPumpPairsResponse["meta"];
  tokenProgramSource: string;
  venue: "Pump.fun creation pairs (not Meteora pools)";
}>;

export type PreStocksMintIndex = ReadonlyMap<string, { symbol: string; name: string }>;

export function classifyPair(
  asset: Pick<ClawPumpPairAsset, "mint" | "symbol">,
  prestocks: PreStocksMintIndex,
  tokenProgram?: TokenProgramReading,
): { classification: PairClassification; source: string } {
  if (asset.mint === WRAPPED_SOL_MINT) {
    return {
      classification: "wrapped_sol",
      source: "Wrapped SOL mint: the provider's standard SOL pair, not a stock pair.",
    };
  }
  const stable = STABLECOIN_MINTS.get(asset.mint);
  if (stable) {
    return {
      classification: "stablecoin",
      source: `${stable} stablecoin mint: a cash pair, not a stock pair.`,
    };
  }
  const match = prestocks.get(asset.mint);
  if (match) {
    return {
      classification: "tokenized_stock",
      source: `Mint listed in the PreStocks catalogue as ${match.symbol} (${match.name}).`,
    };
  }
  if (tokenProgram?.status === "verified") {
    const issuer = matchTokenizedStockIssuer(tokenProgram.metadata);
    if (issuer) {
      return {
        classification: "tokenized_stock",
        source: `On-chain Token-2022 metadata "${tokenProgram.metadata!.name}" (${tokenProgram.metadata!.symbol}) issued by ${issuer}: metadata URI host and update authority both match the issuer.`,
      };
    }
  }
  return {
    classification: "unclassified",
    source:
      "Non-SOL quote asset that neither the PreStocks catalogue nor recognised on-chain tokenized-stock metadata confirms as a tokenized stock.",
  };
}

const tokenMetadataExtensionSchema = z.object({
  extension: z.string(),
  state: z
    .object({
      name: z.string().optional(),
      symbol: z.string().optional(),
      uri: z.string().nullable().optional(),
      updateAuthority: z.string().nullable().optional(),
    })
    .passthrough()
    .optional(),
});

const parsedMintAccountSchema = z.object({
  owner: z.string(),
  data: z.object({
    program: z.string().optional(),
    parsed: z
      .object({
        type: z.string().optional(),
        info: z
          .object({
            decimals: z.number().int(),
            extensions: z.array(tokenMetadataExtensionSchema),
          })
          .partial()
          .optional(),
      })
      .optional(),
  }),
});

function readOnchainMetadata(
  extensions: readonly z.infer<typeof tokenMetadataExtensionSchema>[] | undefined,
): OnchainTokenMetadata | null {
  const entry = extensions?.find((item) => item.extension === "tokenMetadata");
  if (!entry?.state?.name || !entry.state.symbol) return null;
  return {
    name: entry.state.name,
    symbol: entry.state.symbol,
    uri: entry.state.uri ?? null,
    updateAuthority: entry.state.updateAuthority ?? null,
  };
}

const multipleAccountsSchema = z.object({
  context: z.object({ slot: z.number().int() }),
  value: z.array(parsedMintAccountSchema.nullable()),
});

/**
 * Read each pair mint from mainnet and report its token program. Any failure
 * leaves the reading `unverified`; nothing is guessed from the symbol.
 */
export async function readTokenPrograms(
  mints: readonly string[],
  rpc: Pick<SolanaRpcClient, "request"> | null,
): Promise<Map<string, TokenProgramReading>> {
  const readings = new Map<string, TokenProgramReading>();
  if (mints.length === 0) return readings;
  if (!rpc) {
    for (const mint of mints) {
      readings.set(mint, {
        status: "unverified",
        reason: "No mainnet RPC endpoint is available to read the mint account.",
      });
    }
    return readings;
  }

  // getMultipleAccounts accepts at most 100 pubkeys per call; the live
  // catalogue is larger, so chunks are read sequentially. A failed chunk
  // leaves only its own mints unverified.
  const CHUNK = 100;
  for (let offset = 0; offset < mints.length; offset += CHUNK) {
    const chunk = mints.slice(offset, offset + CHUNK);
    try {
      const raw = await rpc.request("getMultipleAccounts", [
        [...chunk],
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]);
      const parsed = multipleAccountsSchema.parse(raw);
      chunk.forEach((mint, index) => {
        const account = parsed.value[index];
        if (!account) {
          readings.set(mint, {
            status: "unverified",
            reason: "Mint account not found on mainnet.",
          });
          return;
        }
        const program =
          account.owner === SPL_TOKEN_PROGRAM_ID
            ? "spl-token"
            : account.owner === TOKEN_2022_PROGRAM_ID
              ? "spl-token-2022"
              : null;
        const decimals = account.data.parsed?.info?.decimals;
        if (
          !program ||
          account.data.parsed?.type !== "mint" ||
          decimals === undefined
        ) {
          readings.set(mint, {
            status: "unverified",
            reason: "Account is not a token mint owned by a known token program.",
          });
          return;
        }
        readings.set(mint, {
          status: "verified",
          program,
          decimals,
          slot: parsed.context.slot,
          metadata: readOnchainMetadata(account.data.parsed?.info?.extensions),
        });
      });
    } catch {
      for (const mint of chunk) {
        readings.set(mint, {
          status: "unverified",
          reason: "Mainnet mint read failed; token program stays unverified.",
        });
      }
    }
  }
  return readings;
}

export function buildPairCatalogueView(input: {
  pairs: ClawPumpPairsResponse;
  prestocks: PreStocksMintIndex;
  tokenPrograms: ReadonlyMap<string, TokenProgramReading>;
  tokenProgramSource: string;
}): PairCatalogueView {
  const pairs = input.pairs.assets.map((asset): AnnotatedPair => {
    const tokenProgram = input.tokenPrograms.get(asset.mint) ?? {
      status: "unverified" as const,
      reason: "Mint was not read.",
    };
    const { classification, source } = classifyPair(
      asset,
      input.prestocks,
      tokenProgram,
    );
    const match = input.prestocks.get(asset.mint) ?? null;
    // Fail closed: a stock pair is only eligible when the mint was read from
    // mainnet and its decimals agree with the provider catalogue.
    const eligible =
      classification === "tokenized_stock" &&
      tokenProgram.status === "verified" &&
      tokenProgram.decimals === asset.decimals;
    return {
      ...asset,
      cluster: CLAWPUMP_NETWORK,
      classification,
      classificationSource: source,
      prestocks: match,
      onchainMetadata:
        tokenProgram.status === "verified" ? tokenProgram.metadata : null,
      tokenProgram,
      meteoraPool: null,
      eligibleForStockPreflight: eligible,
    };
  });
  return {
    pairs,
    stockPairs: pairs.filter((pair) => pair.classification === "tokenized_stock"),
    creatorFeeBps: input.pairs.creatorFeeBps,
    meta: input.pairs.meta,
    tokenProgramSource: input.tokenProgramSource,
    venue: "Pump.fun creation pairs (not Meteora pools)",
  };
}

export function indexPreStocksMints(
  assets: readonly { contract_address: string; symbol: string; name: string }[],
): PreStocksMintIndex {
  return new Map(
    assets.map((asset) => [
      asset.contract_address,
      { symbol: asset.symbol, name: asset.name },
    ]),
  );
}
