// The ledger has a schema of its own: drizzle creates it before migrating, so in
// `fenro` the first migration's `CREATE SCHEMA "fenro"` would fail, and Flexi
// Day owns `drizzle` on the shared database. Plain values and no imports:
// `scripts/drizzle-migrate.mts` loads this file with Node, outside the `@/` alias.
export const migrationConfig = {
  migrationsFolder: "drizzle",
  migrationsSchema: "fenro_migrations",
  migrationsTable: "__drizzle_migrations",
} as const;
