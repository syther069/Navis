// Turns pg / Drizzle failures into a small, stable set of application errors.
// The public message never carries hosts, SQL, constraint names or driver
// text; the original error stays on `cause` for server-side logging only.

export type DatabaseErrorCode =
  | "database_not_configured"
  | "database_unreachable"
  | "database_schema_mismatch"
  | "database_timeout"
  | "database_transaction_failed"
  | "duplicate_request"
  | "authorization_failed"
  | "database_error";

export const DATABASE_ERROR_STATUS: Readonly<Record<DatabaseErrorCode, number>> =
  Object.freeze({
    database_not_configured: 503,
    database_unreachable: 503,
    database_schema_mismatch: 503,
    database_timeout: 504,
    database_transaction_failed: 503,
    duplicate_request: 409,
    authorization_failed: 403,
    database_error: 503,
  });

const PUBLIC_MESSAGE: Readonly<Record<DatabaseErrorCode, string>> = Object.freeze({
  database_not_configured:
    "Persistent storage is not configured on this Navis instance.",
  database_unreachable: "Persistent storage is unavailable right now.",
  database_schema_mismatch:
    "Persistent storage schema does not match this release. Migrations are pending.",
  database_timeout: "Persistent storage did not answer in time.",
  database_transaction_failed: "The change could not be committed. Nothing was saved.",
  duplicate_request: "This request was already processed.",
  authorization_failed: "You are not allowed to access this record.",
  database_error: "Persistent storage failed. Nothing was saved.",
});

export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  readonly status: number;
  /** True when a retry of the same request is reasonable. */
  readonly retryable: boolean;

  constructor(code: DatabaseErrorCode, options?: { cause?: unknown }) {
    super(PUBLIC_MESSAGE[code], options);
    this.name = "DatabaseError";
    this.code = code;
    this.status = DATABASE_ERROR_STATUS[code];
    this.retryable =
      code === "database_unreachable" ||
      code === "database_timeout" ||
      code === "database_transaction_failed";
  }

  toJSON() {
    return { error: this.message, code: this.code, retryable: this.retryable };
  }
}

type PgLikeError = {
  code?: unknown;
  errno?: unknown;
  message?: unknown;
  constraint?: unknown;
  cause?: unknown;
};

const CONNECTION_ERRNOS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
  "EPIPE",
]);

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

/**
 * Classify a thrown value. Already-classified errors pass through, so a
 * service can throw `new DatabaseError("duplicate_request")` and a route can
 * call this on anything it catches.
 */
export function classifyDatabaseError(error: unknown): DatabaseError {
  if (error instanceof DatabaseError) return error;
  if (!error || typeof error !== "object") {
    return new DatabaseError("database_error", { cause: error });
  }

  const pg = error as PgLikeError;
  const code = readString(pg.code) ?? readString(pg.errno);
  const message = readString(pg.message) ?? "";

  // Drizzle wraps the pg error since 0.44; look one level down as well.
  if (pg.cause && pg.cause !== error && typeof pg.cause === "object") {
    const inner = classifyDatabaseError(pg.cause);
    if (inner.code !== "database_error") return inner;
  }

  if (code && CONNECTION_ERRNOS.has(code)) {
    return new DatabaseError("database_unreachable", { cause: error });
  }
  if (code === "57P01" || code === "57P02" || code === "57P03" || code === "53300") {
    // admin shutdown, crash shutdown, cannot connect now, too many connections
    return new DatabaseError("database_unreachable", { cause: error });
  }
  if (code?.startsWith("08")) {
    // connection exception class
    return new DatabaseError("database_unreachable", { cause: error });
  }
  if (code === "28P01" || code === "28000" || code === "3D000") {
    // bad password, invalid authorization, database does not exist: the
    // instance cannot use its storage, which to a caller is "unavailable".
    return new DatabaseError("database_unreachable", { cause: error });
  }
  if (code === "57014") {
    return new DatabaseError("database_timeout", { cause: error });
  }
  if (
    /timeout exceeded when trying to connect/i.test(message) ||
    /query read timeout/i.test(message) ||
    /connection terminated due to connection timeout/i.test(message)
  ) {
    return new DatabaseError("database_timeout", { cause: error });
  }
  if (
    code === "42P01" ||
    code === "42703" ||
    code === "42704" ||
    code === "42883" ||
    code === "42P07"
  ) {
    // undefined table, column, object, function; duplicate table
    return new DatabaseError("database_schema_mismatch", { cause: error });
  }
  if (code === "23505") {
    return new DatabaseError("duplicate_request", { cause: error });
  }
  if (code === "40001" || code === "40P01" || code?.startsWith("25")) {
    // serialization failure, deadlock, invalid transaction state
    return new DatabaseError("database_transaction_failed", { cause: error });
  }
  if (code === "42501") {
    return new DatabaseError("authorization_failed", { cause: error });
  }
  if (/DATABASE_URL is not configured/i.test(message)) {
    return new DatabaseError("database_not_configured", { cause: error });
  }
  return new DatabaseError("database_error", { cause: error });
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Log a database failure without its connection details. pg error messages
 * can include the host and the failing SQL, so only the classification, the
 * SQLSTATE and the constraint name (if any) are written.
 */
export function logDatabaseError(scope: string, error: DatabaseError) {
  const cause = error.cause as PgLikeError | undefined;
  const sqlstate = cause ? readString(cause.code) : undefined;
  const constraint = cause ? readString(cause.constraint) : undefined;
  console.error(
    `[navis:db] ${scope}: ${error.code}` +
      (sqlstate ? ` sqlstate=${sqlstate}` : "") +
      (constraint ? ` constraint=${constraint}` : ""),
  );
}
