import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Every Fenro table lives in the `fenro` Postgres schema, never in `public`.
 * In production the database is shared with Flexi Day, whose tables (Better
 * Auth's `user`, `session` and `account` among them) own `public` and whose
 * migration ledger owns `drizzle`; a schema of our own keeps the two apps from
 * colliding on names or on each other's migrations.
 *
 * Contexts declare their tables with `fenro.table(...)` instead of `pgTable`.
 * drizzle-kit reads this file too, which is how the migration that creates the
 * schema gets generated.
 */
export const fenro = pgSchema("fenro");
