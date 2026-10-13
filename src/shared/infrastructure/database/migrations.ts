/**
 * Where the migrations are and where the database records which ones ran.
 * drizzle-kit, the migration script and the test setup all read this, so they
 * agree on one ledger.
 *
 * The ledger has a schema of its own rather than living in `fenro`: drizzle's
 * migrator creates its ledger schema before running anything, and the first
 * migration's unconditional `CREATE SCHEMA "fenro"` would then fail. It also
 * stays out of `drizzle`, where Flexi Day keeps its own ledger on the shared
 * database and which its reset drops.
 *
 * Plain values and no imports: `scripts/drizzle-migrate.mts` loads this file
 * with Node directly, outside the `@/` alias.
 */
export const migrationConfig = {
  migrationsFolder: "drizzle",
  migrationsSchema: "fenro_migrations",
  migrationsTable: "__drizzle_migrations",
} as const;
