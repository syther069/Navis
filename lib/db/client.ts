import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../env";
import * as schema from "./schema";

type NavisDatabase = NodePgDatabase<typeof schema>;

const databaseGlobal = globalThis as typeof globalThis & {
  navisDatabase?: NavisDatabase;
  navisPool?: Pool;
};

export function getDatabase(): NavisDatabase {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Persistent repositories are unavailable in this Navis instance.",
    );
  }

  if (!databaseGlobal.navisPool) {
    databaseGlobal.navisPool = new Pool({
      connectionString: env.databaseUrl,
      max: 8,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  if (!databaseGlobal.navisDatabase) {
    databaseGlobal.navisDatabase = drizzle(databaseGlobal.navisPool, { schema });
  }

  return databaseGlobal.navisDatabase;
}
