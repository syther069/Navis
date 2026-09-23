import { describe, expect, it, vi } from "vitest";

import { MeteoraDbcClient } from "../lib/integrations/meteora/client";
import { MeteoraClusterError } from "../lib/integrations/meteora/errors";
import { resolveMeteoraQuoteProfile } from "../lib/integrations/meteora/quote-profiles";
import { SOLANA_GENESIS_HASHES } from "../lib/integrations/solana/config";

const address = "11111111111111111111111111111111";
const signed = {
  serializedTransaction: "not-decoded-before-cluster-verification",
  expectedMessageSha256: "hash",
  expectedPayer: address,
};
const operations: [string, (client: MeteoraDbcClient) => Promise<unknown>][] = [
  [
    "prepare config",
    (client) =>
      client.prepareCreateConfigTransaction({
        config: address,
        payer: address,
        quote: resolveMeteoraQuoteProfile({
          profileId: "navis-equity-v1",
          cluster: "devnet",
        }),
      }),
  ],
  [
    "prepare pool",
    (client) =>
      client.prepareCreatePoolTransaction({
        config: address,
        baseMint: address,
        quoteMint: address,
        payer: address,
        name: "Test",
        symbol: "TEST",
        uri: "https://example.com/token.json",
      }),
  ],
  ["simulate config", (client) => client.simulateSignedConfigTransaction(signed)],
  ["simulate pool", (client) => client.simulateSignedPoolTransaction(signed)],
  ["send config", (client) => client.submitSignedConfigTransaction(signed)],
  ["send pool", (client) => client.submitSignedPoolTransaction(signed)],
];

describe("Meteora transaction RPC cluster binding", () => {
  it.each(operations)(
    "%s fails closed before transaction work on wrong or unavailable RPC",
    async (_name, operation) => {
      const client = new MeteoraDbcClient({
        cluster: "devnet",
        endpoint: "http://127.0.0.1:8899",
      });
      const genesis = vi.spyOn(client.connection, "getGenesisHash");
      const forbidden = [
        vi.spyOn(client.connection, "getLatestBlockhash"),
        vi.spyOn(client.connection, "simulateTransaction"),
        vi.spyOn(client.connection, "sendRawTransaction"),
        vi.spyOn(client.sdk.partner, "createConfig"),
        vi.spyOn(client.sdk.creator, "createPool"),
        vi.spyOn(client.sdk.state, "getPoolConfig"),
        vi.spyOn(client, "parseVerifiedSignedTransaction"),
      ];
      genesis.mockResolvedValue(SOLANA_GENESIS_HASHES["mainnet-beta"]);
      await expect(operation(client)).rejects.toThrow(MeteoraClusterError);
      genesis.mockRejectedValue(new Error("https://rpc.test/?api-key=secret"));
      await expect(operation(client)).rejects.toThrow(
        "Meteora RPC cluster verification failed. No transaction operation was performed.",
      );
      for (const spy of forbidden) expect(spy).not.toHaveBeenCalled();
      expect(genesis).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["devnet", "mainnet-beta"] as const)(
    "accepts only the official %s genesis and does not cache success",
    async (cluster) => {
      const client = new MeteoraDbcClient({
        cluster,
        endpoint: "http://127.0.0.1:8899",
      });
      const genesis = vi
        .spyOn(client.connection, "getGenesisHash")
        .mockResolvedValueOnce(SOLANA_GENESIS_HASHES[cluster])
        .mockResolvedValueOnce("unknown-genesis");
      await expect(client.assertRpcCluster()).resolves.toBeUndefined();
      await expect(client.assertRpcCluster()).rejects.toThrow(MeteoraClusterError);
      expect(genesis).toHaveBeenCalledTimes(2);
    },
  );
});
