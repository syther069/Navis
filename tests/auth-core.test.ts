import bs58 from "bs58";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  assertChallengeUsable,
  buildSignInMessage,
  hashAuthNonce,
  verifyWalletSignature,
  walletSchema,
} from "../lib/auth/core";

const issuedAt = new Date("2026-09-17T08:00:00.000Z");
const expiresAt = new Date("2026-09-17T08:05:00.000Z");

describe("wallet authentication primitives", () => {
  it("builds a domain, nonce, cluster, and expiry-bound message", () => {
    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const message = buildSignInMessage({
      domain: "navis.example",
      wallet,
      statement: "Authenticate to Navis.",
      uri: "https://navis.example",
      nonce: "nonce-with-enough-entropy",
      issuedAt,
      expiresAt,
      cluster: "devnet",
    });

    expect(message).toContain("navis.example wants you to sign in");
    expect(message).toContain(`Nonce: nonce-with-enough-entropy`);
    expect(message).toContain("Chain ID: devnet");
    expect(message).toContain(`Expiration Time: ${expiresAt.toISOString()}`);
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
