import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as githubInsights from "@/modules/github-insights/infrastructure/persistence/schema";
import * as identity from "@/modules/identity/infrastructure/persistence/schema";
import * as tasks from "@/modules/tasks/infrastructure/persistence/schema";

import { migrationConfig } from "./migrations";

const tables = [githubInsights, identity, tasks]
  .flatMap((module) => Object.values(module))
  .filter((value): value is PgTable => is(value, PgTable));

describe("the fenro schema", () => {
  it("holds every table, so none lands in the shared database's public schema", () => {
    expect(tables.length).toBeGreaterThan(0);
    const outside = tables
      .map(getTableConfig)
      .filter((config) => config.schema !== "fenro")
      .map((config) => config.name);
    expect(outside).toEqual([]);
  });

  it("keeps the migration ledger away from Flexi Day's and from the tables", () => {
    expect(["public", "drizzle", "fenro"]).not.toContain(
      migrationConfig.migrationsSchema,
    );
  });
});
