import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  getNavisMeteoraCurvePreview,
  METEORA_DBC_PROGRAM_ID,
  validateNavisMeteoraConfig,
  WRAPPED_SOL_MINT,
} from "../lib/integrations/meteora/config";
import { MeteoraDbcClient } from "../lib/integrations/meteora/client";
import { resolveMeteoraQuoteProfile } from "../lib/integrations/meteora/quote-profiles";

const solQuote = resolveMeteoraQuoteProfile({
  profileId: "navis-equity-v1",
  cluster: "devnet",
});

describe("Navis Meteora DBC configuration", () => {
  it("builds and validates the exact equity-like profile with the official SDK", () => {
    const receiver = Keypair.generate().publicKey.toBase58();
    const generated = validateNavisMeteoraConfig(receiver);

    expect(generated.migrationQuoteThreshold.toString(10)).toBe("4828261555");
    expect(generated.tokenSupply?.preMigrationTokenSupply.toString(10)).toBe(
      "1000000000000000",
    );
    expect(generated.tokenSupply?.postMigrationTokenSupply.toString(10)).toBe(
      "1000000000000000",
    );
    expect(generated.migrationOption).toBe(1);
    expect(generated.migrationFeeOption).toBe(3);
    expect(generated.tokenUpdateAuthority).toBe(1);
  });

  it("discloses cluster, program, quote mint, fees, and locked liquidity", () => {
    const preview = getNavisMeteoraCurvePreview("devnet");

    expect(preview.programId).toBe(METEORA_DBC_PROGRAM_ID);
    expect(preview.quoteMint).toBe(WRAPPED_SOL_MINT);
    expect(preview.pricing.migrationQuoteThreshold).toBe("4.828261555");
    expect(preview.token.leftover).toBe("1");
    expect(preview.availability.available).toBe(true);
    expect(preview.rationale.lockedLiquidity).toContain("10%");
    expect(preview.sdkVersion).toBe("1.5.12");
    expect(preview.fees.baseTradingFeeBps).toBe(100);
    expect(preview.fees).toMatchObject({
      baseFeeMode: "linear scheduler",
      endingTradingFeeBps: 100,
      feePeriods: 0,
      feeDurationSeconds: 0,
      collectedIn: "quote token",
      poolCreationFeeLamports: "0",
      firstSwapMinimumFeeEnabled: false,
    });
    expect(preview.activation.type).toBe("timestamp");
    expect(preview.vesting).toEqual({
      totalLockedAmount: "0",
      cliffUnlockAmount: "0",
      periods: 0,
      totalDurationSeconds: 0,
      cliffDurationSeconds: 0,
    });
    expect(preview.migration.totalPermanentlyLockedPercent).toBe(10);
    expect(preview.cluster).toBe("devnet");
  });

  it("prepares an unsigned create-config transaction with review evidence", async () => {
    const client = new MeteoraDbcClient({
      cluster: "devnet",
      endpoint: "http://127.0.0.1:8899",
    });
    const config = Keypair.generate();
    const payer = Keypair.generate();
    const blockhash = Keypair.generate().publicKey.toBase58();
    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: config.publicKey, isSigner: true, isWritable: true },
        ],
        data: Buffer.alloc(0),
      }),
    );

    vi.spyOn(client.connection, "getLatestBlockhash").mockResolvedValue({
      blockhash,
      lastValidBlockHeight: 1234,
    });
    vi.spyOn(client.sdk.partner, "createConfig").mockResolvedValue(transaction);

    const prepared = await client.prepareCreateConfigTransaction({
      config: config.publicKey.toBase58(),
      payer: payer.publicKey.toBase58(),
      quote: solQuote,
    });

    expect(prepared.kind).toBe("meteora.createConfig");
    expect(prepared.profileId).toBe("navis-equity-v1");
    expect(prepared.quote.mint).toBe(WRAPPED_SOL_MINT);
    expect(prepared.accounts.quoteMint).toBe(WRAPPED_SOL_MINT);
    expect(prepared.accounts.config).toBe(config.publicKey.toBase58());
    expect(prepared.accounts.payer).toBe(payer.publicKey.toBase58());
    expect(prepared.accounts.feeClaimer).toBe(payer.publicKey.toBase58());
    expect(prepared.accounts.leftoverReceiver).toBe(payer.publicKey.toBase58());
    expect(prepared.requiredSigners).toEqual([
      payer.publicKey.toBase58(),
      config.publicKey.toBase58(),
    ]);
    expect(prepared.recentBlockhash).toBe(blockhash);
    expect(prepared.messageSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(prepared.serializedTransaction).toEqual(expect.any(String));
    expect(prepared.review.signaturesRequired).toBe(2);
    expect(prepared.review.migrationQuoteThresholdLamports).toBe("4828261555");
    expect(
      Transaction.from(Buffer.from(prepared.serializedTransaction, "base64"))
        .signatures,
    ).toHaveLength(2);
  });

  it("simulates only a signed transaction matching the prepared message", async () => {
    const client = new MeteoraDbcClient({
      cluster: "devnet",
      endpoint: "http://127.0.0.1:8899",
    });
    const config = Keypair.generate();
    const payer = Keypair.generate();
    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: config.publicKey, isSigner: true, isWritable: true },
        ],
        data: Buffer.alloc(0),
      }),
    );
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
    transaction.partialSign(payer, config);
    const messageSha256 = createHash("sha256")
      .update(transaction.serializeMessage())
      .digest("hex");

    vi.spyOn(client.connection, "simulateTransaction").mockResolvedValue({
      context: { slot: 55 },
      value: { err: null, logs: ["ok"], unitsConsumed: 123 },
    } as Awaited<ReturnType<typeof client.connection.simulateTransaction>>);

    const simulation = await client.simulateSignedConfigTransaction({
      serializedTransaction: transaction.serialize().toString("base64"),
      expectedMessageSha256: messageSha256,
      expectedPayer: payer.publicKey.toBase58(),
    });

    expect(simulation.kind).toBe("meteora.simulateConfig");
    expect(simulation.contextSlot).toBe(55);
    expect(simulation.signatureCount).toBe(2);
    expect(simulation.error).toBeNull();
    expect(simulation.logs).toEqual(["ok"]);
    expect(simulation.unitsConsumed).toBe(123);
  });

  it("submits only a signed transaction matching the prepared message", async () => {
    const client = new MeteoraDbcClient({
      cluster: "devnet",
      endpoint: "http://127.0.0.1:8899",
    });
    const config = Keypair.generate();
    const payer = Keypair.generate();
    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: config.publicKey, isSigner: true, isWritable: true },
        ],
        data: Buffer.alloc(0),
      }),
    );
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
    transaction.partialSign(payer, config);
    const messageSha256 = createHash("sha256")
      .update(transaction.serializeMessage())
      .digest("hex");
    const signature = Keypair.generate().publicKey.toBase58();

    vi.spyOn(client.connection, "sendRawTransaction").mockResolvedValue(signature);

    const submitted = await client.submitSignedConfigTransaction({
      serializedTransaction: transaction.serialize().toString("base64"),
      expectedMessageSha256: messageSha256,
      expectedPayer: payer.publicKey.toBase58(),
    });

    expect(submitted.kind).toBe("meteora.submitConfig");
    expect(submitted.transactionSignature).toBe(signature);
    expect(submitted.signatureCount).toBe(2);
    expect(submitted.messageSha256).toBe(messageSha256);
    expect(submitted.feePayer).toBe(payer.publicKey.toBase58());
    expect(client.connection.sendRawTransaction).toHaveBeenCalledOnce();
  });

  it("prepares an unsigned create-pool transaction with derived pool evidence", async () => {
    const client = new MeteoraDbcClient({
      cluster: "devnet",
      endpoint: "http://127.0.0.1:8899",
    });
    const config = Keypair.generate();
    const baseMint = Keypair.generate();
    const payer = Keypair.generate();
    const blockhash = Keypair.generate().publicKey.toBase58();
    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: baseMint.publicKey, isSigner: true, isWritable: true },
        ],
        data: Buffer.alloc(0),
      }),
    );

    vi.spyOn(client.connection, "getLatestBlockhash").mockResolvedValue({
      blockhash,
      lastValidBlockHeight: 4321,
    });
    vi.spyOn(client.sdk.creator, "createPool").mockResolvedValue(transaction);
    vi.spyOn(client.sdk.state, "getPoolConfig").mockResolvedValue({
      quoteMint: new PublicKey(WRAPPED_SOL_MINT),
    } as never);
    vi.spyOn(client.connection, "getAccountInfo").mockResolvedValue(null);

    const prepared = await client.prepareCreatePoolTransaction({
      config: config.publicKey.toBase58(),
      baseMint: baseMint.publicKey.toBase58(),
      quoteMint: WRAPPED_SOL_MINT,
      payer: payer.publicKey.toBase58(),
      name: "Navis Test",
      symbol: "NAVT",
      uri: "https://example.com/navis-test.json",
    });

    expect(prepared.kind).toBe("meteora.createPool");
    expect(prepared.accounts.config).toBe(config.publicKey.toBase58());
    expect(prepared.accounts.baseMint).toBe(baseMint.publicKey.toBase58());
    expect(prepared.accounts.payer).toBe(payer.publicKey.toBase58());
    expect(prepared.accounts.poolAddress).toEqual(expect.any(String));
    expect(prepared.requiredSigners).toEqual([
      payer.publicKey.toBase58(),
      baseMint.publicKey.toBase58(),
    ]);
    expect(prepared.metadata.symbol).toBe("NAVT");
    expect(prepared.review.signaturesRequired).toBe(2);
    expect(prepared.serializedTransaction).toEqual(expect.any(String));
  });

  it("submits only a signed pool transaction matching the prepared message", async () => {
    const client = new MeteoraDbcClient({
      cluster: "devnet",
      endpoint: "http://127.0.0.1:8899",
    });
    const baseMint = Keypair.generate();
    const payer = Keypair.generate();
    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: baseMint.publicKey, isSigner: true, isWritable: true },
        ],
        data: Buffer.alloc(0),
      }),
    );
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
    transaction.partialSign(payer, baseMint);
    const messageSha256 = createHash("sha256")
      .update(transaction.serializeMessage())
      .digest("hex");
    const signature = Keypair.generate().publicKey.toBase58();

    vi.spyOn(client.connection, "sendRawTransaction").mockResolvedValue(signature);

    const submitted = await client.submitSignedPoolTransaction({
      serializedTransaction: transaction.serialize().toString("base64"),
      expectedMessageSha256: messageSha256,
      expectedPayer: payer.publicKey.toBase58(),
    });

    expect(submitted.kind).toBe("meteora.submitPool");
    expect(submitted.transactionSignature).toBe(signature);
    expect(submitted.signatureCount).toBe(2);
    expect(client.connection.sendRawTransaction).toHaveBeenCalledOnce();
  });
});
