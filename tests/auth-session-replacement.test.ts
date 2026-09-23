import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revoke: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { appUrl: "https://navis.example", databaseUrl: undefined },
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  allowMutationRequest: () => true,
  clientIdentifier: () => "test",
}));
vi.mock("@/lib/auth/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth/server")>();
  return {
    ...actual,
    verifyAuthenticationChallenge: mocks.verify,
    revokeAuthenticationSession: mocks.revoke,
  };
});

import { POST } from "../app/api/auth/verify/route";
import { AuthenticationError } from "../lib/auth/core";

function request(cookie = "navis_session=old-session") {
  return new Request("https://navis.example/api/auth/verify", {
    method: "POST",
    headers: {
      origin: "https://navis.example",
      cookie,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      challengeId: "11111111-1111-4111-8111-111111111111",
      wallet: "So11111111111111111111111111111111111111112",
      nonce: "a".repeat(32),
      signature: "b".repeat(88),
    }),
  });
}

describe("session replacement preserves the previous revocation path", () => {
  beforeEach(() => {
    mocks.revoke.mockReset().mockResolvedValue("revoked");
    mocks.verify.mockReset().mockResolvedValue({
      user: { wallet: "So11111111111111111111111111111111111111112" },
      token: "new-session",
    });
  });

  it("does not replace a cookie when the previous session cannot be revoked", async () => {
    mocks.revoke.mockResolvedValue("unavailable");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.revoke).toHaveBeenCalledWith("old-session");
    expect(await response.json()).toEqual({
      error: "The previous session could not be ended. Try signing in again.",
    });
  });

  it.each(["revoked", "not_revocable"])(
    "allows replacement after %s",
    async (outcome) => {
      mocks.revoke.mockResolvedValue(outcome);
      const response = await POST(request());
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain("navis_session=new-session");
      expect(mocks.revoke).toHaveBeenCalledWith("old-session");
    },
  );

  it("retries replacement after storage recovers", async () => {
    mocks.revoke.mockResolvedValueOnce("unavailable").mockResolvedValueOnce("revoked");
    expect((await POST(request())).status).toBe(503);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("new-session");
  });

  it("does not mistake a cookie-name suffix for the session cookie", async () => {
    const response = await POST(request("other_navis_session=not-the-session"));
    expect(response.status).toBe(200);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("does not revoke an existing session for an invalid signed challenge", async () => {
    mocks.verify.mockRejectedValue(
      new AuthenticationError("Invalid signature.", "invalid_signature"),
    );
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});
