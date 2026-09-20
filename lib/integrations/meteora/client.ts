import {
  DynamicBondingCurveClient,
  deriveDbcPoolAddress,
  type VirtualPool,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { Connection, PublicKey, Transaction, type Commitment } from "@solana/web3.js";
import { createHash } from "node:crypto";

import type { SolanaCluster } from "@/lib/env-core";

import {
  METEORA_DBC_PROGRAM_ID,
  WRAPPED_SOL_MINT,
  buildNavisMeteoraConfig,
  getNavisMeteoraCurvePreview,
  validateNavisMeteoraConfig,
} from "./config";

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
  profileId: "navis-equity-v1";
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

  async prepareCreateConfigTransaction(input: {
    config: string;
    payer: string;
    feeClaimer?: string;
    leftoverReceiver?: string;
  }): Promise<PreparedMeteoraConfigTransaction> {
    const config = new PublicKey(input.config);
    const payer = new PublicKey(input.payer);
    const feeClaimer = new PublicKey(input.feeClaimer ?? input.payer);
    const leftoverReceiver = new PublicKey(input.leftoverReceiver ?? input.payer);
    const quoteMint = new PublicKey(WRAPPED_SOL_MINT);
    const generated = validateNavisMeteoraConfig(leftoverReceiver.toBase58());
    const preview = getNavisMeteoraCurvePreview(this.config.cluster);
    const transaction = await this.sdk.partner.createConfig({
      ...buildNavisMeteoraConfig(),
      config,
      feeClaimer,
      leftoverReceiver,
      quoteMint,
      payer,
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
        migrationQuoteThresholdSol: preview.pricing.migrationQuoteThresholdSol,
      },
    });
  }

  async simulateSignedConfigTransaction(input: {
    serializedTransaction: string;
    expectedMessageSha256: string;
    expectedPayer: string;
  }): Promise<MeteoraSignedSimulationResult> {
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

  async prepareCreatePoolTransaction(input: {
    config: string;
    baseMint: string;
    payer: string;
    poolCreator?: string;
    name: string;
    symbol: string;
    uri: string;
  }): Promise<PreparedMeteoraPoolTransaction> {
    const config = new PublicKey(input.config);
    const baseMint = new PublicKey(input.baseMint);
    const payer = new PublicKey(input.payer);
    const poolCreator = new PublicKey(input.poolCreator ?? input.payer);
    const quoteMint = new PublicKey(WRAPPED_SOL_MINT);
    const poolAddress = deriveDbcPoolAddress(quoteMint, baseMint, config);
    const transaction = await this.sdk.creator.createPool({
      name: input.name,
      symbol: input.symbol,
      uri: input.uri,
      payer,
      poolCreator,
      config,
      baseMint,
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

  private parseVerifiedSignedTransaction(input: {
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
