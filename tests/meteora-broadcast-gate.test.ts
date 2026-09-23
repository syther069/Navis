import { describe, expect, it } from "vitest";

import {
  isMeteoraBroadcastAvailable,
  METEORA_MAINNET_BROADCAST_BLOCK,
  meteoraBroadcastUnavailableReason,
  type MeteoraBroadcastCapability,
} from "../lib/integrations/meteora/broadcast-safety";

const releasedDevnet: MeteoraBroadcastCapability = {
  executionMode: "devnet",
  cluster: "devnet",
  devnetExecutionEnabled: true,
  solanaRpcConfigured: true,
};

describe("Meteora broadcast release gate", () => {
  it("allows explicitly enabled devnet with an RPC and no blocked reason", () => {
    expect(isMeteoraBroadcastAvailable(releasedDevnet)).toBe(true);
    expect(meteoraBroadcastUnavailableReason(releasedDevnet)).toBe("");
  });

  it("blocks demo mode even with the flag and RPC set", () => {
    const capability = { ...releasedDevnet, executionMode: "demo" as const };
    expect(isMeteoraBroadcastAvailable(capability)).toBe(false);
    expect(meteoraBroadcastUnavailableReason(capability)).toContain("demo mode");
  });

  it("blocks mainnet at code level even when mainnet execution is approved", () => {
    const capability: MeteoraBroadcastCapability = {
      executionMode: "mainnet",
      cluster: "mainnet-beta",
      devnetExecutionEnabled: true,
      solanaRpcConfigured: true,
    };
    expect(isMeteoraBroadcastAvailable(capability)).toBe(false);
    expect(meteoraBroadcastUnavailableReason(capability)).toBe(
      METEORA_MAINNET_BROADCAST_BLOCK,
    );
  });

  it("blocks a devnet mode deployment pointed at a mainnet cluster", () => {
    const capability: MeteoraBroadcastCapability = {
      ...releasedDevnet,
      cluster: "mainnet-beta",
    };
    expect(isMeteoraBroadcastAvailable(capability)).toBe(false);
    expect(meteoraBroadcastUnavailableReason(capability)).toBe(
      METEORA_MAINNET_BROADCAST_BLOCK,
    );
  });

  it("blocks devnet execution without the release flag", () => {
    const capability = { ...releasedDevnet, devnetExecutionEnabled: false };
    expect(isMeteoraBroadcastAvailable(capability)).toBe(false);
    expect(meteoraBroadcastUnavailableReason(capability)).toContain(
      "ENABLE_DEVNET_EXECUTION",
    );
  });

  it("blocks devnet execution without a configured RPC", () => {
    const capability = { ...releasedDevnet, solanaRpcConfigured: false };
    expect(isMeteoraBroadcastAvailable(capability)).toBe(false);
    expect(meteoraBroadcastUnavailableReason(capability)).toContain("SOLANA_RPC_URL");
  });
});
