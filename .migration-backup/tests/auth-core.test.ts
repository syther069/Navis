import bs58 from "bs58";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  assertChallengeUsable,
  buildSignInMessage,
  createAuthNonce,
  hashAuthNonce,
  verifyWalletSignature,
  walletSchema,
} from "../lib/auth/core";

const issuedAt = new Date("2026-09-17T08:00:00.000Z");
const expiresAt = new Date("2026-09-17T08:05:00.000Z");

describe("wallet authentication primitives", () => {
  it("generates SIWS-compatible alphanumeric nonces with 192 bits of entropy", () => {
    const nonces = Array.from({ length: 64 }, () => createAuthNonce());
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[a-f0-9]{48}$/);
      expect(Buffer.from(nonce, "hex")).toHaveLength(24);
    }
    expect(new Set(nonces).size).toBe(nonces.length);
  });

  it("builds a domain, nonce, cluster, and expiry-bound message", () => {
    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const nonce = createAuthNonce();
    const message = buildSignInMessage({
      domain: "navis.example",
      wallet,
      statement: "Authenticate to Navis.",
      uri: "https://navis.example",
      nonce,
      issuedAt,
      expiresAt,
      cluster: "devnet",
    });

    expect(message).toBe(
      [
        "navis.example wants you to sign in with your Solana account:",
        wallet,
        "",
        "Authenticate to Navis.",
        "",
        "URI: https://navis.example",
        "Version: 1",
        "Chain ID: devnet",
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt.toISOString()}`,
        `Expiration Time: ${expiresAt.toISOString()}`,
      ].join("\n"),
    );
    const signature = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey),
    );
    expect(verifyWalletSignature({ message, signature, wallet })).toBe(true);
    expect(
      verifyWalletSignature({
        message: message.replace("Chain ID: devnet", "Chain ID: mainnet"),
        signature,
        wallet,
      }),
    ).toBe(false);
  });

  it("accepts the matching detached signature and rejects message tampering", () => {
    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const message = "Navis authentication challenge";
    const signature = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey),
    );

    expect(verifyWalletSignature({ message, signature, wallet })).toBe(true);
    expect(verifyWalletSignature({ message: `${message}.`, signature, wallet })).toBe(
      false,
    );
  });

  it("validates Solana public keys and hashes nonce values deterministically", () => {
    const wallet = bs58.encode(nacl.sign.keyPair().publicKey);
    expect(walletSchema.safeParse(wallet).success).toBe(true);
    expect(walletSchema.safeParse("not-a-wallet").success).toBe(false);
    expect(hashAuthNonce("nonce")).toBe(hashAuthNonce("nonce"));
    expect(hashAuthNonce("nonce")).not.toBe(hashAuthNonce("other"));
  });

  it("rejects replayed and expired challenges", () => {
    const base = {
      wallet: bs58.encode(nacl.sign.keyPair().publicKey),
      nonceHash: hashAuthNonce("nonce-with-enough-entropy"),
      domain: "navis.example",
      uri: "https://navis.example",
      expiresAt,
      usedAt: null,
    };
    const input = {
      wallet: base.wallet,
      nonce: "nonce-with-enough-entropy",
      expectedDomain: base.domain,
      expectedUri: base.uri,
      now: issuedAt,
    };

    expect(() =>
      assertChallengeUsable({ ...base, usedAt: issuedAt }, input),
    ).toThrowError(
      expect.objectContaining<Partial<AuthenticationError>>({
        code: "challenge_replayed",
      }),
    );
    expect(() =>
      assertChallengeUsable({ ...base, expiresAt: issuedAt }, input),
    ).toThrowError(
      expect.objectContaining<Partial<AuthenticationError>>({
        code: "challenge_expired",
      }),
    );
  });

  it("rejects wrong domain, nonce, wallet, and signing key", () => {
    const keypair = nacl.sign.keyPair();
    const otherKeypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const nonce = "nonce-with-enough-entropy";
    const challenge = {
      wallet,
      nonceHash: hashAuthNonce(nonce),
      domain: "navis.example",
      uri: "https://navis.example",
      expiresAt,
      usedAt: null,
    };
    const validInput = {
      wallet,
      nonce,
      expectedDomain: "navis.example",
      expectedUri: "https://navis.example",
      now: issuedAt,
    };

    expect(() =>
      assertChallengeUsable(challenge, {
        ...validInput,
        expectedDomain: "evil.example",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AuthenticationError>>({
        code: "challenge_mismatch",
      }),
    );
    expect(() =>
      assertChallengeUsable(challenge, {
        ...validInput,
        nonce: "different-nonce-value",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AuthenticationError>>({
        code: "challenge_mismatch",
      }),
    );
    expect(() =>
      assertChallengeUsable(challenge, {
        ...validInput,
        wallet: bs58.encode(otherKeypair.publicKey),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AuthenticationError>>({
        code: "challenge_mismatch",
      }),
    );

    const message = "bound authentication message";
    const wrongSignature = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(message), otherKeypair.secretKey),
    );
    expect(verifyWalletSignature({ message, signature: wrongSignature, wallet })).toBe(
      false,
    );
  });
});
