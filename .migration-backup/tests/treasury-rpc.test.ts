import { describe, expect, it, vi } from "vitest";

import { SolanaRpcClient } from "../lib/integrations/solana/rpc";
import { readTreasuryBalances } from "../lib/integrations/solana/treasury";

const owner = "11111111111111111111111111111111";
const mint = "So11111111111111111111111111111111111111112";
const tokenAccount = "SysvarRent111111111111111111111111111111111";

function response(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
}

describe("treasury RPC reader", () => {
  it("preserves raw amounts, decimals, cluster, slot, and source", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(900))
      .mockResolvedValueOnce(response({ context: { slot: 901 }, value: 2_000_000_000 }))
      .mockResolvedValueOnce(
        response({
          context: { slot: 902 },
          value: [
            {
              pubkey: tokenAccount,
              account: {
                data: {
                  parsed: {
                    info: {
                      mint,
                      owner,
                      tokenAmount: { amount: "420000000000000", decimals: 6 },
                    },
                  },
                },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ context: { slot: 903 }, value: [] }));
    const client = new SolanaRpcClient(
      {
        endpoint: "https://rpc.example.test",
        cluster: "devnet",
        commitment: "finalized",
        timeoutMs: 500,
      },
      fetcher,
    );

    const result = await readTreasuryBalances(client, owner);

    expect(result).toMatchObject({
      owner,
      cluster: "devnet",
      commitment: "finalized",
      source: "solana_rpc",
    });
    expect(result.balances).toEqual([
      {
        kind: "native",
        rawAmount: "2000000000",
        decimals: 9,
        slot: BigInt(901),
      },
      {
        kind: "spl-token",
        mint,
        tokenAccount,
        rawAmount: "420000000000000",
        decimals: 6,
        slot: BigInt(902),
        program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      },
    ]);
    const bodies = fetcher.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(
      bodies.slice(1).every((body) => body.params.at(-1).minContextSlot === 900),
    ).toBe(true);
  });

  it("rejects a token-account owner mismatch", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(900))
      .mockResolvedValueOnce(response({ context: { slot: 901 }, value: 0 }))
      .mockResolvedValueOnce(
        response({
          context: { slot: 901 },
          value: [
            {
              pubkey: tokenAccount,
              account: {
                data: {
                  parsed: {
                    info: {
                      mint,
                      owner: "Vote111111111111111111111111111111111111111",
                      tokenAmount: { amount: "1", decimals: 6 },
                    },
                  },
                },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ context: { slot: 901 }, value: [] }));
    const client = new SolanaRpcClient(
      {
        endpoint: "https://rpc.example.test",
        cluster: "devnet",
        commitment: "finalized",
        timeoutMs: 500,
      },
      fetcher,
    );

    await expect(readTreasuryBalances(client, owner)).rejects.toThrow(
      "different owner",
    );
  });
});
