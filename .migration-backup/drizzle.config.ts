import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` and `drizzle-kit check` work from the schema and the
// migration folder alone. `drizzle-kit migrate` (npm run db:migrate) needs a
// target and reads it from DATABASE_URL at run time; the URL is never written
// to disk or logged by this config.
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
});
