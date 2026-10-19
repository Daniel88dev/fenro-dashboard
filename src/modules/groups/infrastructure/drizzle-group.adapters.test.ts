// @vitest-environment node
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Group, type Person } from "@/modules/groups/domain";
import { getEnv } from "@/shared/config/env";
import { unwrap } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import {
  DrizzleGroupReadStore,
  DrizzleGroupRepository,
} from "./drizzle-group.repository";
import { group as groupTable } from "./persistence/schema";

const url = getEnv().TEST_DATABASE_URL;

const now = new Date("2026-10-19T12:00:00Z");
const daniel: Person = { id: "user-daniel", login: "Daniel88dev" };
const ana: Person = { id: "user-ana", login: "ana-k" };

const aGroup = (id: string, prefix: string) =>
  unwrap(
    Group.create({ id, name: `Group ${prefix}`, prefix, owner: daniel, now }),
  );

describe.skipIf(!url)("Postgres group adapters", () => {
  let pool: Pool;
  let db: Database;
  let groups: DrizzleGroupRepository;
  let reads: DrizzleGroupReadStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle({ client: pool });
  });

  beforeEach(async () => {
    await db.execute(sql`truncate ${groupTable} cascade`);
    groups = new DrizzleGroupRepository(db);
    reads = new DrizzleGroupReadStore(db);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("keeps members and invitations, and finds invitations by any case", async () => {
    const hal = aGroup("group-hal", "HAL");
    hal.invite(daniel, "Ana-K", now);
    expect((await groups.save(hal)).ok).toBe(true);

    expect(await reads.invitationsFor("ANA-K")).toMatchObject([
      { prefix: "HAL", invitedByLogin: "Daniel88dev", members: 1 },
    ]);

    const loaded = (await groups.findByPrefix("hal"))!;
    expect(loaded.accept(ana, now).ok).toBe(true);
    expect((await groups.save(loaded)).ok).toBe(true);

    expect(await reads.ofMember(ana.id)).toMatchObject([
      { prefix: "HAL", role: "member", members: 2 },
    ]);
    expect((await reads.detail("HAL"))?.invitations).toEqual([]);
  });

  it("refuses a prefix another group holds", async () => {
    await groups.save(aGroup("group-1", "HAL"));

    const second = await groups.save(aGroup("group-2", "HAL"));

    expect(second.ok || second.error.code).toBe("prefix-taken");
  });

  it("refuses a save over a newer version", async () => {
    await groups.save(aGroup("group-hal", "HAL"));
    const other = new DrizzleGroupRepository(db);
    const first = (await groups.findById("group-hal"))!;
    const second = (await other.findById("group-hal"))!;
    first.invite(daniel, "ana-k", now);
    second.invite(daniel, "someone", now);

    expect((await groups.save(first)).ok).toBe(true);
    const stale = await other.save(second);

    expect(stale.ok || stale.error.code).toBe("concurrent-modification");
  });

  it("removes a group with its members", async () => {
    const hal = aGroup("group-hal", "HAL");
    await groups.save(hal);

    await groups.remove(hal);

    expect(await reads.ofMember(daniel.id)).toEqual([]);
  });
});
