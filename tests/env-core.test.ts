import { describe, expect, it } from "vitest";

import { parseEnvironment, toPublicCapabilities } from "../lib/env-core";

describe("Navis environment safety", () => {
  it("uses the runtime preview host only in development", () => {
    const development = parseEnvironment({
      NODE_ENV: "development",
      REPLIT_DEV_DOMAIN: "navis-preview.replit.dev",
    });
    expect(development.appUrl).toBe("https://navis-preview.replit.dev");
    expect(development.appOriginConfigured).toBe(true);
    const production = parseEnvironment({
      NODE_ENV: "production",
      REPLIT_DEV_DOMAIN: "navis-preview.replit.dev",
      SESSION_SECRET: "test-secret-that-is-at-least-32-characters",
    });
    expect(production.appUrl).toBe("http://localhost:3000");
    expect(production.appOriginConfigured).toBe(false);
    expect(toPublicCapabilities(production).walletAuthenticationConfigured).toBe(false);
  });

  it("requires a configured HTTPS production origin for wallet sessions", () => {
    const production = parseEnvironment({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://navis.example",
      SESSION_SECRET: "test-secret-that-is-at-least-32-characters",
    });
    expect(production.appOriginConfigured).toBe(true);
    expect(toPublicCapabilities(production).walletAuthenticationConfigured).toBe(true);
    expect(
      parseEnvironment({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://navis.example",
      }).appOriginConfigured,
    ).toBe(false);
  });

  it("defaults to a locked demo configuration", () => {
    const env = parseEnvironment({});
    const capabilities = toPublicCapabilities(env);

    expect(capabilities).toMatchObject({
      mode: "demo",
      cluster: "devnet",
      demoAvailable: true,
      devnetExecutionAvailable: false,
      mainnetExecutionAvailable: false,
      clawpumpConfigured: false,
      aiConfigured: true,
    });
  });

  it("rejects mainnet mode without an explicit execution flag", () => {
    expect(() =>
      parseEnvironment({
        NAVIS_EXECUTION_MODE: "mainnet",
        NEXT_PUBLIC_SOLANA_CLUSTER: "mainnet-beta",
      }),
    ).toThrow("NAVIS_EXECUTION_MODE=mainnet requires ENABLE_MAINNET_EXECUTION=true");
  });

  it("rejects mainnet mode until the release checklist is approved", () => {
    expect(() =>
      parseEnvironment({
        NAVIS_EXECUTION_MODE: "mainnet",
        NEXT_PUBLIC_SOLANA_CLUSTER: "mainnet-beta",
        ENABLE_MAINNET_EXECUTION: "true",
        SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
      }),
    ).toThrow("MAINNET_RELEASE_APPROVED=true");
  });

  it("requires an RPC endpoint when devnet execution is enabled", () => {
    expect(() =>
      parseEnvironment({
        NAVIS_EXECUTION_MODE: "devnet",
        NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
        ENABLE_DEVNET_EXECUTION: "true",
      }),
    ).toThrow("SOLANA_RPC_URL is required whenever onchain execution is enabled");
  });

  it("accepts a fully gated devnet execution configuration", () => {
    const env = parseEnvironment({
      NAVIS_EXECUTION_MODE: "devnet",
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      ENABLE_DEMO_MODE: "false",
      ENABLE_DEVNET_EXECUTION: "true",
      SOLANA_RPC_URL: "https://api.devnet.solana.com",
    });

    expect(toPublicCapabilities(env).devnetExecutionAvailable).toBe(true);
  });

  it("accepts mainnet only with execution, RPC, cluster, and release approval", () => {
    const env = parseEnvironment({
      NAVIS_EXECUTION_MODE: "mainnet",
      NEXT_PUBLIC_SOLANA_CLUSTER: "mainnet-beta",
      ENABLE_MAINNET_EXECUTION: "true",
      MAINNET_RELEASE_APPROVED: "true",
      SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
    });

    expect(toPublicCapabilities(env).mainnetExecutionAvailable).toBe(true);
  });

  it("rejects malformed sponsor keys and short session secrets", () => {
    expect(() =>
      parseEnvironment({
        CLAWPUMP_API_KEY: "not-a-clawpump-key",
        SESSION_SECRET: "too-short",
      }),
    ).toThrow(/CLAWPUMP_API_KEY must start with cpk_/);
  });

  it("requires a key when the OpenAI provider is selected", () => {
    expect(() => parseEnvironment({ AI_PROVIDER: "openai" })).toThrow(
      "AI_PROVIDER=openai requires OPENAI_API_KEY",
    );
  });

  it("requires an explicit model when the OpenAI provider is selected", () => {
    expect(() =>
      parseEnvironment({ AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key" }),
    ).toThrow("AI_PROVIDER=openai requires OPENAI_MODEL");
  });
});
