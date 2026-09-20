import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ClawPumpClient, ClawPumpError } from "../lib/integrations/clawpump/client";

const meta = {
  timestamp: "2026-09-17T00:00:00.000Z",
  requestId: "request-123",
};

describe("ClawPump client", () => {
  it("validates live pair mints, decimals, fee bounds, and refresh metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          assets: [
            {
              mint: "So11111111111111111111111111111111111111112",
              symbol: "SOL",
              name: "Wrapped SOL",
              decimals: 9,
              imageUrl: null,
            },
          ],
          creatorFeeBps: { min: 100, max: 300, default: 100 },
          meta,
        }),
        { status: 200 },
      ),
    );
    const client = new ClawPumpClient({ apiKey: "cpk_test-secret", fetcher });

    await expect(client.getPumpPairs()).resolves.toMatchObject({
      assets: [{ symbol: "SOL", decimals: 9 }],
      creatorFeeBps: { min: 100, max: 300, default: 100 },
      meta,
    });
  });

  it("uses only the apex v1 API and keeps bearer auth server-side", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ value: "ok", meta }), { status: 200 }),
      );
    const client = new ClawPumpClient({ apiKey: "cpk_test-secret", fetcher });

    await expect(
      client.request("/health-fixture", {
        schema: z.object({
          value: z.literal("ok"),
          meta: z.object({ requestId: z.string() }),
        }),
      }),
    ).resolves.toMatchObject({ value: "ok" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://clawpump.tech/api/v1/health-fixture",
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          authorization: "Bearer cpk_test-secret",
        }),
      }),
    );
  });

  it.each([
    [401, "unauthorized"],
    [402, "payment_required"],
    [403, "forbidden"],
    [422, "validation"],
    [429, "rate_limited"],
    [500, "upstream"],
  ] as const)(
    "maps HTTP %s to %s with the provider request id",
    async (status, kind) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: "Safe provider message", meta }), {
          status,
        }),
      );
      const client = new ClawPumpClient({ apiKey: "cpk_test-secret", fetcher });

      const error = await client
        .request("/fixture", { schema: z.unknown() })
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ClawPumpError);
      expect(error).toMatchObject({ kind, status, requestId: "request-123" });
      expect(String(error)).not.toContain("cpk_test-secret");
    },
  );

  it("rejects cross-host and absolute paths before sending credentials", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new ClawPumpClient({ apiKey: "cpk_test-secret", fetcher });

    await expect(
      client.request("https://agents.clawpump.tech/api/v1/agents", {
        schema: z.unknown(),
      }),
    ).rejects.toThrow("relative to the supported v1 apex API");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects undocumented response shapes", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ unexpected: true }), { status: 200 }),
      );
    const client = new ClawPumpClient({ apiKey: "cpk_test-secret", fetcher });

    await expect(
      client.request("/fixture", { schema: z.object({ expected: z.literal(true) }) }),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("binds self-funded preflight to the exact pair, fee, payer, and quote token", async () => {
    const wallet = "11111111111111111111111111111111";
    const quoteMint = "So11111111111111111111111111111111111111112";
    const payTo = "49CfXAr58cCTGJnYsbm16fEsE5JRpdR8QQP8E1ZinGCq";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment: {
            method: "sol",
            amountLamports: 7_510_000,
            amountSol: 0.00751,
            payTo,
            payFrom: wallet,
            validForSeconds: 900,
            breakdown: { creationFeeSol: 0.00751, devBuySol: 0 },
          },
          retryWith: {
            txSignature: "<payment-signature>",
            preflightToken: "signed-preflight-token",
          },
          meta,
        }),
        { status: 200 },
      ),
    );
    const client = new ClawPumpClient({ apiKey: "cpk_test-secret", fetcher });

    const result = await client.preflightSelfFundedLaunch({
      name: "Navis Equity",
      symbol: "NVEQ",
      description: "A bounded test launch for the Navis preflight contract.",
      imageUrl: "https://example.com/navis.png",
      agentId: "agent-123",
      agentName: "Atlas",
      walletAddress: wallet,
      pumpQuoteMint: quoteMint,
      pumpCreatorFeeBps: 250,
      devBuySol: 0,
      preflight: true,
    });

    expect(result).toMatchObject({
      payment: { amountLamports: 7_510_000, payFrom: wallet, payTo },
      retryWith: { preflightToken: "signed-preflight-token" },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://clawpump.tech/api/v1/launch/self-funded",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(`"pumpQuoteMint":"${quoteMint}"`),
      }),
    );
  });
});
