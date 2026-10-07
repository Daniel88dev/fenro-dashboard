import { beforeEach, describe, expect, it } from "vitest";

import { Task, type Actor } from "@/modules/tasks/domain";
import { unwrap } from "@/shared/domain";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";

import { ChangeStatusHandler } from "./commands/change-status";
import { CreateLabelHandler } from "./commands/create-label";
import {
  CreateSkillHandler,
  type CreateSkillCommand,
} from "./commands/create-skill";
import { CreateTaskHandler } from "./commands/create-task";
import { DeleteSkillHandler } from "./commands/delete-skill";
import { LinkSkillHandler } from "./commands/link-skill";
import { RecolourLabelHandler } from "./commands/recolour-label";
import { RenameLabelHandler } from "./commands/rename-label";
import { RestoreSkillHandler } from "./commands/restore-skill";
import { ReviseSkillHandler } from "./commands/revise-skill";
import { UnlinkSkillHandler } from "./commands/unlink-skill";
import { UpdateTaskHandler } from "./commands/update-task";
import { ListLabelsHandler, listLabelsQuery } from "./queries/list-labels";
import { ListSkillsHandler, listSkillsQuery } from "./queries/list-skills";
import { BRIEF_INSTRUCTIONS_BUDGET } from "./queries/projections";
import { SkillHandler, skillQuery } from "./queries/skill";
import { TaskBriefHandler, taskBriefQuery } from "./queries/task-brief";

const OWNER = "user-1";
const DANIEL: Actor = { kind: "human", id: OWNER, name: "Daniel" };
const AGENT: Actor = { kind: "agent", id: "token-1", name: "Claude Code" };

let now: Date;
let store: InMemoryTaskStore;
let ids: number;
const clock = () => now;
const nextId = () => {
  ids += 1;
  return `00000000-0000-4000-8000-${String(ids).padStart(12, "0")}`;
};

beforeEach(() => {
  now = new Date("2026-10-04T10:00:00Z");
  store = new InMemoryTaskStore();
  ids = 0;
});

const base = { ownerId: OWNER, actor: DANIEL } as const;

const createTask = async (title: string, labels: string[], closed = false) => {
  await new CreateTaskHandler(store, store, clock).handle({
    ...base,
    type: "tasks.create-task",
    taskId: nextId(),
    title,
    labels,
  });
  if (!closed) return;
  const [latest] = (await store.records(OWNER)).sort(
    (a, b) => b.number - a.number,
  );
  await new ChangeStatusHandler(store, clock).handle({
    ...base,
    type: "tasks.change-status",
    task: latest!.id,
    status: "cancelled",
  });
};

const createSkill = (
  fields: Partial<CreateSkillCommand> & { name: string },
  ownerId = OWNER,
) =>
  new CreateSkillHandler(store.skillRepository, store, clock).handle({
    ...base,
    ownerId,
    type: "tasks.create-skill",
    skillId: nextId(),
    description: `Use for ${fields.name}.`,
    instructions: `Follow ${fields.name}.`,
    ...fields,
  });

const revise = (
  skill: string,
  expectedRevision: number,
  instructions: string,
) =>
  new ReviseSkillHandler(store.skillRepository, clock).handle({
    ...base,
    actor: AGENT,
    type: "tasks.revise-skill",
    skill,
    expectedRevision,
    instructions,
  });

const link = (skill: string, labels: string[]) =>
  new LinkSkillHandler(store.skillRepository, store, clock).handle({
    ...base,
    type: "tasks.link-skill",
    skill,
    labels,
  });

const brief = (task: string, skillInstructions = false) =>
  new TaskBriefHandler(store, clock).handle(
    taskBriefQuery(OWNER, task, 0, { skillInstructions }),
  );

const labels = () =>
  new ListLabelsHandler(store).handle(listLabelsQuery(OWNER));

describe("skills", () => {
  it("creates a skill, adding labels the catalogue lacks, and refuses a second of the name", async () => {
    expect((await createSkill({ name: "ui-work", labels: ["UI"] })).ok).toBe(
      true,
    );
    const again = await createSkill({ name: "UI-Work" });
    expect(!again.ok && again.error.code).toBe("skill-exists");
    // Another person's library is their own.
    expect((await createSkill({ name: "ui-work" }, "user-2")).ok).toBe(true);

    expect(await labels()).toMatchObject([
      { name: "ui", tasks: 0, skills: ["ui-work"] },
    ]);
  });

  it("revises against the revision read, keeps every revision, and restores one", async () => {
    await createSkill({ name: "ui-work", instructions: "First" });
    expect((await revise("ui-work", 1, "Second")).ok).toBe(true);

    const stale = await revise("ui-work", 1, "Lost update");
    expect(!stale.ok && stale.error.code).toBe("stale-skill");

    const restored = await new RestoreSkillHandler(
      store.skillRepository,
      clock,
    ).handle({
      ...base,
      type: "tasks.restore-skill",
      skill: "ui-work",
      revision: 1,
      expectedRevision: 2,
    });
    expect(restored.ok).toBe(true);

    const found = await new SkillHandler(store, clock).handle(
      skillQuery(OWNER, "ui-work"),
    );
    expect(found.ok && found.value).toMatchObject({
      instructions: "First",
      revision: 3,
      updatedBy: "Daniel",
      revisions: [
        { revision: 3, instructions: "First", by: "Daniel" },
        { revision: 2, instructions: "Second", byKind: "agent" },
        { revision: 1, instructions: "First" },
      ],
    });
  });

  it("refuses to restore a revision the skill never had", async () => {
    await createSkill({ name: "ui-work" });
    const missing = await new RestoreSkillHandler(
      store.skillRepository,
      clock,
    ).handle({
      ...base,
      type: "tasks.restore-skill",
      skill: "ui-work",
      revision: 7,
      expectedRevision: 1,
    });
    expect(!missing.ok && missing.error.code).toBe("invalid-skill");
  });

  it("says which skill is missing, by name or id", async () => {
    const missing = await link("nope", ["ui"]);
    expect(!missing.ok && missing.error.code).toBe("skill-not-found");
    const query = await new SkillHandler(store, clock).handle(
      skillQuery(OWNER, "nope"),
    );
    expect(!query.ok && query.error.code).toBe("skill-not-found");
  });

  it("links, unlinks and deletes, and lists skills with the open tasks they apply to", async () => {
    await createTask("Header", ["ui"]);
    await createTask("Footer", ["ui"], true);
    await createTask("Migration", ["db"]);
    await createSkill({ name: "ui-work", labels: ["ui"] });
    await createSkill({ name: "db-work", description: "Schema changes." });

    expect((await link("db-work", ["db", "New Label"])).ok).toBe(true);
    const list = (filter = {}) =>
      new ListSkillsHandler(store, clock).handle(
        listSkillsQuery(OWNER, filter),
      );
    expect(
      (await list()).map((skill) => [
        skill.name,
        skill.labels,
        skill.openTasks,
      ]),
    ).toEqual([
      ["db-work", ["db", "new-label"], 1],
      ["ui-work", ["ui"], 1],
    ]);
    expect((await list({ label: "DB" })).map((skill) => skill.name)).toEqual([
      "db-work",
    ]);
    expect((await list({ text: "schema" })).map((skill) => skill.name)).toEqual(
      ["db-work"],
    );
    expect((await labels()).map((label) => label.name)).toContain("new-label");

    await new UnlinkSkillHandler(store.skillRepository, clock).handle({
      ...base,
      type: "tasks.unlink-skill",
      skill: "db-work",
      labels: ["db"],
    });
    expect((await list({ label: "db" })).length).toBe(0);

    await new DeleteSkillHandler(store.skillRepository, clock).handle({
      ...base,
      type: "tasks.delete-skill",
      skill: "ui-work",
    });
    expect((await list()).map((skill) => skill.name)).toEqual(["db-work"]);
  });
});

describe("the brief's skills", () => {
  it("brings each skill linked to the task's own labels once, by name, with the labels that brought it", async () => {
    await createTask("Header", ["ui", "frontend", "bug"]);
    await createTask("Sub", ["db"]);
    await createSkill({ name: "zeta", labels: ["ui", "frontend"] });
    await createSkill({ name: "alpha", labels: ["bug"] });
    await createSkill({ name: "db-work", labels: ["db"] });

    const summary = await brief("T-1");
    expect(summary.ok && summary.value.skills).toEqual([
      {
        name: "alpha",
        description: "Use for alpha.",
        via: ["bug"],
        revision: 1,
        instructions: null,
      },
      {
        name: "zeta",
        description: "Use for zeta.",
        via: ["ui", "frontend"],
        revision: 1,
        instructions: null,
      },
    ]);

    const full = await brief("T-1", true);
    expect(
      full.ok && full.value.skills.map((skill) => skill.instructions),
    ).toEqual(["Follow alpha.", "Follow zeta."]);
  });

  it("sends instructions only while they fit the brief's budget", async () => {
    await createTask("Big", ["a", "b", "c", "d"]);
    const long = "x".repeat(20_000);
    for (const name of ["a1", "b1", "c1", "d1"]) {
      await createSkill({ name, instructions: long, labels: [name[0]!] });
    }
    const full = await brief("T-1", true);
    const sent = full.ok
      ? full.value.skills.filter((skill) => skill.instructions !== null)
      : [];
    expect(sent.length).toBe(BRIEF_INSTRUCTIONS_BUDGET / 20_000);
    expect(full.ok && full.value.skills.at(-1)).toMatchObject({
      name: "d1",
      instructions: null,
    });
  });

  it("has none for a task without labels", async () => {
    await createTask("Plain", []);
    await createSkill({ name: "ui-work", labels: ["ui"] });
    const found = await brief("T-1", true);
    expect(found.ok && found.value.skills).toEqual([]);
  });
});

describe("managing labels", () => {
  const rename = (label: string, name: string) =>
    new RenameLabelHandler(store, clock).handle({
      ...base,
      type: "tasks.rename-label",
      label,
      name,
    });
  const recolour = (label: string, colour: "blue" | "red") =>
    new RecolourLabelHandler(store, clock).handle({
      ...base,
      type: "tasks.recolour-label",
      label,
      colour,
    });
  const createLabel = (name: string) =>
    new CreateLabelHandler(store, clock).handle({
      ...base,
      type: "tasks.create-label",
      labelId: nextId(),
      name,
      colour: "gray",
    });

  it("recolours a label", async () => {
    await createLabel("ui");
    expect((await recolour("UI", "blue")).ok).toBe(true);
    expect(await labels()).toMatchObject([{ name: "ui", colour: "blue" }]);
  });

  it("renames a label on every task and skill carrying it, so no link drops", async () => {
    await createTask("Header", ["ui", "bug"]);
    await createTask("Footer", ["frontend", "ui"]);
    await createSkill({ name: "ui-work", labels: ["ui"] });
    await createSkill({ name: "both", labels: ["ui", "frontend"] });

    expect((await rename("ui", "Frontend")).ok).toBe(false);
    expect((await rename("ui", "web")).ok).toBe(true);

    expect((await store.findByNumber(OWNER, 1))?.state.labels).toEqual([
      "web",
      "bug",
    ]);
    const header = await brief("T-1");
    expect(header.ok && header.value.skills.map((skill) => skill.name)).toEqual(
      ["both", "ui-work"],
    );
    expect(
      (await labels()).map((label) => [label.name, label.tasks, label.skills]),
    ).toEqual([
      ["bug", 1, []],
      ["frontend", 1, ["both"]],
      ["web", 2, ["both", "ui-work"]],
    ]);
  });

  it("refuses a rename onto another label's name", async () => {
    await createLabel("ui");
    await createLabel("web");
    const taken = await rename("ui", "web");
    expect(!taken.ok && taken.error.code).toBe("label-exists");
  });

  it("renames a name tasks carry from before the catalogue, and refuses an unknown one", async () => {
    // Labels written before the catalogue existed are only on tasks.
    await store.save(
      unwrap(
        Task.create({
          id: nextId(),
          ownerId: OWNER,
          number: 1,
          title: "Old",
          labels: ["legacy"],
          author: DANIEL,
          now,
        }),
      ),
    );
    expect(await store.findByName(OWNER, "legacy")).toBeUndefined();

    expect((await rename("legacy", "old")).ok).toBe(true);
    expect((await store.findByNumber(OWNER, 1))?.state.labels).toEqual(["old"]);
    expect((await labels()).map((label) => label.name)).toEqual(["old"]);

    const missing = await rename("never-seen", "x");
    expect(!missing.ok && missing.error.code).toBe("label-not-found");
  });

  it("makes a task loaded before a rename save again on a fresh copy", async () => {
    await createTask("Header", ["ui"]);
    const before = await store.findByNumber(OWNER, 1);
    await rename("ui", "web");

    const stale = await store.save(before!);
    expect(!stale.ok && stale.error.code).toBe("concurrent-modification");

    await new UpdateTaskHandler(store, store, clock).handle({
      ...base,
      type: "tasks.update-task",
      task: "T-1",
      addLabels: ["bug"],
    });
    expect((await store.findByNumber(OWNER, 1))?.state.labels).toEqual([
      "web",
      "bug",
    ]);
  });
});
