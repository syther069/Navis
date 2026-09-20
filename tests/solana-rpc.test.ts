import { describe, expect, it, vi } from "vitest";

import {
  SOLANA_GENESIS_HASHES,
  createSolanaExplorerUrl,
} from "../lib/integrations/solana/config";
import { SolanaRpcClient } from "../lib/integrations/solana/rpc";

function rpcResponse(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Solana RPC boundary", () => {
  it("keeps explorer URLs explicitly cluster-qualified", () => {
    expect(createSolanaExplorerUrl("tx", "signature", "devnet")).toBe(
      "https://explorer.solana.com/tx/signature?cluster=devnet",
    );
    expect(createSolanaExplorerUrl("address", "wallet", "mainnet-beta")).toBe(
      "https://explorer.solana.com/address/wallet",
    );
  });

  it("reports a healthy endpoint with its finalized slot", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(rpcResponse("ok"))
      .mockResolvedValueOnce(rpcResponse(SOLANA_GENESIS_HASHES.devnet))
      .mockResolvedValueOnce(rpcResponse(1234));
    const client = new SolanaRpcClient(
      {
        endpoint: "https://rpc.example.test",
        cluster: "devnet",
        commitment: "finalized",
        timeoutMs: 500,
      },
      fetcher,
    );

    await expect(client.checkHealth()).resolves.toMatchObject({
      status: "healthy",
      cluster: "devnet",
      commitment: "finalized",
      slot: BigInt(1234),
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("fails closed when the endpoint serves a different cluster", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(rpcResponse("ok"))
      .mockResolvedValueOnce(rpcResponse(SOLANA_GENESIS_HASHES["mainnet-beta"]))
      .mockResolvedValueOnce(rpcResponse(1234));
    const client = new SolanaRpcClient(
      {
        endpoint: "https://rpc.example.test",
        cluster: "devnet",
        commitment: "finalized",
        timeoutMs: 500,
      },
      fetcher,
    );

    await expect(client.checkHealth()).resolves.toMatchObject({
      status: "cluster_mismatch",
      safeError: "The RPC genesis hash does not match the configured cluster.",
    });
  });

  it("reports an honest unavailable state without making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new SolanaRpcClient(
      {
        cluster: "devnet",
        commitment: "finalized",
        timeoutMs: 500,
      },
      fetcher,
    );

    await expect(client.checkHealth()).resolves.toMatchObject({
      status: "not_configured",
      cluster: "devnet",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads signature status and finalized transaction evidence", async () => {
    const signature = "5".repeat(64);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 1235 },
          value: [
            {
              slot: 1234,
              confirmations: null,
              err: null,
              confirmationStatus: "finalized",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        rpcResponse({
          slot: 1234,
          blockTime: 1_789_000_000,
          meta: {
            err: null,
            fee: 5000,
            preBalances: [10000],
            postBalances: [5000],
            preTokenBalances: [],
            postTokenBalances: [],
          },
        }),
      );
    const client = new SolanaRpcClient(
      {
        endpoint: "https://rpc.example.test",
        cluster: "devnet",
        commitment: "finalized",
        timeoutMs: 500,
      },
      fetcher,
    );

    await expect(client.getSignatureStatus(signature)).resolves.toMatchObject({
      contextSlot: BigInt(1235),
      status: { slot: 1234, confirmationStatus: "finalized", err: null },
    });
    await expect(client.getTransactionEvidence(signature)).resolves.toMatchObject({
      slot: 1234,
      meta: { fee: 5000 },
    });
  });
});
