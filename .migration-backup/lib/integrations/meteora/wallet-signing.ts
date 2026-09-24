import type { Adapter } from "@solana/wallet-adapter-base";
import { Transaction } from "@solana/web3.js";

/**
 * Request a wallet approval with an explicit chain. The generic adapter's
 * signTransaction method omits the chain, allowing wallets to assume mainnet.
 * This only signs; simulation and broadcasting remain separate server steps.
 */
export async function signMeteoraDevnetTransaction({
  adapter,
  transaction,
  cluster,
  preparedCluster,
}: {
  adapter: Adapter | null;
  transaction: Transaction;
  cluster: string;
  preparedCluster: string;
}): Promise<Transaction> {
  if (cluster !== "devnet" || preparedCluster !== "devnet") {
    throw new Error("Meteora wallet signing is enabled only for Devnet.");
  }
  if (!adapter?.publicKey || !("standard" in adapter) || !adapter.standard) {
    throw new Error(
      "This wallet cannot explicitly select Devnet for signing. Use a Wallet Standard wallet with Solana Devnet support.",
    );
  }
  const wallet = adapter.wallet;
  const account = wallet.accounts.find(
    (candidate) => candidate.address === adapter.publicKey!.toBase58(),
  );
  const chain = "solana:devnet";
  const featureName = "solana:signTransaction";
  if (
    !wallet.chains.includes(chain) ||
    !account?.chains.includes(chain) ||
    !account.features.includes(featureName)
  ) {
    throw new Error(
      "Your wallet does not advertise Solana Devnet signing for this account. Enable Devnet in your wallet or use a Devnet-compatible wallet. Do not add real SOL.",
    );
  }
  if (!transaction.feePayer?.equals(adapter.publicKey)) {
    throw new Error("The prepared transaction belongs to a different wallet.");
  }
  const feature =
    featureName in wallet.features ? wallet.features[featureName] : undefined;
  if (
    !feature ||
    typeof feature !== "object" ||
    !("signTransaction" in feature) ||
    typeof feature.signTransaction !== "function"
  ) {
    throw new Error("This wallet does not support transaction signing.");
  }
  const message = transaction.serializeMessage();
  const result: unknown = await feature.signTransaction({
    account,
    chain,
    transaction: new Uint8Array(
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
    ),
  });
  if (
    !Array.isArray(result) ||
    result.length !== 1 ||
    !(result[0]?.signedTransaction instanceof Uint8Array)
  ) {
    throw new Error("The wallet returned an invalid signed transaction.");
  }
  const signed = Transaction.from(result[0].signedTransaction);
  const signedMessage = signed.serializeMessage();
  if (
    message.length !== signedMessage.length ||
    !message.every((byte, index) => byte === signedMessage[index])
  ) {
    throw new Error("The wallet changed the prepared transaction. Nothing was sent.");
  }
  return signed;
}
