// Pure helpers for building the pg pool configuration. Kept free of
// `server-only` so they can be unit tested; they never log or return the
// connection string itself.

export const DATABASE_POOL_SETTINGS = Object.freeze({
  // Vercel functions are short-lived and many run at once, so each instance
  // keeps a small pool and gives idle connections back quickly.
  max: 8,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 5_000,
  // Server-side statement limit and the client-side ceiling above it.
  statement_timeout: 10_000,
  query_timeout: 12_000,
});

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type DatabaseTlsMode = "off" | "verify" | "unverified";

export type DatabaseTarget = Readonly<{
  host: string;
  local: boolean;
  tls: DatabaseTlsMode;
}>;

/**
 * Decide how to talk TLS to the database from the URL alone.
 *
 * - `sslmode=disable` turns TLS off (only sensible for a local or private host).
 * - `sslmode=no-verify` or `sslmode=prefer` keep TLS on but skip certificate
 *   verification; this is what many hosted providers document.
 * - `sslmode=require`, `verify-ca`, `verify-full`, or no sslmode on a remote
 *   host: TLS with certificate verification.
 * - No sslmode on localhost: TLS off.
 */
export function describeDatabaseTarget(connectionString: string): DatabaseTarget {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  const host = url.hostname;
  const local = LOCAL_HOSTS.has(host);
  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
  const sslParam = url.searchParams.get("ssl")?.toLowerCase();

  let tls: DatabaseTlsMode;
  if (sslmode === "disable" || sslParam === "false" || sslParam === "0") {
    tls = "off";
  } else if (sslmode === "no-verify" || sslmode === "prefer" || sslmode === "allow") {
    tls = "unverified";
  } else if (sslmode) {
    tls = "verify";
  } else {
    tls = local ? "off" : "verify";
  }

  return Object.freeze({ host, local, tls });
}

export function buildPoolConfig(connectionString: string) {
  const target = describeDatabaseTarget(connectionString);
  const ssl =
    target.tls === "off"
      ? false
      : target.tls === "verify"
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false };
  return {
    connectionString,
    ssl,
    ...DATABASE_POOL_SETTINGS,
  };
}
