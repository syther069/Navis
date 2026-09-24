import bs58 from "bs58";
import nacl from "tweetnacl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databaseUrl: undefined as string | undefined,
  sharedAllowed: true,
  sharedCalls: [] as unknown[],
  nonceCreated: 0,
  verifyCalled: 0,
}));

vi.mock("../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      get databaseUrl() {
        return mocks.databaseUrl;
      },
    },
  };
});

vi.mock("../lib/db/client", () => ({
  getDatabase: () => ({}),
}));

// The shared limiter needs a real database; route tests stand it in and
// assert how the routes drive it.
vi.mock("../lib/auth/shared-rate-limit", () => ({
  consumeSharedRateLimit: vi.fn(async (_db: unknown, input: unknown) => {
    mocks.sharedCalls.push(input);
    return {
      allowed: mocks.sharedAllowed,
      hits: mocks.sharedAllowed ? 1 : 99,
      limit: 10,
      retryAfterSeconds: 42,
    };
  }),
}));

vi.mock("../lib/auth/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth/server")>();
  return {
    ...actual,
    createAuthenticationChallenge: vi.fn(async () => {
      mocks.nonceCreated += 1;
      return {
        challengeId: "11111111-1111-4111-8111-111111111111",
        nonce: "a".repeat(32),
        message: "sign-in message",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    }),
    verifyAuthenticationChallenge: vi.fn(async () => {
      mocks.verifyCalled += 1;
      return {
        user: { id: "22222222-2222-4222-8222-222222222222", wallet: "w" },
        token: "session-token",
      };
    }),
  };
});

import { POST as postNonce } from "../app/api/auth/nonce/route";
import { POST as postVerify } from "../app/api/auth/verify/route";

const wallet = bs58.encode(nacl.sign.keyPair().publicKey);

function nonceRequest() {
  return postNonce(
    new Request("http://localhost:3000/api/auth/nonce", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({ wallet }),
    }),
  );
}

function verifyRequest() {
  return postVerify(
    new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        challengeId: "11111111-1111-4111-8111-111111111111",
        wallet,
        nonce: "a".repeat(32),
        signature: "b".repeat(88),
      }),
    }),
  );
}

describe("wallet sign-in rate limits", () => {
  beforeEach(() => {
    mocks.databaseUrl = "postgres://test";
    mocks.sharedAllowed = true;
    mocks.sharedCalls = [];
    mocks.nonceCreated = 0;
    mocks.verifyCalled = 0;
  });

  it("issues a challenge while the shared limit allows it", async () => {
    const response = await nonceRequest();
    expect(response.status).toBe(200);
    expect(mocks.nonceCreated).toBe(1);
    expect(mocks.sharedCalls).toEqual([
      expect.objectContaining({ scope: "auth.nonce", client: "203.0.113.10" }),
    ]);
  });

  it("rejects nonce bursts with 429 and Retry-After without writing a challenge", async () => {
    mocks.sharedAllowed = false;
    const response = await nonceRequest();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(mocks.nonceCreated).toBe(0);
  });

  it("verifies a signature while the shared limit allows it", async () => {
    const response = await verifyRequest();
    expect(response.status).toBe(200);
    expect(mocks.verifyCalled).toBe(1);
    expect(mocks.sharedCalls).toEqual([
      expect.objectContaining({ scope: "auth.verify", client: "203.0.113.10" }),
    ]);
  });

  it("rejects verify bursts with 429 before any signature work runs", async () => {
    mocks.sharedAllowed = false;
    const response = await verifyRequest();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(mocks.verifyCalled).toBe(0);
  });

  it("skips the shared limiter when no database is configured", async () => {
    mocks.databaseUrl = undefined;
    const response = await nonceRequest();
    // No shared counter without a database; the in-process burst guard still
    // applies and the request reaches the service.
    expect(mocks.sharedCalls).toEqual([]);
    expect(response.status).toBe(200);
  });
});

describe("authentication challenge pruning", () => {
  it("deletes expired and consumed challenges", async () => {
    const conditions: unknown[] = [];
    const database = {
      delete: () => ({
        where: (condition: unknown) => {
          conditions.push(condition);
          return Promise.resolve();
        },
      }),
    };
    const { pruneAuthenticationChallenges } = await import("../lib/auth/server");
    await pruneAuthenticationChallenges(
      database as never,
      new Date("2026-09-22T12:00:00Z"),
    );
    expect(conditions).toHaveLength(1);
  });
});
