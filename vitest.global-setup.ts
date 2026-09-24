import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getEnv } from "./src/shared/config/env";

/**
 * Brings the adapter tests' database up to date once, before any test file
 * runs. Files run in parallel, and Drizzle's migrator takes no lock, so two
 * files migrating a fresh database at once collide.
 */
export async function setup(): Promise<void> {
  const url = getEnv().TEST_DATABASE_URL;
  if (!url) return;

  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}
