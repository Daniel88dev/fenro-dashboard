import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { requireEnv } from "./src/shared/config/env";
import { migrationConfig } from "./src/shared/infrastructure/database/migrations";

// drizzle-kit runs outside Next, so load .env.local the same way `next dev`
// does. On a deploy host the variables are already in the environment.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/shared/infrastructure/database/schema.ts",
    "./src/modules/*/infrastructure/persistence/schema.ts",
  ],
  out: `./${migrationConfig.migrationsFolder}`,
  // Only look at our own schemas, so `drizzle-kit push` or `pull` against the
  // shared database never sees, or offers to drop, Flexi Day's tables.
  schemaFilter: ["fenro"],
  migrations: {
    schema: migrationConfig.migrationsSchema,
    table: migrationConfig.migrationsTable,
  },
  dbCredentials: {
    url: requireEnv(["DATABASE_URL"]).DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
