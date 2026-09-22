import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  env: {
    cluster: "devnet",
    executionMode: "devnet",
    enableDevnetExecution: true,
    enableMainnetExecution: false,
    solanaRpcUrl: "https://rpc.invalid",
    clawpumpApiKey: undefined,
    databaseUrl: undefined,
    sessionSecret: undefined,
  },
  available: vi.fn(() => false),
  reason: "Server gate blocked this deployment.",
}));

vi.mock("@/lib/env", () => ({ env: server.env }));
vi.mock("@/lib/integrations/meteora/broadcast-safety", () => ({
  isMeteoraBroadcastAvailable: server.available,
  METEORA_BROADCAST_UNAVAILABLE_REASON: server.reason,
}));
vi.mock("@/lib/integrations/prestocks/client", () => ({
  getPreStocksCatalogue: async () => ({ assets: [] }),
}));
vi.mock("@/lib/db/client", () => ({
  getDatabase: () => {
    throw new Error("Prop forwarding must not access a database.");
  },
}));
vi.mock("@/lib/services/clawpump-agents", () => ({}));
vi.mock("@/lib/services/clawpump-verification", () => ({}));
vi.mock("@/lib/services/launch-preflight", () => ({}));
vi.mock("@/lib/integrations/clawpump/server", () => ({}));
vi.mock("@/lib/auth/server", () => ({}));

import MarketLaunchPage from "../app/(workspace)/markets/launch/page";
import { MeteoraConfigPrepare } from "../components/markets/meteora-config-prepare";
import { MeteoraCurvePanel } from "../components/markets/meteora-curve-panel";

type Element = ReactElement<Record<string, unknown>>;

function findElement(
  node: ReactNode,
  matches: (element: Element) => boolean,
): Element | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, matches);
      if (found) return found;
    }
  } else if (isValidElement<Record<string, unknown>>(node)) {
    if (matches(node)) return node;
    return findElement(node.props.children as ReactNode, matches);
  }
}

describe("Meteora server-to-panel-to-form prop forwarding", () => {
  beforeEach(() => {
    server.available.mockReset();
    server.env.cluster = "devnet";
    server.env.executionMode = "devnet";
  });

  it.each([
    { label: "blocked devnet", cluster: "devnet", mode: "devnet", allowed: false },
    { label: "permitted devnet", cluster: "devnet", mode: "devnet", allowed: true },
    { label: "demo", cluster: "devnet", mode: "demo", allowed: false },
    {
      label: "mainnet",
      cluster: "mainnet-beta",
      mode: "mainnet",
      allowed: false,
    },
  ])("forwards the server values unchanged for $label", async (scenario) => {
    server.env.cluster = scenario.cluster;
    server.env.executionMode = scenario.mode;
    server.available.mockReturnValue(scenario.allowed);

    // Execute the real server page and its async Meteora section, without
    // rendering unrelated sponsor sections or connecting a wallet.
    const section = findElement(
      MarketLaunchPage(),
      (element) =>
        typeof element.type === "function" && element.type.name === "MeteoraSection",
    );
    expect(section).toBeDefined();
    const renderSection = section!.type as (
      props: Record<string, unknown>,
    ) => Promise<ReactElement<Parameters<typeof MeteoraCurvePanel>[0]>>;
    const panel = await renderSection(section!.props);
    expect(panel.type).toBe(MeteoraCurvePanel);
    expect(server.available).toHaveBeenCalledOnce();

    const expected = {
      cluster: scenario.cluster,
      broadcastAvailable: scenario.allowed,
      broadcastBlockedReason: server.reason,
    };
    expect(panel.props).toMatchObject(expected);
    const form = findElement(
      MeteoraCurvePanel(panel.props),
      (element) => element.type === MeteoraConfigPrepare,
    );
    expect(form?.props).toMatchObject(expected);
  });
});
