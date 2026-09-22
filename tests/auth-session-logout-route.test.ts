import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revokeCalls: [] as string[],
  revokeResult: "revoked" as "revoked" | "not_revocable" | "unavailable",
}));

vi.mock("../lib/auth/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth/server")>();
  return {
    ...actual,
    revokeAuthenticationSession: vi.fn(async (token: string) => {
      mocks.revokeCalls.push(token);
      return mocks.revokeResult;
    }),
  };
});

import { DELETE } from "../app/api/auth/session/route";
import { SESSION_COOKIE_NAME } from "../lib/auth/server";

function del(headers: Record<string, string>, body?: unknown) {
  return DELETE(
    new Request("http://localhost:3000/api/auth/session", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

describe("wallet logout route", () => {
  beforeEach(() => {
    mocks.revokeCalls = [];
    mocks.revokeResult = "revoked";
  });

  it("revokes exactly the session from the cookie and clears it", async () => {
    const response = await del({
      cookie: `${SESSION_COOKIE_NAME}=token-from-cookie`,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(mocks.revokeCalls).toEqual(["token-from-cookie"]);
    expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
  });

  it("never trusts a wallet address from the request body", async () => {
    const response = await del(
      { cookie: `${SESSION_COOKIE_NAME}=cookie-token` },
      { wallet: "attacker-supplied-wallet" },
    );

    expect(response.status).toBe(200);
    // Only the cookie token is revoked; body fields never reach revocation.
    expect(mocks.revokeCalls).toEqual(["cookie-token"]);
  });

  it("clears the cookie without a revocation call when no session exists", async () => {
    const response = await del({});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(mocks.revokeCalls).toEqual([]);
    expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
  });

  it("clears the cookie when the token needed no server-side revocation", async () => {
    mocks.revokeResult = "not_revocable";
    const response = await del({
      cookie: `${SESSION_COOKIE_NAME}=legacy-or-invalid-token`,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(mocks.revokeCalls).toEqual(["legacy-or-invalid-token"]);
    expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
  });

  it("keeps the cookie and returns 503 when revocation storage is unavailable", async () => {
    mocks.revokeResult = "unavailable";
    const response = await del({
      cookie: `${SESSION_COOKIE_NAME}=token-from-cookie`,
    });

    // The owner must be able to retry; clearing the cookie here would leave a
    // copied token valid again once storage recovers.
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "The session could not be ended on the server. Try again.",
    });
    expect(mocks.revokeCalls).toEqual(["token-from-cookie"]);
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      `${SESSION_COOKIE_NAME}=;`,
    );
  });
});
