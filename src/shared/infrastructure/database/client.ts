import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireEnv } from "@/shared/config/env";

export type Database = NodePgDatabase;

// The pool hangs off `globalThis` because `next dev` re-evaluates modules on
// every edit and would leak connections; it is created on first use so
// `next build` never needs a database.
const globalForDatabase = globalThis as typeof globalThis & {
  fenroDatabase?: { url: string; pool: Pool; db: Database };
};

export function getDatabase(): Database {
  const { DATABASE_URL: url } = requireEnv(["DATABASE_URL"]);

  const existing = globalForDatabase.fenroDatabase;
  if (existing?.url === url) return existing.db;

  // Every connection to RDS costs a TLS handshake of about 100 ms, and a page
  // asks several queries at once. pg closes idle clients after ten seconds by
  // default, so most page loads paid for a fresh connection per query.
  const pool = new Pool({
    connectionString: url,
    idleTimeoutMillis: 10 * 60_000,
    keepAlive: true,
  });
  // A dropped idle connection is an `error` event on the pool, which would
  // crash the process with no listener; pg replaces the client on next use.
  pool.on("error", (error) => console.warn("Idle database client lost", error));
  const db = drizzle({ client: pool });
  globalForDatabase.fenroDatabase = { url, pool, db };
  return db;
}
