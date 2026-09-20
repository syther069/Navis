import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as listAgents } from "../app/api/agents/route";
import { GET as getAgent } from "../app/api/agents/[slug]/route";

describe("persistent agent read routes", () => {
  it("requires a wallet session to list agents", async () => {
    const response = await listAgents(
      new NextRequest("http://localhost:3000/api/agents"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("requires a wallet session before resolving a detail slug", async () => {
    const response = await getAgent(
      new NextRequest("http://localhost:3000/api/agents/income-sentinel"),
      { params: Promise.resolve({ slug: "income-sentinel" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authenticate a connected wallet to inspect persistent agents.",
    });
  });
});
