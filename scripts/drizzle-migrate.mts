// `drizzle-kit migrate` can exit non-zero with nothing on stderr, which reads
// like a no-op, so this runs Drizzle's migrator directly and reports the error.
// Node runs this file as is (type stripping), which is why the import names `.ts`.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { migrationConfig } from "../src/shared/infrastructure/database/migrations.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const pool = new Pool({ connectionString: url });

try {
  await migrate(drizzle({ client: pool }), migrationConfig);
  console.log("migrations applied");
} catch (error) {
  const err = error as Error & { cause?: Error };
  console.error("");
  console.error("migration FAILED, nothing was committed:");
  console.error(`  ${err.message?.split("\n")[0] ?? err}`);
  if (err.cause?.message) console.error(`  cause: ${err.cause.message}`);
  if (/already exists/.test(err.cause?.message ?? "")) {
    console.error("");
    console.error("  The baseline is being replayed over tables that already");
    console.error("  exist. A database migrated before the `fenro` schema");
    console.error("  (tables in `public`, ledger in `drizzle`) is moved over");
    console.error("  with `--adopt`, not migrated. scripts/db-migrate.sh");
    console.error("  documents it.");
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
