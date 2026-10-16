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

  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool });
  globalForDatabase.fenroDatabase = { url, pool, db };
  return db;
}
