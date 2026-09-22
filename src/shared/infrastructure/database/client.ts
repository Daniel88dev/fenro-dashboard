import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requireEnv } from "@/shared/config/env";

/**
 * One connection pool per process, over plain `pg` and a `DATABASE_URL`, so the
 * same code talks to Neon, RDS, or a local container without a vendor driver.
 *
 * The pool hangs off `globalThis` because `next dev` re-evaluates modules on
 * every edit, and a module-level pool would leak a new set of connections each
 * time. It is created on first use, not at import, so `next build` never needs
 * a database.
 *
 * Contexts do not import this. Each context's adapters are handed the database
 * by the composition root, and bring their own table definitions.
 */
export type Database = NodePgDatabase;

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
