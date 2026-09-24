import type { SolanaCluster } from "../../domain";

export type SolanaCommitment = "confirmed" | "finalized";

export type SolanaRpcConfig = Readonly<{
  cluster: SolanaCluster;
  endpoint?: string;
  commitment: SolanaCommitment;
  timeoutMs: number;
}>;

export const SOLANA_GENESIS_HASHES: Record<SolanaCluster, string> = {
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};

export type ExplorerEntity = "address" | "tx" | "block";

export function createSolanaExplorerUrl(
  entity: ExplorerEntity,
  value: string | number | bigint,
  cluster: SolanaCluster,
) {
  const path = entity === "tx" ? "tx" : entity;
  const url = new URL(`https://explorer.solana.com/${path}/${String(value)}`);
  if (cluster === "devnet") url.searchParams.set("cluster", "devnet");
  return url.toString();
}
