// @vitest-environment node
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  Label,
  Skill,
  Task,
  type Actor,
  type NewSkill,
} from "@/modules/tasks/domain";
import { getEnv } from "@/shared/config/env";
import { unwrap } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { DrizzleLabelRepository } from "./drizzle-label.repository";
import { DrizzleSkillRepository } from "./drizzle-skill.repository";
import { DrizzleTaskReadStore } from "./drizzle-task.read-store";
import { DrizzleTaskRepository } from "./drizzle-task.repository";

/**
 * Against a real Postgres, because what the skill adapters promise — the
 * unique name, the version check, a rename reaching tasks and skill links in
 * one statement each, deletes cascading — is Postgres behaviour.
 */
const url = getEnv().TEST_DATABASE_URL;

const t0 = new Date("2026-10-04T10:00:00Z");
const t1 = new Date("2026-10-04T11:00:00Z");
const daniel: Actor = { kind: "human", id: "user-1", name: "Daniel" };
const claude: Actor = { kind: "agent", id: "token-1", name: "claude-code" };

let ids = 0;
const nextId = (prefix: string) => `${prefix}-${(ids += 1)}`;

const aSkill = (overrides: Partial<NewSkill> & { name: string }) =>
  unwrap(
    Skill.create({
      id: nextId("skill"),
      ownerId: "user-1",
      description: `Use for ${overrides.name}.`,
      instructions: `Follow ${overrides.name}.`,
      actor: daniel,
      now: t0,
      ...overrides,
    }),
  );

describe.skipIf(!url)("Postgres skill adapters", () => {
  let pool: Pool;
  let db: Database;
  let skills: DrizzleSkillRepository;
  let labels: DrizzleLabelRepository;
  let tasks: DrizzleTaskRepository;
  let reads: DrizzleTaskReadStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle({ client: pool });
  });

  beforeEach(async () => {
    await db.execute(sql`truncate task, task_label, task_skill cascade`);
    skills = new DrizzleSkillRepository(db);
    labels = new DrizzleLabelRepository(db);
    tasks = new DrizzleTaskRepository(db);
    reads = new DrizzleTaskReadStore(db);
  });

  afterAll(async () => {
    await pool?.end();
  });

  const aTask = async (number: number, taskLabels: string[]) => {
    const task = unwrap(
      Task.create({
        id: nextId("task"),
        ownerId: "user-1",
        number,
        title: `Task ${number}`,
        labels: taskLabels,
        author: daniel,
        now: t0,
      }),
    );
    unwrap(await tasks.save(task));
    return task;
  };

  const aLabel = async (name: string) => {
    const label = unwrap(
      Label.create({ id: nextId("label"), ownerId: "user-1", name, now: t0 }),
    );
    unwrap(await labels.save(label));
  };

  it("brings a skill back whole, with every revision kept", async () => {
    const skill = aSkill({ name: "ui-work", labels: ["ui", "frontend"] });
    unwrap(await skills.save(skill));

    const loaded = (await skills.findByName("user-1", "ui-work"))!;
    unwrap(loaded.revise({ instructions: "Second" }, 1, claude, t1));
    unwrap(await skills.save(loaded));

    const again = (await skills.findById("user-1", skill.id.value))!;
    expect(again.state).toMatchObject({
      labels: ["frontend", "ui"],
      revision: 2,
      instructions: "Second",
      createdBy: daniel,
      updatedBy: claude,
    });
    expect(await skills.revision("user-1", skill.id.value, 1)).toMatchObject({
      instructions: "Follow ui-work.",
      by: daniel,
    });
    expect(await skills.revision("user-2", skill.id.value, 1)).toBeUndefined();

    const detail = await reads.skill("user-1", { name: "ui-work" }, 1);
    expect(detail?.revisions.map((kept) => kept.revision)).toEqual([2]);
  });

  it("refuses a second skill of a name, and a save over a newer copy", async () => {
    unwrap(await skills.save(aSkill({ name: "ui-work" })));
    const twin = await skills.save(aSkill({ name: "ui-work" }));
    expect(!twin.ok && twin.error.code).toBe("skill-exists");

    const first = (await skills.findByName("user-1", "ui-work"))!;
    const second = (await skills.findByName("user-1", "ui-work"))!;
    unwrap(first.link(["a"], daniel, t1));
    unwrap(await skills.save(first));
    unwrap(second.link(["b"], daniel, t1));
    const stale = await skills.save(second);
    expect(!stale.ok && stale.error.code).toBe("concurrent-modification");
  });

  it("finds the skills linked to a task's labels, each once", async () => {
    unwrap(await skills.save(aSkill({ name: "both", labels: ["ui", "db"] })));
    unwrap(await skills.save(aSkill({ name: "other", labels: ["ops"] })));

    const linked = await reads.skillsLinkedTo("user-1", ["ui", "db"]);
    expect(linked.map((skill) => [skill.name, skill.instructions])).toEqual([
      ["both", "Follow both."],
    ]);
    expect(await reads.skillsLinkedTo("user-2", ["ui"])).toEqual([]);
    expect((await reads.skills("user-1")).map((skill) => skill.name)).toEqual([
      "both",
      "other",
    ]);
  });

  it("renames a label on tasks and skill links in one go, keeping each name once", async () => {
    await aLabel("ui");
    const header = await aTask(1, ["ui", "bug"]);
    await aTask(2, ["web", "ui"]);
    unwrap(await skills.save(aSkill({ name: "ui-work", labels: ["ui"] })));
    unwrap(await skills.save(aSkill({ name: "both", labels: ["ui", "web"] })));
    const staleSkill = (await skills.findByName("user-1", "ui-work"))!;

    const label = (await labels.findByName("user-1", "ui"))!;
    unwrap(label.rename("web", t1));
    unwrap(await labels.update(label));

    const records = (await reads.records("user-1")).sort(
      (a, b) => a.number - b.number,
    );
    expect(records.map((record) => record.labels)).toEqual([
      ["web", "bug"],
      ["web"],
    ]);
    expect(
      (await reads.skills("user-1")).map((skill) => [skill.name, skill.labels]),
    ).toEqual([
      ["both", ["web"]],
      ["ui-work", ["web"]],
    ]);
    expect(await labels.findByName("user-1", "ui")).toBeUndefined();

    // Copies loaded before the rename cannot write the old name back.
    const savedTask = await tasks.save(header);
    expect(!savedTask.ok && savedTask.error.code).toBe(
      "concurrent-modification",
    );
    unwrap(staleSkill.link(["x"], daniel, t1));
    const savedSkill = await skills.save(staleSkill);
    expect(!savedSkill.ok && savedSkill.error.code).toBe(
      "concurrent-modification",
    );
  });

  it("refuses a rename onto another label's name, changing nothing", async () => {
    await aLabel("ui");
    await aLabel("web");
    await aTask(1, ["ui"]);

    const label = (await labels.findByName("user-1", "ui"))!;
    unwrap(label.rename("web", t1));
    const taken = await labels.update(label);
    expect(!taken.ok && taken.error.code).toBe("label-exists");
    expect((await reads.records("user-1"))[0]!.labels).toEqual(["ui"]);
  });

  it("recolours a label, and knows a name tasks or skills carry", async () => {
    await aLabel("ui");
    const label = (await labels.findByName("user-1", "ui"))!;
    label.recolour("purple", t1);
    unwrap(await labels.update(label));
    expect(await reads.labels("user-1")).toEqual([
      { name: "ui", colour: "purple" },
    ]);

    await aTask(1, ["legacy"]);
    unwrap(await skills.save(aSkill({ name: "s", labels: ["linked"] })));
    expect(await labels.inUse("user-1", "legacy")).toBe(true);
    expect(await labels.inUse("user-1", "linked")).toBe(true);
    expect(await labels.inUse("user-1", "nothing")).toBe(false);
    expect(await labels.inUse("user-2", "legacy")).toBe(false);
  });

  it("deletes a skill with its links and revisions", async () => {
    const skill = aSkill({ name: "gone", labels: ["ui"] });
    unwrap(await skills.save(skill));
    await skills.remove(skill);

    expect(await skills.findById("user-1", skill.id.value)).toBeUndefined();
    expect(await reads.skillsLinkedTo("user-1", ["ui"])).toEqual([]);
    expect(await skills.revision("user-1", skill.id.value, 1)).toBeUndefined();
  });
});
