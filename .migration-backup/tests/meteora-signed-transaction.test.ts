import { createHash } from "node:crypto";

import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { MeteoraDbcClient } from "../lib/integrations/meteora/client";

// The client constructor only builds an RPC connection object; nothing here
// talks to a network. The parser is the guard every simulate/submit route
// runs on wallet-signed bytes before they reach an RPC call.
const client = new MeteoraDbcClient({
  cluster: "devnet",
  endpoint: "http://127.0.0.1:8899",
});

const payer = Keypair.generate();
const recipient = Keypair.generate();
const blockhash = new PublicKey(new Uint8Array(32).fill(9)).toBase58();

function preparedTransaction() {
  const transaction = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 1_000,
    }),
  );
  const expectedMessageSha256 = createHash("sha256")
    .update(transaction.serializeMessage())
    .digest("hex");
  return { transaction, expectedMessageSha256 };
}

function signedBytes(transaction: Transaction) {
  transaction.sign(payer);
  return transaction.serialize({ requireAllSignatures: true, verifySignatures: true });
}

function parse(
  bytes: Uint8Array,
  expectedMessageSha256: string,
  expectedPayer = payer,
) {
  return client.parseVerifiedSignedTransaction({
    serializedTransaction: Buffer.from(bytes).toString("base64"),
    expectedMessageSha256,
    expectedPayer: expectedPayer.publicKey.toBase58(),
  });
}

describe("signed Meteora transaction verification", () => {
  it("accepts untouched signed bytes for the prepared message", () => {
    const { transaction, expectedMessageSha256 } = preparedTransaction();
    const result = parse(signedBytes(transaction), expectedMessageSha256);
    expect(result.messageSha256).toBe(expectedMessageSha256);
    expect(result.feePayer).toBe(payer.publicKey.toBase58());
    expect(result.signatureCount).toBe(1);
  });

  it("rejects bytes whose message was altered after signing", () => {
    const { transaction, expectedMessageSha256 } = preparedTransaction();
    const bytes = Buffer.from(signedBytes(transaction));
    // The wire format is [signature count][signatures][message]; flip the
    // last byte, which lives inside the instruction data (the lamport amount).
    bytes[bytes.length - 1] ^= 0x01;
    expect(() => parse(bytes, expectedMessageSha256)).toThrow(
      "does not match the prepared message",
    );
  });

  it("rejects an altered message even when the attacker supplies its own hash", () => {
    const { transaction } = preparedTransaction();
    const bytes = Buffer.from(signedBytes(transaction));
    bytes[bytes.length - 1] ^= 0x01;
    const tamperedHash = createHash("sha256")
      .update(Transaction.from(bytes).serializeMessage())
      .digest("hex");
    // Message hash now "matches", so the signature check has to catch it.
    expect(() => parse(bytes, tamperedHash)).toThrow("missing a required signature");
  });

  it("rejects a corrupted signature over an unchanged message", () => {
    const { transaction, expectedMessageSha256 } = preparedTransaction();
    const bytes = Buffer.from(signedBytes(transaction));
    // Byte 0 is the compact-u16 signature count; bytes 1..64 are the signature.
    bytes[5] ^= 0xff;
    expect(() => parse(bytes, expectedMessageSha256)).toThrow(
      "missing a required signature",
    );
  });

  it("rejects an unsigned transaction with the right message", () => {
    const { transaction, expectedMessageSha256 } = preparedTransaction();
    const bytes = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    expect(() => parse(bytes, expectedMessageSha256)).toThrow(
      "missing a required signature",
    );
  });

  it("rejects a transaction signed by a different fee payer", () => {
    const { transaction, expectedMessageSha256 } = preparedTransaction();
    const other = Keypair.generate();
    expect(() => parse(signedBytes(transaction), expectedMessageSha256, other)).toThrow(
      "payer does not match the session",
    );
  });

  it("rejects a re-signed transaction for a different prepared message", () => {
    const { expectedMessageSha256 } = preparedTransaction();
    const substitute = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 999_999_999,
      }),
    );
    expect(() => parse(signedBytes(substitute), expectedMessageSha256)).toThrow(
      "does not match the prepared message",
    );
  });
});
