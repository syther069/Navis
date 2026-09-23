import { createHash, randomBytes } from "node:crypto";

import bs58 from "bs58";
import nacl from "tweetnacl";
import { z } from "zod";

export const AUTH_CHALLENGE_TTL_MS = 5 * 60 * 1_000;
export const AUTH_SESSION_TTL_SECONDS = 8 * 60 * 60;

export class AuthenticationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "challenge_not_found"
      | "challenge_expired"
      | "challenge_replayed"
      | "challenge_mismatch"
      | "invalid_signature",
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export const walletSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      try {
        return bs58.decode(value).length === nacl.sign.publicKeyLength;
      } catch {
        return false;
      }
    },
    { message: "A valid Solana wallet address is required." },
  );

export const challengeRequestSchema = z.object({
  wallet: walletSchema,
});

export const verificationRequestSchema = z.object({
  challengeId: z.uuid(),
  wallet: walletSchema,
  nonce: z.string().min(20).max(200),
  signature: z.string().min(40).max(200),
});

export type SignInMessageInput = Readonly<{
  domain: string;
  wallet: string;
  statement: string;
  uri: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
  cluster: "devnet" | "mainnet-beta";
}>;

export function createAuthNonce() {
  // SIWS nonces must be alphanumeric. Base64url can include "-" or "_",
  // which strict wallets reject before showing a sign-in prompt.
  return randomBytes(24).toString("hex");
}

export function hashAuthNonce(nonce: string) {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

export function buildSignInMessage(input: SignInMessageInput) {
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.wallet,
    "",
    input.statement,
    "",
    `URI: ${input.uri}`,
    "Version: 1",
    `Chain ID: ${input.cluster}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expiresAt.toISOString()}`,
  ].join("\n");
}

export function verifyWalletSignature(input: {
  message: string;
  signature: string;
  wallet: string;
}) {
  try {
    const publicKey = bs58.decode(input.wallet);
    const signature = bs58.decode(input.signature);

    if (
      publicKey.length !== nacl.sign.publicKeyLength ||
      signature.length !== nacl.sign.signatureLength
    ) {
      return false;
    }

    return nacl.sign.detached.verify(
      new TextEncoder().encode(input.message),
      signature,
      publicKey,
    );
  } catch {
    return false;
  }
}

export function assertChallengeUsable(
  challenge: {
    wallet: string;
    nonceHash: string;
    domain: string;
    uri: string;
    expiresAt: Date;
    usedAt: Date | null;
  },
  input: {
    wallet: string;
    nonce: string;
    expectedDomain: string;
    expectedUri: string;
    now: Date;
  },
) {
  if (challenge.usedAt) {
    throw new AuthenticationError(
      "Authentication challenge was already used.",
      "challenge_replayed",
    );
  }
  if (challenge.expiresAt.getTime() <= input.now.getTime()) {
    throw new AuthenticationError(
      "Authentication challenge expired.",
      "challenge_expired",
    );
  }
  if (
    challenge.wallet !== input.wallet ||
    challenge.domain !== input.expectedDomain ||
    challenge.uri !== input.expectedUri ||
    challenge.nonceHash !== hashAuthNonce(input.nonce)
  ) {
    throw new AuthenticationError(
      "Authentication challenge does not match.",
      "challenge_mismatch",
    );
  }
}
