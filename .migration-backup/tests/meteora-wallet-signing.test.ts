import type { Adapter } from "@solana/wallet-adapter-base";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

import { signMeteoraDevnetTransaction } from "@/lib/integrations/meteora/wallet-signing";

function fixture() {
  // Fresh, unfunded offline test keys. No RPC or browser wallet is used.
  const payer = Keypair.generate();
  const transaction = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1,
    }),
  );
  const account = {
    address: payer.publicKey.toBase58(),
    chains: ["solana:devnet"],
    features: ["solana:signTransaction"],
  };
  const sign = vi.fn(async (input: { transaction: Uint8Array }) => [
    { signedTransaction: input.transaction },
  ]);
  const genericSign = vi.fn();
  const wallet = {
    accounts: [account],
    chains: ["solana:devnet"],
    features: { "solana:signTransaction": { signTransaction: sign } },
  };
  const adapter = {
    publicKey: payer.publicKey,
    standard: true,
    wallet,
    signTransaction: genericSign,
  } as unknown as Adapter;
  const input = {
    adapter,
    transaction,
    cluster: "devnet",
    preparedCluster: "devnet",
  };
  return { input, account, wallet, sign, genericSign };
}

describe("Meteora explicit Devnet wallet approval", () => {
  it("passes the account, unchanged bytes and Devnet to the signing-only feature", async () => {
    const { input, account, sign, genericSign } = fixture();
    const result = await signMeteoraDevnetTransaction(input);
    expect(sign).toHaveBeenCalledExactlyOnceWith({
      account,
      chain: "solana:devnet",
      transaction: expect.any(Uint8Array),
    });
    expect(result.serializeMessage()).toEqual(input.transaction.serializeMessage());
    expect(genericSign).not.toHaveBeenCalled();
  });

  it.each(["cluster", "preparedCluster"] as const)(
    "blocks mainnet in %s before requesting approval",
    async (field) => {
      const { input, sign } = fixture();
      input[field] = "mainnet-beta";
      await expect(signMeteoraDevnetTransaction(input)).rejects.toThrow(
        "only for Devnet",
      );
      expect(sign).not.toHaveBeenCalled();
    },
  );

  it.each(["wallet", "account"] as const)(
    "fails closed when the %s does not support Devnet",
    async (target) => {
      const { input, wallet, account, sign } = fixture();
      (target === "wallet" ? wallet : account).chains = ["solana:mainnet"];
      await expect(signMeteoraDevnetTransaction(input)).rejects.toThrow(
        "Do not add real SOL",
      );
      expect(sign).not.toHaveBeenCalled();
    },
  );

  it("does not fall back to generic signing for a legacy adapter", async () => {
    const { input, genericSign } = fixture();
    input.adapter = {
      publicKey: input.adapter.publicKey,
      signTransaction: genericSign,
    } as unknown as Adapter;
    await expect(signMeteoraDevnetTransaction(input)).rejects.toThrow(
      "cannot explicitly select Devnet",
    );
    expect(genericSign).not.toHaveBeenCalled();
  });

  it("blocks a changed connected account before requesting approval", async () => {
    const { input, wallet, account, sign } = fixture();
    wallet.accounts = [
      { ...account, address: Keypair.generate().publicKey.toBase58() },
    ];
    await expect(signMeteoraDevnetTransaction(input)).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
  });

  it("blocks a transaction for a different payer", async () => {
    const { input, sign } = fixture();
    input.transaction.feePayer = Keypair.generate().publicKey;
    await expect(signMeteoraDevnetTransaction(input)).rejects.toThrow(
      "different wallet",
    );
    expect(sign).not.toHaveBeenCalled();
  });

  it("preserves wallet rejection without retrying", async () => {
    const { input, sign } = fixture();
    sign.mockRejectedValue(new Error("User rejected the request"));
    await expect(signMeteoraDevnetTransaction(input)).rejects.toThrow("User rejected");
    expect(sign).toHaveBeenCalledOnce();
  });

  it("rejects a wallet response that changes the prepared message", async () => {
    const { input, sign } = fixture();
    const other = fixture().input.transaction;
    sign.mockResolvedValue([
      {
        signedTransaction: other.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
      },
    ]);
    await expect(signMeteoraDevnetTransaction(input)).rejects.toThrow(
      "changed the prepared transaction",
    );
  });

  it("rejects a missing wallet response", async () => {
    const { input, sign } = fixture();
    sign.mockResolvedValue([]);
    await expect(signMeteoraDevnetTransaction(input)).rejects.toThrow(
      "invalid signed transaction",
    );
  });
});
