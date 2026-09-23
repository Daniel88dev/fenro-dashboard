import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { requireEnv } from "./src/shared/config/env";

// drizzle-kit runs outside Next, so load .env.local the same way `next dev`
// does. On a deploy host the variables are already in the environment.
loadEnvConfig(process.cwd());

/**
 * Every context keeps its own tables next to its adapters, at
 * `src/modules/<context>/infrastructure/persistence/schema.ts`; migrations for
 * all of them share one history in `drizzle/`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/infrastructure/persistence/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: requireEnv(["DATABASE_URL"]).DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
