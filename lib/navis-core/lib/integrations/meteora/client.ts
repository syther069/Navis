import {
  DynamicBondingCurveClient,
  deriveDbcPoolAddress,
  deriveTokenBadgeAddress,
  type VirtualPool,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { Connection, PublicKey, Transaction, type Commitment } from "@solana/web3.js";
import { createHash } from "node:crypto";

import type { SolanaCluster } from "@workspace/navis-core/lib/env-core";
import { SOLANA_GENESIS_HASHES } from "../solana/config";
import { MeteoraClusterError } from "./errors";

import {
  METEORA_DBC_PROGRAM_ID,
  getNavisMeteoraCurvePreview,
  validateNavisMeteoraConfig,
} from "./config";
import {
  MeteoraQuoteProfileError,
  type MeteoraQuoteProfileId,
  type MeteoraQuoteSource,
  type ResolvedMeteoraQuoteProfile,
} from "./quote-profiles";

const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/**
 * Token-2022 extensions the DBC program accepts on a quote mint without a
 * Meteora-issued token badge. Anything else (transfer hook, permanent delegate,
 * transfer fee, pausable, default account state, ...) needs a badge PDA created
 * by the Meteora admin, or create-config fails with "invalid token badge".
 */
const PERMISSIONLESS_TOKEN_2022_EXTENSIONS = new Set([
  "metadataPointer",
  "tokenMetadata",
]);

export type VerifiedQuoteMint = Readonly<{
  mint: string;
  owner: string;
  tokenProgram: "spl-token" | "spl-token-2022";
  decimals: number;
  extensions: string[];
  /** Badge PDA that must exist for this mint, or null when none is needed. */
  tokenBadge: string | null;
  verifiedAtSlot: number;
}>;

export type MeteoraClientConfig = Readonly<{
  cluster: SolanaCluster;
  endpoint: string;
  commitment?: Commitment;
}>;

export type MeteoraPoolStatus = Readonly<{
  source: "Meteora DBC onchain account";
  cluster: SolanaCluster;
  programId: string;
  fetchedAt: string;
  contextSlot: number;
  poolAddress: string;
  baseMint: string;
  configAddress: string;
  quoteReserveRaw: string;
  migrationQuoteThresholdRaw: string;
  progressRatio: number;
  migrated: boolean;
}>;

export type PreparedMeteoraConfigTransaction = Readonly<{
  kind: "meteora.createConfig";
  profileId: MeteoraQuoteProfileId;
  quote: {
    profileId: MeteoraQuoteProfileId;
    source: MeteoraQuoteSource;
    mint: string;
    decimals: number;
    symbol: string;
    name: string;
    provenance: string;
    onchain: VerifiedQuoteMint | null;
  };
  cluster: SolanaCluster;
  programId: string;
  sdkVersion: string;
  serializedTransaction: string;
  messageSha256: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  feePayer: string;
  requiredSigners: string[];
  accounts: {
    config: string;
    payer: string;
    feeClaimer: string;
    leftoverReceiver: string;
    quoteMint: string;
  };
  review: {
    instructions: number;
    signaturesRequired: number;
    migrationQuoteThresholdLamports: string;
    migrationQuoteThresholdSol: string;
  };
}>;

export type MeteoraSignedSimulationResult = Readonly<{
  kind: "meteora.simulateConfig" | "meteora.simulatePool";
  cluster: SolanaCluster;
  messageSha256: string;
  feePayer: string;
  signatureCount: number;
  contextSlot: number;
  error: unknown;
  logs: string[];
  unitsConsumed: number | null;
}>;

export type MeteoraSubmitResult = Readonly<{
  kind: "meteora.submitConfig" | "meteora.submitPool";
  cluster: SolanaCluster;
  messageSha256: string;
  feePayer: string;
  signatureCount: number;
  transactionSignature: string;
  submittedAt: string;
}>;

export type PreparedMeteoraPoolTransaction = Readonly<{
  kind: "meteora.createPool";
  cluster: SolanaCluster;
  programId: string;
  serializedTransaction: string;
  messageSha256: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  feePayer: string;
  requiredSigners: string[];
  accounts: {
    config: string;
    baseMint: string;
    poolAddress: string;
    payer: string;
    poolCreator: string;
    quoteMint: string;
    tokenBadge: string | null;
  };
  metadata: {
    name: string;
    symbol: string;
    uri: string;
  };
  review: {
    instructions: number;
    signaturesRequired: number;
  };
}>;

export class MeteoraDbcClient {
  readonly connection: Connection;
  readonly sdk: DynamicBondingCurveClient;

  constructor(readonly config: MeteoraClientConfig) {
    const commitment = config.commitment ?? "confirmed";
    this.connection = new Connection(config.endpoint, commitment);
    this.sdk = new DynamicBondingCurveClient(this.connection, commitment);
  }

  /** Recheck at each operation; configuration labels are not network evidence. */
  async assertRpcCluster(): Promise<void> {
    try {
      const genesisHash = await this.connection.getGenesisHash();
      if (genesisHash === SOLANA_GENESIS_HASHES[this.config.cluster]) return;
    } catch {
      // Never expose the RPC URL or provider error, and never fail open.
    }
    throw new MeteoraClusterError();
  }

  async getPoolByBaseMint(baseMint: string): Promise<MeteoraPoolStatus | null> {
    const mint = new PublicKey(baseMint);
    const [pool, contextSlot] = await Promise.all([
      this.sdk.state.getPoolByBaseMint(mint),
      this.connection.getSlot(this.config.commitment ?? "confirmed"),
    ]);
    if (!pool) return null;

    const account = (pool.account as VirtualPool).poolState;
    const threshold = await this.sdk.state.getPoolMigrationQuoteThreshold(
      pool.publicKey,
    );
    const progressRatio = await this.sdk.state.getPoolQuoteTokenCurveProgress(
      pool.publicKey,
    );

    return Object.freeze({
      source: "Meteora DBC onchain account",
      cluster: this.config.cluster,
      programId: METEORA_DBC_PROGRAM_ID,
      fetchedAt: new Date().toISOString(),
      contextSlot,
      poolAddress: pool.publicKey.toBase58(),
      baseMint: account.baseMint.toBase58(),
      configAddress: account.config.toBase58(),
      quoteReserveRaw: account.quoteReserve.toString(10),
      migrationQuoteThresholdRaw: threshold.toString(10),
      progressRatio,
      migrated: Boolean(account.isMigrated),
    });
  }

  /**
   * Read the quote mint account and refuse anything that is not a token mint
   * with the decimals the curve was built for. Used for catalogue-sourced
   * quote mints (PreStocks), whose decimals are not part of the catalogue.
   */
  async verifyQuoteMint(
    quote: ResolvedMeteoraQuoteProfile,
  ): Promise<VerifiedQuoteMint> {
    const mint = new PublicKey(quote.quoteMint);
    const response = await this.connection.getParsedAccountInfo(
      mint,
      this.config.commitment ?? "confirmed",
    );
    const account = response.value;
    if (!account) {
      throw new MeteoraQuoteProfileError(
        `Quote mint for ${quote.quoteSymbol} does not exist on ${this.config.cluster}.`,
        409,
      );
    }
    const owner = account.owner.toBase58();
    const tokenProgram =
      owner === SPL_TOKEN_PROGRAM_ID
        ? "spl-token"
        : owner === TOKEN_2022_PROGRAM_ID
          ? "spl-token-2022"
          : null;
    const parsed =
      "parsed" in account.data
        ? (account.data.parsed as {
            type?: string;
            info?: { decimals?: number; extensions?: { extension?: string }[] };
          })
        : null;
    if (!tokenProgram || parsed?.type !== "mint") {
      throw new MeteoraQuoteProfileError(
        `Quote address for ${quote.quoteSymbol} is not a token mint on ${this.config.cluster}.`,
        409,
      );
    }
    const decimals = parsed.info?.decimals;
    if (decimals !== quote.quoteDecimals) {
      throw new MeteoraQuoteProfileError(
        `Quote mint for ${quote.quoteSymbol} has ${String(decimals)} decimals; the profile expects ${quote.quoteDecimals}.`,
        409,
      );
    }
    const extensions = (parsed.info?.extensions ?? [])
      .map((entry) => entry.extension)
      .filter((name): name is string => typeof name === "string");
    const needsBadge =
      tokenProgram === "spl-token-2022" &&
      extensions.some((name) => !PERMISSIONLESS_TOKEN_2022_EXTENSIONS.has(name));
    let tokenBadge: string | null = null;
    if (needsBadge) {
      const badgeAddress = deriveTokenBadgeAddress(mint);
      const badge = await this.connection.getAccountInfo(
        badgeAddress,
        this.config.commitment ?? "confirmed",
      );
      if (!badge || badge.owner.toBase58() !== METEORA_DBC_PROGRAM_ID) {
        const gated = extensions.filter(
          (name) => !PERMISSIONLESS_TOKEN_2022_EXTENSIONS.has(name),
        );
        throw new MeteoraQuoteProfileError(
          `Meteora has not issued a DBC token badge for ${quote.quoteSymbol} (${mint.toBase58()}). The mint uses Token-2022 extensions (${gated.join(", ")}) that the DBC program only accepts with a badge, so this stock-paired launch is unavailable until Meteora badges the mint. Navis will not bypass this.`,
          409,
        );
      }
      tokenBadge = badgeAddress.toBase58();
    }
    return Object.freeze({
      mint: mint.toBase58(),
      owner,
      tokenProgram,
      decimals,
      extensions,
      tokenBadge,
      verifiedAtSlot: response.context.slot,
    });
  }

  async prepareCreateConfigTransaction(input: {
    config: string;
    payer: string;
    feeClaimer?: string;
    leftoverReceiver?: string;
    quote: ResolvedMeteoraQuoteProfile;
  }): Promise<PreparedMeteoraConfigTransaction> {
    await this.assertRpcCluster();
    if (input.quote.cluster !== this.config.cluster) {
      throw new MeteoraQuoteProfileError(
        "Quote profile was resolved for a different cluster.",
        409,
      );
    }
    const config = new PublicKey(input.config);
    const payer = new PublicKey(input.payer);
    const feeClaimer = new PublicKey(input.feeClaimer ?? input.payer);
    const leftoverReceiver = new PublicKey(input.leftoverReceiver ?? input.payer);
    const quoteMint = new PublicKey(input.quote.quoteMint);
    const onchain =
      input.quote.quoteSource === "prestocks"
        ? await this.verifyQuoteMint(input.quote)
        : null;
    const generated = validateNavisMeteoraConfig(
      leftoverReceiver.toBase58(),
      input.quote.profileId,
    );
    const preview = getNavisMeteoraCurvePreview(
      this.config.cluster,
      input.quote.profileId,
    );
    const transaction = await this.sdk.partner.createConfig({
      ...generated,
      config,
      feeClaimer,
      leftoverReceiver,
      quoteMint,
      payer,
      tokenBadge: onchain?.tokenBadge ? new PublicKey(onchain.tokenBadge) : undefined,
    });
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash(this.config.commitment ?? "confirmed");

    transaction.feePayer = payer;
    transaction.recentBlockhash = blockhash;

    const message = transaction.compileMessage();
    const requiredSigners = message.accountKeys
      .filter((_, index) => message.isAccountSigner(index))
      .map((account) => account.toBase58());
    const serializedTransaction = transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");
    const messageSha256 = createHash("sha256")
      .update(transaction.serializeMessage())
      .digest("hex");

    return Object.freeze({
      kind: "meteora.createConfig",
      profileId: preview.profileId,
      quote: {
        profileId: input.quote.profileId,
        source: input.quote.quoteSource,
        mint: quoteMint.toBase58(),
        decimals: input.quote.quoteDecimals,
        symbol: input.quote.quoteSymbol,
        name: input.quote.quoteName,
        provenance: input.quote.provenance,
        onchain,
      },
      cluster: this.config.cluster,
      programId: METEORA_DBC_PROGRAM_ID,
      sdkVersion: preview.sdkVersion,
      serializedTransaction,
      messageSha256,
      recentBlockhash: blockhash,
      lastValidBlockHeight,
      feePayer: payer.toBase58(),
      requiredSigners,
      accounts: {
        config: config.toBase58(),
        payer: payer.toBase58(),
        feeClaimer: feeClaimer.toBase58(),
        leftoverReceiver: leftoverReceiver.toBase58(),
        quoteMint: quoteMint.toBase58(),
      },
      review: {
        instructions: transaction.instructions.length,
        signaturesRequired: message.header.numRequiredSignatures,
        migrationQuoteThresholdLamports: generated.migrationQuoteThreshold.toString(10),
        migrationQuoteThresholdSol: preview.pricing.migrationQuoteThreshold,
      },
    });
  }

  async simulateSignedConfigTransaction(input: {
    serializedTransaction: string;
    expectedMessageSha256: string;
    expectedPayer: string;
  }): Promise<MeteoraSignedSimulationResult> {
    await this.assertRpcCluster();
    const { transaction, feePayer, messageSha256, signatureCount } =
      this.parseVerifiedSignedTransaction(input);
    const response = await this.connection.simulateTransaction(transaction);

    return Object.freeze({
      kind: "meteora.simulateConfig",
      cluster: this.config.cluster,
      messageSha256,
      feePayer,
      signatureCount,
      contextSlot: response.context.slot,
      error: response.value.err ?? null,
      logs: response.value.logs ?? [],
      unitsConsumed: response.value.unitsConsumed ?? null,
    });
  }

  async submitSignedConfigTransaction(input: {
    serializedTransaction: string;
    expectedMessageSha256: string;
    expectedPayer: string;
  }): Promise<MeteoraSubmitResult> {
    await this.assertRpcCluster();
    const { transaction, feePayer, messageSha256, signatureCount } =
      this.parseVerifiedSignedTransaction(input);
    const transactionSignature = await this.connection.sendRawTransaction(
      transaction.serialize({
        requireAllSignatures: true,
        verifySignatures: true,
      }),
      {
        maxRetries: 3,
        preflightCommitment: this.config.commitment ?? "confirmed",
        skipPreflight: false,
      },
    );

    return Object.freeze({
      kind: "meteora.submitConfig",
      cluster: this.config.cluster,
      messageSha256,
      feePayer,
      signatureCount,
      transactionSignature,
      submittedAt: new Date().toISOString(),
    });
  }

  /**
   * Decode the DBC config the intent promised. Used by reconciliation to prove
   * the protocol result, not just the transaction signature.
   */
  async readConfigAccount(address: string) {
    const config = await this.sdk.state.getPoolConfig(new PublicKey(address));
    return config ? { quoteMint: config.quoteMint.toBase58() } : null;
  }

  /** Decode a DBC virtual pool by address; null when the account is absent. */
  async readPoolAccount(address: string) {
    const pool = await this.sdk.state.getPool(new PublicKey(address));
    if (!pool) return null;
    const account = (pool as VirtualPool).poolState;
    return {
      baseMint: account.baseMint.toBase58(),
      config: account.config.toBase58(),
    };
  }

  async prepareCreatePoolTransaction(input: {
    config: string;
    baseMint: string;
    /** Quote mint recorded on the confirmed config launch. Never a client value. */
    quoteMint: string;
    payer: string;
    poolCreator?: string;
    name: string;
    symbol: string;
    uri: string;
  }): Promise<PreparedMeteoraPoolTransaction> {
    await this.assertRpcCluster();
    const config = new PublicKey(input.config);
    const baseMint = new PublicKey(input.baseMint);
    const payer = new PublicKey(input.payer);
    const poolCreator = new PublicKey(input.poolCreator ?? input.payer);
    const quoteMint = new PublicKey(input.quoteMint);
    // The pool PDA is derived from the config's quote mint. Read the confirmed
    // config from chain and refuse to preview a pool address that the program
    // would not actually create.
    const onchainConfig = await this.sdk.state.getPoolConfig(config);
    if (!onchainConfig) {
      throw new MeteoraQuoteProfileError(
        "Meteora config account was not found onchain; confirm the config transaction before creating a pool.",
        409,
      );
    }
    if (!onchainConfig.quoteMint.equals(quoteMint)) {
      throw new MeteoraQuoteProfileError(
        `Onchain config quotes ${onchainConfig.quoteMint.toBase58()} but the launch record says ${quoteMint.toBase58()}; refusing to derive a pool from mismatched evidence.`,
        409,
      );
    }
    const badgeAddress = deriveTokenBadgeAddress(quoteMint);
    const badge = await this.connection.getAccountInfo(
      badgeAddress,
      this.config.commitment ?? "confirmed",
    );
    const poolAddress = deriveDbcPoolAddress(quoteMint, baseMint, config);
    const transaction = await this.sdk.creator.createPool({
      name: input.name,
      symbol: input.symbol,
      uri: input.uri,
      payer,
      poolCreator,
      config,
      baseMint,
      tokenBadge: badge ? badgeAddress : undefined,
    });
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash(this.config.commitment ?? "confirmed");

    transaction.feePayer = payer;
    transaction.recentBlockhash = blockhash;

    const message = transaction.compileMessage();
    const requiredSigners = message.accountKeys
      .filter((_, index) => message.isAccountSigner(index))
      .map((account) => account.toBase58());
    const serializedTransaction = transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");
    const messageSha256 = createHash("sha256")
      .update(transaction.serializeMessage())
      .digest("hex");

    return Object.freeze({
      kind: "meteora.createPool",
      cluster: this.config.cluster,
      programId: METEORA_DBC_PROGRAM_ID,
      serializedTransaction,
      messageSha256,
      recentBlockhash: blockhash,
      lastValidBlockHeight,
      feePayer: payer.toBase58(),
      requiredSigners,
      accounts: {
        config: config.toBase58(),
        baseMint: baseMint.toBase58(),
        poolAddress: poolAddress.toBase58(),
        payer: payer.toBase58(),
        poolCreator: poolCreator.toBase58(),
        quoteMint: quoteMint.toBase58(),
        tokenBadge: badge ? badgeAddress.toBase58() : null,
      },
      metadata: {
        name: input.name,
        symbol: input.symbol,
        uri: input.uri,
      },
      review: {
        instructions: transaction.instructions.length,
        signaturesRequired: message.header.numRequiredSignatures,
      },
    });
  }

  async simulateSignedPoolTransaction(input: {
    serializedTransaction: string;
    expectedMessageSha256: string;
    expectedPayer: string;
  }): Promise<MeteoraSignedSimulationResult> {
    await this.assertRpcCluster();
    const { transaction, feePayer, messageSha256, signatureCount } =
      this.parseVerifiedSignedTransaction(input);
    const response = await this.connection.simulateTransaction(transaction);

    return Object.freeze({
      kind: "meteora.simulatePool",
      cluster: this.config.cluster,
      messageSha256,
      feePayer,
      signatureCount,
      contextSlot: response.context.slot,
      error: response.value.err ?? null,
      logs: response.value.logs ?? [],
      unitsConsumed: response.value.unitsConsumed ?? null,
    });
  }

  async submitSignedPoolTransaction(input: {
    serializedTransaction: string;
    expectedMessageSha256: string;
    expectedPayer: string;
  }): Promise<MeteoraSubmitResult> {
    await this.assertRpcCluster();
    const { transaction, feePayer, messageSha256, signatureCount } =
      this.parseVerifiedSignedTransaction(input);
    const transactionSignature = await this.connection.sendRawTransaction(
      transaction.serialize({
        requireAllSignatures: true,
        verifySignatures: true,
      }),
      {
        maxRetries: 3,
        preflightCommitment: this.config.commitment ?? "confirmed",
        skipPreflight: false,
      },
    );

    return Object.freeze({
      kind: "meteora.submitPool",
      cluster: this.config.cluster,
      messageSha256,
      feePayer,
      signatureCount,
      transactionSignature,
      submittedAt: new Date().toISOString(),
    });
  }

  parseVerifiedSignedTransaction(input: {
    serializedTransaction: string;
    expectedMessageSha256: string;
    expectedPayer: string;
  }) {
    const transaction = Transaction.from(
      Buffer.from(input.serializedTransaction, "base64"),
    );
    const feePayer = transaction.feePayer?.toBase58();
    if (feePayer !== input.expectedPayer) {
      throw new Error("Signed Meteora transaction payer does not match the session.");
    }

    const messageSha256 = createHash("sha256")
      .update(transaction.serializeMessage())
      .digest("hex");
    if (messageSha256 !== input.expectedMessageSha256) {
      throw new Error(
        "Signed Meteora transaction does not match the prepared message.",
      );
    }
    if (!transaction.verifySignatures()) {
      throw new Error("Signed Meteora transaction is missing a required signature.");
    }

    return {
      transaction,
      feePayer,
      messageSha256,
      signatureCount: transaction.signatures.filter((signature) => signature.signature)
        .length,
    };
  }
}

export function createMeteoraDbcClient(config: MeteoraClientConfig) {
  return new MeteoraDbcClient(config);
}
