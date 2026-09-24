import { logger } from "@workspace/navis-core/server/logger";
import "@workspace/navis-core/server/only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../env";
import { buildPoolConfig } from "./connection";
import { DatabaseError } from "./errors";
import * as schema from "./schema";

export type NavisDatabase = NodePgDatabase<typeof schema>;

const databaseGlobal = globalThis as typeof globalThis & {
  navisDatabase?: NavisDatabase;
  navisPool?: Pool;
};

export function getDatabase(): NavisDatabase {
  if (!env.databaseUrl) {
    throw new DatabaseError("database_not_configured");
  }

  if (!databaseGlobal.navisPool) {
    // TLS is decided from the URL: verified for remote hosts unless sslmode
    // says otherwise, off for localhost. See lib/db/connection.ts.
    const pool = new Pool(buildPoolConfig(env.databaseUrl));
    // An idle client can be dropped by the server; without a listener that
    // surfaces as an uncaught exception and kills the process.
    pool.on("error", () => {
      logger.error("[navis:db] idle client error; the pool will reconnect");
    });
    databaseGlobal.navisPool = pool;
  }

  if (!databaseGlobal.navisDatabase) {
    databaseGlobal.navisDatabase = drizzle(databaseGlobal.navisPool, { schema });
  }

  return databaseGlobal.navisDatabase;
}
