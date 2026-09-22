import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revokeCalls: [] as string[],
  revokeResult: true,
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
    mocks.revokeResult = true;
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

  it("still clears the cookie when revocation storage fails", async () => {
    mocks.revokeResult = false;
    const response = await del({
      cookie: `${SESSION_COOKIE_NAME}=token-from-cookie`,
    });

    // The failure is not exposed; the response shape is unchanged.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(mocks.revokeCalls).toEqual(["token-from-cookie"]);
  });
});
