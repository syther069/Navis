import { WorkspaceShell } from "@/components/workspace-shell";
import { SolanaWalletProvider } from "@/components/wallet/solana-wallet-provider";
import { getPublicCapabilities } from "@/lib/env";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const capabilities = getPublicCapabilities();

  return (
    <SolanaWalletProvider cluster={capabilities.cluster}>
      <WorkspaceShell capabilities={capabilities}>{children}</WorkspaceShell>
    </SolanaWalletProvider>
  );
}
