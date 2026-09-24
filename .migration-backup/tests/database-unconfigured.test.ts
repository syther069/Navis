import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/env")>();
  return { ...actual, env: { ...actual.env, databaseUrl: undefined } };
});

import { getDatabase } from "../lib/db/client";
import { DatabaseError } from "../lib/db/errors";

describe("database without DATABASE_URL", () => {
  it("fails with a typed, non-retryable database_not_configured error", () => {
    let caught: unknown;
    try {
      getDatabase();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DatabaseError);
    const error = caught as DatabaseError;
    expect(error.code).toBe("database_not_configured");
    expect(error.status).toBe(503);
    expect(error.retryable).toBe(false);
    expect(error.toJSON()).toEqual({
      error: "Persistent storage is not configured on this Navis instance.",
      code: "database_not_configured",
      retryable: false,
    });
  });
});
