import { beforeEach, describe, expect, it } from "vitest";

import type { Actor } from "@/modules/tasks/domain";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";

import {
  ChangeStatusHandler,
  type ChangeStatusCommand,
} from "./commands/change-status";
import {
  CreateTaskHandler,
  type CreateTaskCommand,
} from "./commands/create-task";
import { StartTaskHandler } from "./commands/start-task";
import { changeTask } from "./commands/task-commands";
import {
  TaskCountsByRepositoryHandler,
  taskCountsByRepositoryQuery,
} from "./queries/task-counts-by-repository";
import {
  TasksForRepositoryHandler,
  tasksForRepositoryQuery,
} from "./queries/tasks-for-repository";

const OWNER = "user-1";
const DANIEL: Actor = { kind: "human", id: OWNER, name: "Daniel" };
const AGENT: Actor = { kind: "agent", id: "token-1", name: "Claude Code" };

let now: Date;
let store: InMemoryTaskStore;
let ids: number;
const clock = () => now;

beforeEach(() => {
  now = new Date("2026-09-23T10:00:00Z");
  store = new InMemoryTaskStore();
  ids = 0;
});

async function create(
  fields: Partial<CreateTaskCommand> & { title: string },
  ownerId = OWNER,
) {
  ids += 1;
  return new CreateTaskHandler(store, clock).handle({
    type: "tasks.create-task",
    ownerId,
    actor: DANIEL,
    taskId: `00000000-0000-4000-8000-${String(ids).padStart(12, "0")}`,
    ...fields,
  });
}

const changeStatus = (fields: Omit<ChangeStatusCommand, "type" | "ownerId">) =>
  new ChangeStatusHandler(store, clock).handle({
    type: "tasks.change-status",
    ownerId: OWNER,
    ...fields,
  });

describe("creating tasks", () => {
  it("files a sub-task under its parent's repository", async () => {
    await create({ title: "Epic", repository: "Daniel88dev/fenro-dashboard" });
    await create({ title: "Slice", parent: "T-1" });

    const slice = await store.findByNumber(OWNER, 2);
    expect(slice?.state.repository).toMatchObject({
      owner: "Daniel88dev",
      name: "fenro-dashboard",
    });
  });

  it("refuses a sub-task blocked by its own parent, and saves nothing", async () => {
    await create({ title: "Epic" });

    const refused = await create({
      title: "Slice",
      parent: "T-1",
      blockedBy: ["T-1"],
    });
    expect(!refused.ok && refused.error.code).toBe("dependency-cycle");
    expect(await store.findByNumber(OWNER, 2)).toBeUndefined();
  });

  it("numbers each person's tasks on their own", async () => {
    await create({ title: "Mine" });
    await create({ title: "Theirs" }, "user-2");

    expect((await store.findByNumber("user-2", 1))?.state.title).toBe("Theirs");
    const missing = await create({ title: "Linked", blockedBy: ["T-2"] });
    expect(!missing.ok && missing.error.code).toBe("task-not-found");
  });
});

describe("changing a task", () => {
  it("does not close a parent while a sub-task is open", async () => {
    await create({ title: "Epic" });
    await create({ title: "Slice", parent: "T-1" });

    const early = await changeStatus({
      actor: DANIEL,
      task: "T-1",
      status: "done",
    });
    expect(!early.ok && early.error.code).toBe("open-subtasks");

    await changeStatus({ actor: DANIEL, task: "T-2", status: "done" });
    const done = await changeStatus({
      actor: DANIEL,
      task: "T-1",
      status: "done",
    });
    expect(done.ok).toBe(true);
  });

  it("tries again on a fresh copy when another request saved first", async () => {
    await create({ title: "Busy" });
    let attempts = 0;

    const changed = await changeTask(store, OWNER, "T-1", async (task) => {
      attempts += 1;
      if (attempts === 1) {
        // Someone else saves between this load and this save.
        const other = (await store.findByNumber(OWNER, 1))!;
        other.note("note", "Got here first", AGENT, now);
        await store.save(other);
      }
      return task.note("note", "Still lands", DANIEL, now);
    });

    expect(changed.ok).toBe(true);
    expect(attempts).toBe(2);
    const detail = await store.detail(
      OWNER,
      (await store.findByNumber(OWNER, 1))!.id.value,
    );
    expect(detail?.journal.map((entry) => entry.text)).toEqual([
      "Got here first",
      "Still lands",
    ]);
  });
});

describe("the repository table's view of tasks", () => {
  it("counts open tasks per repository, whatever the case, and who is on them", async () => {
    await create({ title: "One", repository: "Daniel88dev/Fenro-Dashboard" });
    await create({ title: "Two", repository: "daniel88dev/fenro-dashboard" });
    await create({ title: "Elsewhere", repository: "nordwind/docs" });
    await new StartTaskHandler(store, clock).handle({
      type: "tasks.start-task",
      ownerId: OWNER,
      actor: AGENT,
      task: "T-2",
    });

    const counts = await new TaskCountsByRepositoryHandler(store, clock).handle(
      taskCountsByRepositoryQuery(OWNER),
    );
    expect(counts["daniel88dev/fenro-dashboard"]).toEqual({
      total: 2,
      running: 1,
      hint: "1 running",
    });

    now = new Date("2026-09-23T10:06:00Z");
    const panel = await new TasksForRepositoryHandler(store, clock).handle(
      tasksForRepositoryQuery(OWNER, "Daniel88dev", "fenro-dashboard"),
    );
    expect(panel.summary).toBe("1 running, 1 not started");
    expect(panel.shown[0]).toMatchObject({
      id: "T-2",
      state: "running",
      lastActivity: "Session 1 running, 6 min in",
    });
  });
});
