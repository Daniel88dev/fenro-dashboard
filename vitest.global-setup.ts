import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getEnv } from "./src/shared/config/env";
import { migrationConfig } from "./src/shared/infrastructure/database/migrations";

// Migrate once here: test files run in parallel and Drizzle's migrator takes
// no lock, so two files migrating a fresh database at once collide.
export async function setup(): Promise<void> {
  const url = getEnv().TEST_DATABASE_URL;
  if (!url) return;

  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), migrationConfig);
  } finally {
    await pool.end();
  }
}
