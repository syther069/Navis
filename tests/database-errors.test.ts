import { describe, expect, it } from "vitest";

import {
  buildPoolConfig,
  DATABASE_POOL_SETTINGS,
  describeDatabaseTarget,
} from "../lib/db/connection";
import {
  classifyDatabaseError,
  DATABASE_ERROR_STATUS,
  DatabaseError,
} from "../lib/db/errors";

describe("database connection settings", () => {
  it("keeps pool limits and timeouts explicit", () => {
    expect(DATABASE_POOL_SETTINGS).toEqual({
      max: 8,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      query_timeout: 12_000,
    });
  });

  it("turns TLS off for localhost without an sslmode", () => {
    expect(describeDatabaseTarget("postgres://u:p@localhost:5432/db")).toEqual({
      host: "localhost",
      local: true,
      tls: "off",
    });
    expect(buildPoolConfig("postgres://u:p@127.0.0.1/db").ssl).toBe(false);
  });

  it("verifies certificates for remote hosts by default", () => {
    const target = describeDatabaseTarget("postgres://u:p@db.example.com/db");
    expect(target).toEqual({ host: "db.example.com", local: false, tls: "verify" });
    expect(buildPoolConfig("postgres://u:p@db.example.com/db").ssl).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("respects sslmode in the URL", () => {
    expect(describeDatabaseTarget("postgres://u:p@h/db?sslmode=disable").tls).toBe(
      "off",
    );
    expect(describeDatabaseTarget("postgres://u:p@h/db?sslmode=verify-full").tls).toBe(
      "verify",
    );
    expect(describeDatabaseTarget("postgres://u:p@h/db?sslmode=require").tls).toBe(
      "verify",
    );
    expect(describeDatabaseTarget("postgres://u:p@h/db?sslmode=no-verify").tls).toBe(
      "unverified",
    );
    expect(buildPoolConfig("postgres://u:p@h/db?sslmode=no-verify").ssl).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("rejects a malformed URL without echoing it", () => {
    expect(() => describeDatabaseTarget("not a url")).toThrow(
      /DATABASE_URL is not a valid URL/,
    );
  });
});

describe("database error classification", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["connection refused", { code: "ECONNREFUSED" }, "database_unreachable"],
    ["dns failure", { code: "ENOTFOUND" }, "database_unreachable"],
    ["server shutting down", { code: "57P01" }, "database_unreachable"],
    ["too many connections", { code: "53300" }, "database_unreachable"],
    ["bad password", { code: "28P01" }, "database_unreachable"],
    ["statement timeout", { code: "57014" }, "database_timeout"],
    [
      "pool connect timeout",
      { message: "timeout exceeded when trying to connect" },
      "database_timeout",
    ],
    ["query read timeout", { message: "Query read timeout" }, "database_timeout"],
    ["undefined table", { code: "42P01" }, "database_schema_mismatch"],
    ["undefined column", { code: "42703" }, "database_schema_mismatch"],
    ["unique violation", { code: "23505" }, "duplicate_request"],
    ["serialization failure", { code: "40001" }, "database_transaction_failed"],
    ["deadlock", { code: "40P01" }, "database_transaction_failed"],
    ["insufficient privilege", { code: "42501" }, "authorization_failed"],
    ["anything else", { code: "22P02" }, "database_error"],
  ];

  for (const [name, raw, code] of cases) {
    it(`maps ${name} to ${code}`, () => {
      const error = Object.assign(new Error(String(raw.message ?? name)), raw);
      const classified = classifyDatabaseError(error);
      expect(classified.code).toBe(code);
      expect(classified.status).toBe(
        DATABASE_ERROR_STATUS[code as keyof typeof DATABASE_ERROR_STATUS],
      );
    });
  }

  it("looks through a Drizzle wrapper to the pg cause", () => {
    const inner = Object.assign(new Error("relation missing"), { code: "42P01" });
    const wrapped = new Error("Failed query: select ...", { cause: inner });
    expect(classifyDatabaseError(wrapped).code).toBe("database_schema_mismatch");
  });

  it("passes an already classified error through unchanged", () => {
    const error = new DatabaseError("duplicate_request");
    expect(classifyDatabaseError(error)).toBe(error);
  });

  it("never leaks the driver message or SQL into the public payload", () => {
    const secret = "postgres://user:hunter2@db.internal:5432/navis";
    const error = Object.assign(
      new Error(`connect ECONNREFUSED ${secret} select * from agents`),
      { code: "ECONNREFUSED" },
    );
    const json = JSON.stringify(classifyDatabaseError(error).toJSON());
    expect(json).not.toContain("hunter2");
    expect(json).not.toContain("db.internal");
    expect(json).not.toContain("select");
    expect(json).toContain('"code":"database_unreachable"');
    expect(json).toContain('"retryable":true');
  });

  it("marks only transient failures as retryable", () => {
    expect(new DatabaseError("database_timeout").retryable).toBe(true);
    expect(new DatabaseError("database_unreachable").retryable).toBe(true);
    expect(new DatabaseError("duplicate_request").retryable).toBe(false);
    expect(new DatabaseError("database_schema_mismatch").retryable).toBe(false);
    expect(new DatabaseError("database_not_configured").retryable).toBe(false);
  });
});
