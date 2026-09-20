"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

import type { SolanaCluster } from "@/lib/env-core";

const PUBLIC_RPC_ENDPOINTS: Record<SolanaCluster, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

export function SolanaWalletProvider({
  children,
  cluster,
}: {
  children: React.ReactNode;
  cluster: SolanaCluster;
}) {
  const endpoint = useMemo(() => PUBLIC_RPC_ENDPOINTS[cluster], [cluster]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
