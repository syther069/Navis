import {
  deriveDbcPoolAddress,
  deriveTokenBadgeAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

import { MeteoraDbcClient } from "../lib/integrations/meteora/client";
import {
  getNavisMeteoraCurvePreview,
  getNavisMeteoraCurvePreviews,
  METEORA_DBC_PROGRAM_ID,
  validateNavisMeteoraConfig,
  WRAPPED_SOL_MINT,
} from "../lib/integrations/meteora/config";
import {
  METEORA_QUOTE_PROFILE_IDS,
  MeteoraQuoteProfileError,
  listMeteoraQuoteProfileAvailability,
  resolveMeteoraQuoteProfile,
} from "../lib/integrations/meteora/quote-profiles";

// Live PreStocks catalogue entries as captured on 2026-09-20 (mainnet Token-2022 mints).
const catalogue = [
  {
    symbol: "SPACEX",
    name: "SpaceX",
    contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
  },
  {
    symbol: "OPENAI",
    name: "OpenAI",
    contract_address: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
  },
];

describe("Meteora quote profile allowlist", () => {
  it("exposes exactly the two approved profiles", () => {
    expect([...METEORA_QUOTE_PROFILE_IDS]).toEqual([
      "navis-equity-v1",
      "navis-stock-exposure-v1",
    ]);
  });

  it("rejects unknown profile ids before touching any mint", () => {
    expect(() =>
      resolveMeteoraQuoteProfile({ profileId: "usdc-anything", cluster: "devnet" }),
    ).toThrowError(MeteoraQuoteProfileError);
    expect(() =>
      resolveMeteoraQuoteProfile({
        profileId: WRAPPED_SOL_MINT,
        cluster: "mainnet-beta",
      }),
    ).toThrow(/Unknown Meteora quote profile/);
  });

  it("resolves wrapped SOL for navis-equity-v1 on both clusters", () => {
    for (const cluster of ["devnet", "mainnet-beta"] as const) {
      const quote = resolveMeteoraQuoteProfile({
        profileId: "navis-equity-v1",
        cluster,
      });
      expect(quote.quoteMint).toBe(WRAPPED_SOL_MINT);
      expect(quote.quoteDecimals).toBe(9);
      expect(quote.cluster).toBe(cluster);
    }
  });

  it("marks the stock-paired profile unavailable on devnet with a reason, never a fake mint", () => {
    const availability = listMeteoraQuoteProfileAvailability("devnet");
    const stock = availability.find((p) => p.id === "navis-stock-exposure-v1");
    expect(stock?.available).toBe(false);
    expect(stock?.reason).toMatch(/mainnet only/);
    expect(stock?.reason).toMatch(/fake/);

    let error: unknown;
    try {
      resolveMeteoraQuoteProfile({
        profileId: "navis-stock-exposure-v1",
        cluster: "devnet",
        quoteSymbol: "SPACEX",
        prestocksCatalogue: catalogue,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(MeteoraQuoteProfileError);
    expect((error as MeteoraQuoteProfileError).status).toBe(409);
  });

  it("resolves the stock-paired profile only from the live PreStocks catalogue on mainnet", () => {
    const quote = resolveMeteoraQuoteProfile({
      profileId: "navis-stock-exposure-v1",
      cluster: "mainnet-beta",
      quoteSymbol: "spacex",
      prestocksCatalogue: catalogue,
    });
    expect(quote.quoteMint).toBe("PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh");
    expect(quote.quoteSymbol).toBe("SPACEX");
    expect(quote.quoteDecimals).toBe(9);

    expect(() =>
      resolveMeteoraQuoteProfile({
        profileId: "navis-stock-exposure-v1",
        cluster: "mainnet-beta",
        quoteSymbol: "TSLA",
        prestocksCatalogue: catalogue,
      }),
    ).toThrow(/not in the live catalogue/);
    expect(() =>
      resolveMeteoraQuoteProfile({
        profileId: "navis-stock-exposure-v1",
        cluster: "mainnet-beta",
        prestocksCatalogue: catalogue,
      }),
    ).toThrow(/needs a PreStocks symbol/);
    expect(() =>
      resolveMeteoraQuoteProfile({
        profileId: "navis-stock-exposure-v1",
        cluster: "mainnet-beta",
        quoteSymbol: "SPACEX",
        prestocksCatalogue: null,
      }),
    ).toThrow(/catalogue is unavailable/);
  });

  it("builds and validates SDK configs for both profiles", () => {
    const receiver = Keypair.generate().publicKey.toBase58();
    const sol = validateNavisMeteoraConfig(receiver, "navis-equity-v1");
    const stock = validateNavisMeteoraConfig(receiver, "navis-stock-exposure-v1");
    expect(sol.migrationQuoteThreshold.toString(10)).toBe("4828261560");
    expect(stock.migrationQuoteThreshold.gt(sol.migrationQuoteThreshold)).toBe(true);
    expect(stock.tokenDecimal).toBe(sol.tokenDecimal);
  });

  it("previews every profile with rationale and per-cluster availability", () => {
    const previews = getNavisMeteoraCurvePreviews("devnet");
    expect(previews.map((p) => p.profileId)).toEqual([...METEORA_QUOTE_PROFILE_IDS]);
    const stock = getNavisMeteoraCurvePreview("devnet", "navis-stock-exposure-v1");
    expect(stock.quoteMint).toBeNull();
    expect(stock.availability.available).toBe(false);
    expect(stock.rationale.issuerAndTreasury).toMatch(/PreStocks is the issuer/);
    expect(stock.pricing.initialMarketCapQuote).toBe(200);
    const mainnetStock = getNavisMeteoraCurvePreview(
      "mainnet-beta",
      "navis-stock-exposure-v1",
    );
    expect(mainnetStock.availability.status).toBe("gated");
    expect(mainnetStock.availability.reason).toMatch(/token badge/);
  });

  it("derives the pool address from the launch's non-SOL quote mint", async () => {
    const client = new MeteoraDbcClient({
      cluster: "mainnet-beta",
      endpoint: "http://127.0.0.1:8899",
    });
    const config = Keypair.generate().publicKey;
    const baseMint = Keypair.generate().publicKey;
    const payer = Keypair.generate().publicKey;
    const quoteMint = new PublicKey(catalogue[0]!.contract_address);
    vi.spyOn(client.connection, "getLatestBlockhash").mockResolvedValue({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 1,
    });
    const { Transaction } = await import("@solana/web3.js");
    vi.spyOn(client.sdk.creator, "createPool").mockResolvedValue(new Transaction());
    vi.spyOn(client.sdk.state, "getPoolConfig").mockResolvedValue({
      quoteMint,
    } as never);
    vi.spyOn(client.connection, "getAccountInfo").mockResolvedValue(null);

    const prepared = await client.prepareCreatePoolTransaction({
      config: config.toBase58(),
      baseMint: baseMint.toBase58(),
      quoteMint: quoteMint.toBase58(),
      payer: payer.toBase58(),
      name: "Navis Stock",
      symbol: "NVSX",
      uri: "https://example.com/nvsx.json",
    });

    expect(prepared.accounts.quoteMint).toBe(quoteMint.toBase58());
    expect(prepared.accounts.poolAddress).toBe(
      deriveDbcPoolAddress(quoteMint, baseMint, config).toBase58(),
    );
    expect(prepared.accounts.poolAddress).not.toBe(
      deriveDbcPoolAddress(
        new PublicKey(WRAPPED_SOL_MINT),
        baseMint,
        config,
      ).toBase58(),
    );
  });

  it("refuses to prepare a config when the quote profile was resolved for another cluster", async () => {
    const client = new MeteoraDbcClient({
      cluster: "devnet",
      endpoint: "http://127.0.0.1:8899",
    });
    const quote = resolveMeteoraQuoteProfile({
      profileId: "navis-stock-exposure-v1",
      cluster: "mainnet-beta",
      quoteSymbol: "OPENAI",
      prestocksCatalogue: catalogue,
    });
    await expect(
      client.prepareCreateConfigTransaction({
        config: Keypair.generate().publicKey.toBase58(),
        payer: Keypair.generate().publicKey.toBase58(),
        quote,
      }),
    ).rejects.toThrow(/different cluster/);
  });

  it("verifies a PreStocks quote mint onchain before building the config", async () => {
    const client = new MeteoraDbcClient({
      cluster: "mainnet-beta",
      endpoint: "http://127.0.0.1:8899",
    });
    const quote = resolveMeteoraQuoteProfile({
      profileId: "navis-stock-exposure-v1",
      cluster: "mainnet-beta",
      quoteSymbol: "OPENAI",
      prestocksCatalogue: catalogue,
    });
    const spy = vi.spyOn(client.connection, "getParsedAccountInfo");

    spy.mockResolvedValueOnce({ context: { slot: 1 }, value: null });
    await expect(client.verifyQuoteMint(quote)).rejects.toThrow(/does not exist/);

    spy.mockResolvedValueOnce({
      context: { slot: 2 },
      value: {
        owner: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
        executable: false,
        lamports: 1,
        data: {
          program: "spl-token-2022",
          parsed: { type: "mint", info: { decimals: 6 } },
          space: 0,
        },
      },
    });
    await expect(client.verifyQuoteMint(quote)).rejects.toThrow(/6 decimals/);

    spy.mockResolvedValueOnce({
      context: { slot: 3 },
      value: {
        owner: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
        executable: false,
        lamports: 1,
        data: {
          program: "spl-token-2022",
          parsed: { type: "mint", info: { decimals: 9 } },
          space: 0,
        },
      },
    });
    await expect(client.verifyQuoteMint(quote)).resolves.toMatchObject({
      tokenProgram: "spl-token-2022",
      decimals: 9,
      tokenBadge: null,
      verifiedAtSlot: 3,
    });
  });

  it("requires a Meteora token badge for Token-2022 quote mints with gated extensions", async () => {
    const client = new MeteoraDbcClient({
      cluster: "mainnet-beta",
      endpoint: "http://127.0.0.1:8899",
    });
    const quote = resolveMeteoraQuoteProfile({
      profileId: "navis-stock-exposure-v1",
      cluster: "mainnet-beta",
      quoteSymbol: "SPACEX",
      prestocksCatalogue: catalogue,
    });
    // Extension set observed on the live SPACEX mint on 2026-09-20.
    const mintAccount = {
      owner: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
      executable: false,
      lamports: 1,
      data: {
        program: "spl-token-2022",
        parsed: {
          type: "mint",
          info: {
            decimals: 9,
            extensions: [
              { extension: "permanentDelegate" },
              { extension: "transferHook" },
              { extension: "transferFeeConfig" },
              { extension: "metadataPointer" },
              { extension: "tokenMetadata" },
            ],
          },
        },
        space: 0,
      },
    };
    vi.spyOn(client.connection, "getParsedAccountInfo").mockResolvedValue({
      context: { slot: 9 },
      value: mintAccount,
    });
    const badgeSpy = vi.spyOn(client.connection, "getAccountInfo");
    const badgeAddress = deriveTokenBadgeAddress(new PublicKey(quote.quoteMint));

    badgeSpy.mockResolvedValueOnce(null);
    await expect(client.verifyQuoteMint(quote)).rejects.toThrow(
      /has not issued a DBC token badge/,
    );

    badgeSpy.mockResolvedValueOnce({
      owner: new PublicKey(METEORA_DBC_PROGRAM_ID),
      executable: false,
      lamports: 1,
      data: Buffer.alloc(0),
    });
    await expect(client.verifyQuoteMint(quote)).resolves.toMatchObject({
      tokenBadge: badgeAddress.toBase58(),
      extensions: expect.arrayContaining(["permanentDelegate", "transferHook"]),
    });
  });
});
