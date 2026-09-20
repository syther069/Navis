import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/env", () => ({
  env: { appUrl: "https://configured.example" },
}));

import { hasTrustedMutationOrigin } from "../lib/auth/request";

function request(
  headers: Record<string, string>,
  url = "https://internal.local/api/x",
) {
  return new Request(url, { method: "POST", headers });
}

describe("hasTrustedMutationOrigin", () => {
  it("rejects requests without an Origin header", () => {
    expect(hasTrustedMutationOrigin(request({}))).toBe(false);
  });

  it("accepts the configured application origin", () => {
    expect(
      hasTrustedMutationOrigin(request({ origin: "https://configured.example" })),
    ).toBe(true);
  });

  it("accepts a same-origin request behind a proxy", () => {
    expect(
      hasTrustedMutationOrigin(
        request({
          origin: "https://navis-gilt.vercel.app",
          "x-forwarded-host": "navis-gilt.vercel.app",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a foreign origin even when a proxy host is present", () => {
    expect(
      hasTrustedMutationOrigin(
        request({
          origin: "https://evil.example",
          "x-forwarded-host": "navis-gilt.vercel.app",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(false);
  });

  it("does not let a forwarded host that matches a foreign origin bypass https", () => {
    expect(
      hasTrustedMutationOrigin(
        request({
          origin: "http://navis-gilt.vercel.app",
          "x-forwarded-host": "navis-gilt.vercel.app",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(false);
  });

  it("falls back to the request URL origin without proxy headers", () => {
    expect(
      hasTrustedMutationOrigin(
        request({ origin: "https://internal.local" }, "https://internal.local/api/x"),
      ),
    ).toBe(true);
  });
});
