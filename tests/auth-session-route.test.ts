import { describe, expect, it } from "vitest";

import { DELETE } from "../app/api/auth/session/route";
import { SESSION_COOKIE_NAME } from "../lib/auth/server";

describe("wallet session route", () => {
  it("rejects cross-site session deletion", async () => {
    const response = await DELETE(
      new Request("http://localhost:3000/api/auth/session", {
        method: "DELETE",
        headers: { origin: "https://evil.example" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Untrusted request origin.",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears the session cookie for trusted origins", async () => {
    const response = await DELETE(
      new Request("http://localhost:3000/api/auth/session", {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
