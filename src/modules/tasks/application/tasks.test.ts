import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultLabelColour,
  type Actor,
  type LabelColour,
} from "@/modules/tasks/domain";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";

import {
  ChangeStatusHandler,
  type ChangeStatusCommand,
} from "./commands/change-status";
import { CreateLabelHandler } from "./commands/create-label";
import {
  CreateTaskHandler,
  type CreateTaskCommand,
} from "./commands/create-task";
import { StartTaskHandler } from "./commands/start-task";
import { changeTask } from "./commands/task-commands";
import {
  UpdateTaskHandler,
  type UpdateTaskCommand,
} from "./commands/update-task";
import { ListLabelsHandler, listLabelsQuery } from "./queries/list-labels";
import {
  ListTaskRepositoriesHandler,
  listTaskRepositoriesQuery,
} from "./queries/list-task-repositories";
import { ListTasksHandler, listTasksQuery } from "./queries/list-tasks";
import {
  excerpt,
  SearchTasksHandler,
  searchTasksQuery,
} from "./queries/search-tasks";
import { TaskBoardHandler, taskBoardQuery } from "./queries/task-board";
import { TasksScreenHandler, tasksScreenQuery } from "./queries/tasks-screen";
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
  return new CreateTaskHandler(store, store, clock).handle({
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

describe("the repositories tasks name", () => {
  it("lists each once whatever the case, with open and all task counts", async () => {
    await create({ title: "One", repository: "Daniel88dev/Fenro-Dashboard" });
    await create({ title: "Two", repository: "daniel88dev/fenro-dashboard" });
    await create({ title: "Elsewhere", repository: "nordwind/docs" });
    await create({ title: "Nowhere" });
    await create({ title: "Theirs", repository: "someone/else" }, "user-2");
    await changeStatus({ actor: DANIEL, task: "T-3", status: "done" });

    const repositories = await new ListTaskRepositoriesHandler(store).handle(
      listTaskRepositoriesQuery(OWNER),
    );
    expect(repositories).toEqual([
      { name: "Daniel88dev/Fenro-Dashboard", openTasks: 2, tasks: 2 },
      { name: "nordwind/docs", openTasks: 0, tasks: 1 },
    ]);
  });
});

describe("listing tasks by state", () => {
  it("finds what is in progress and what is blocked, as a person sorts them", async () => {
    await create({ title: "Taken" });
    await create({ title: "Waiting", blockedBy: ["T-1"] });
    await create({ title: "Free" });
    await new StartTaskHandler(store, clock).handle({
      type: "tasks.start-task",
      ownerId: OWNER,
      actor: AGENT,
      task: "T-1",
    });
    const list = new ListTasksHandler(store, clock);

    const active = await list.handle(
      listTasksQuery(OWNER, { states: ["running", "paused", "in-review"] }),
    );
    const blocked = await list.handle(
      listTasksQuery(OWNER, { states: ["blocked", "waiting"] }),
    );
    expect(active.tasks.map((task) => task.key)).toEqual(["T-1"]);
    expect(blocked.tasks.map((task) => task.key)).toEqual(["T-2"]);
  });
});

describe("labels", () => {
  const labels = () =>
    new ListLabelsHandler(store).handle(listLabelsQuery(OWNER));
  const update = (
    fields: Omit<UpdateTaskCommand, "type" | "ownerId" | "actor">,
  ) =>
    new UpdateTaskHandler(store, store, clock).handle({
      type: "tasks.update-task",
      ownerId: OWNER,
      actor: DANIEL,
      ...fields,
    });

  it("adds a name no label has yet to the owner's labels, each in its own colour", async () => {
    await create({ title: "Sign-in", labels: ["Bug", "needs review"] });
    await create({ title: "Theirs", labels: ["bug"] }, "user-2");
    await create({ title: "More", labels: ["ci", "ui", "docs"] });

    const made = await labels();
    expect(made.map((label) => [label.name, label.openTasks])).toEqual([
      ["bug", 1],
      ["ci", 1],
      ["docs", 1],
      ["needs-review", 1],
      ["ui", 1],
    ]);
    expect(new Set(made.map((label) => label.colour)).size).toBe(5);
    expect(made[0]!.colour).toBe(defaultLabelColour("bug"));
  });

  it("keeps a label made ahead of use, and refuses a second of the same name", async () => {
    const make = (name: string, colour?: LabelColour) =>
      new CreateLabelHandler(store, clock).handle({
        type: "tasks.create-label",
        ownerId: OWNER,
        actor: DANIEL,
        labelId: crypto.randomUUID(),
        name,
        colour,
      });

    expect((await make("Area:Auth", "blue")).ok).toBe(true);
    const again = await make("area:auth");
    expect(!again.ok && again.error.code).toBe("label-exists");
    const bad = await make("no, commas");
    expect(!bad.ok && bad.error.code).toBe("invalid-label");

    await create({ title: "Session expiry", labels: ["area:auth"] });
    expect(await labels()).toEqual([
      {
        name: "area:auth",
        colour: "blue",
        openTasks: 1,
        tasks: 1,
        skills: [],
      },
    ]);
  });

  it("adds and removes labels without repeating the rest", async () => {
    await create({ title: "Sign-in", labels: ["bug", "backend"] });

    await update({ task: "T-1", addLabels: ["urgent"], removeLabels: ["Bug"] });

    expect((await store.findByNumber(OWNER, 1))?.state.labels).toEqual([
      "backend",
      "urgent",
    ]);
    expect((await labels()).map((label) => label.name)).toContain("urgent");
  });

  it("lists tasks carrying any of the labels asked for", async () => {
    await create({ title: "One", labels: ["bug"] });
    await create({ title: "Two", labels: ["docs"] });
    await create({ title: "Three" });

    const list = await new ListTasksHandler(store, clock).handle(
      listTasksQuery(OWNER, { labels: ["docs", "Bug"] }),
    );
    expect(list.tasks.map((task) => task.key)).toEqual(["T-1", "T-2"]);
  });
});

const update = (
  fields: Omit<UpdateTaskCommand, "type" | "ownerId" | "actor">,
) =>
  new UpdateTaskHandler(store, store, clock).handle({
    type: "tasks.update-task",
    ownerId: OWNER,
    actor: DANIEL,
    ...fields,
  });

describe("epics", () => {
  async function anEpic() {
    await create({ title: "Ship tasks v2", kind: "epic" });
    await create({ title: "Board", parent: "T-1" });
    await create({ title: "Drag a card", parent: "T-2" });
    await create({ title: "Label select", parent: "T-1" });
    await create({ title: "Loose end" });
  }

  it("scopes the list to an epic's tasks at any depth, or to loose work", async () => {
    await anEpic();
    const list = new ListTasksHandler(store, clock);
    const keys = async (filter: Parameters<typeof listTasksQuery>[1]) =>
      (await list.handle(listTasksQuery(OWNER, filter))).tasks
        .map((task) => task.key)
        .sort();

    expect(await keys({ epic: "T-1" })).toEqual(["T-2", "T-3", "T-4"]);
    expect(await keys({ kinds: ["epic"] })).toEqual(["T-1"]);
    expect(await keys({ outsideEpics: true })).toEqual(["T-5"]);
    expect(await keys({ epic: "T-2" })).toEqual([]);
  });

  it("names the epic above each task and counts an epic's progress", async () => {
    await anEpic();
    await changeStatus({ actor: DANIEL, task: "T-4", status: "done" });
    const { tasks } = await new ListTasksHandler(store, clock).handle(
      listTasksQuery(OWNER, { includeClosed: true }),
    );
    const byKey = new Map(tasks.map((task) => [task.key, task]));

    expect(byKey.get("T-3")?.epic).toEqual({
      key: "T-1",
      title: "Ship tasks v2",
    });
    expect(byKey.get("T-5")?.epic).toBeNull();
    expect(byKey.get("T-1")?.progress).toEqual({ done: 1, total: 2 });
  });

  it("never offers an epic as ready work", async () => {
    await create({ title: "Ship tasks v2", kind: "epic" });
    await create({ title: "Loose end" });

    const ready = await new ListTasksHandler(store, clock).handle(
      listTasksQuery(OWNER, { ready: true }),
    );

    expect(ready.tasks.map((task) => task.key)).toEqual(["T-2"]);
  });

  it("makes a sub-task an epic by taking it out from under its parent", async () => {
    await create({ title: "Big" });
    await create({ title: "Bigger still", parent: "T-1" });

    const changed = await update({ task: "T-2", kind: "epic", parent: null });

    expect(changed.ok).toBe(true);
    const task = await store.findByNumber(OWNER, 2);
    expect(task?.kind).toBe("epic");
    expect(task?.state.parentId ?? null).toBeNull();
  });

  it("keeps an epic's tasks under it when it turns back into a task", async () => {
    await anEpic();

    expect((await update({ task: "T-1", kind: "task" })).ok).toBe(true);

    const { tasks } = await new ListTasksHandler(store, clock).handle(
      listTasksQuery(OWNER, {}),
    );
    const byKey = new Map(tasks.map((task) => [task.key, task]));
    expect(byKey.get("T-1")?.kind).toBe("task");
    expect((await store.findByNumber(OWNER, 2))?.parentId).toBe(
      (await store.findByNumber(OWNER, 1))?.id.value,
    );
    expect(byKey.get("T-2")?.epic).toBeNull();
  });

  it("keeps a task's sub-tasks when it becomes an epic", async () => {
    await create({ title: "Board" });
    await create({ title: "Drag a card", parent: "T-1" });

    expect((await update({ task: "T-1", kind: "epic" })).ok).toBe(true);

    const { tasks } = await new ListTasksHandler(store, clock).handle(
      listTasksQuery(OWNER, { epic: "T-1" }),
    );
    expect(tasks.map((task) => task.key)).toEqual(["T-2"]);
  });
});

describe("the board", () => {
  it("puts open and done tasks in their status columns, under the same scope", async () => {
    await create({ title: "Ship tasks v2", kind: "epic" });
    await create({ title: "Board", parent: "T-1" });
    await create({ title: "Later", parent: "T-1", status: "backlog" });
    await create({ title: "Elsewhere" });
    await changeStatus({ actor: DANIEL, task: "T-2", status: "in_progress" });

    const { columns } = await new TaskBoardHandler(store, clock).handle(
      taskBoardQuery(OWNER, { epic: "T-1" }),
    );
    const keysIn = (status: string) =>
      columns
        .find((column) => column.status === status)
        ?.tasks.map((task) => task.key);

    expect(columns.map((column) => column.status)).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
    ]);
    expect(keysIn("backlog")).toEqual(["T-3"]);
    expect(keysIn("in_progress")).toEqual(["T-2"]);
    expect(keysIn("todo")).toEqual([]);
  });

  it("keeps only tasks finished within the done window, latest first", async () => {
    await create({ title: "Long ago" });
    await create({ title: "This month" });
    await create({ title: "This week" });
    const finish = async (task: string, at: string) => {
      now = new Date(at);
      await changeStatus({ actor: DANIEL, task, status: "done" });
    };
    await finish("T-1", "2026-06-01T10:00:00Z");
    await finish("T-3", "2026-09-20T10:00:00Z");
    await finish("T-2", "2026-09-05T10:00:00Z");
    now = new Date("2026-09-23T10:00:00Z");

    const doneIn = async (window: "week" | "month" | "all") => {
      const { columns } = await new TaskBoardHandler(store, clock).handle(
        taskBoardQuery(OWNER, {}, window),
      );
      const done = columns.find((column) => column.status === "done")!;
      return {
        keys: done.tasks.map((task) => task.key),
        total: done.total,
        earlier: done.finishedEarlier,
      };
    };

    expect(await doneIn("week")).toEqual({
      keys: ["T-3"],
      total: 1,
      earlier: 2,
    });
    expect(await doneIn("month")).toEqual({
      keys: ["T-3", "T-2"],
      total: 2,
      earlier: 1,
    });
    expect(await doneIn("all")).toEqual({
      keys: ["T-3", "T-2", "T-1"],
      total: 3,
      earlier: 0,
    });
  });

  it("shows a task moved into progress by hand as paused", async () => {
    await create({ title: "Board" });

    const moved = await changeStatus({
      actor: DANIEL,
      task: "T-1",
      status: "in_progress",
    });

    expect(moved.ok).toBe(true);
    const { tasks } = await new ListTasksHandler(store, clock).handle(
      listTasksQuery(OWNER),
    );
    expect(tasks[0]?.state).toBe("paused");
  });

  it("refuses an agent dragging a task into progress", async () => {
    await create({ title: "Board" });

    const moved = await changeStatus({
      actor: AGENT,
      task: "T-1",
      status: "in_progress",
    });

    expect(!moved.ok && moved.error.code).toBe("invalid-transition");
  });
});

describe("the tasks screen", () => {
  async function work() {
    await create({ title: "Ship tasks v2", kind: "epic" });
    await create({
      title: "Board",
      parent: "T-1",
      labels: ["ui"],
      repository: "daniel88dev/fenro-dashboard",
    });
    await create({ title: "Waiting", blockedBy: ["T-2"] });
    await create({ title: "Shipped", labels: ["ui"] });
    await changeStatus({ actor: DANIEL, task: "T-4", status: "done" });
  }

  it("answers the list, its counts and facets from one read of the tasks", async () => {
    await work();
    const records = vi.spyOn(store, "records");

    const screen = await new TasksScreenHandler(store, clock).handle(
      tasksScreenQuery(
        OWNER,
        { layout: "list", filter: { limit: 100 } },
        {
          blocked: { states: ["blocked", "waiting"] },
          closed: { statuses: ["done", "cancelled"] },
          inEpic: { epic: "T-1" },
        },
      ),
    );

    expect(records).toHaveBeenCalledTimes(1);
    expect(screen.content.layout).toBe("list");
    if (screen.content.layout !== "list") return;
    expect(screen.content.list.tasks.map((task) => task.key).sort()).toEqual([
      "T-1",
      "T-2",
      "T-3",
    ]);
    records.mockRestore();
    const list = new ListTasksHandler(store, clock);
    const total = async (filter: Parameters<typeof listTasksQuery>[1]) =>
      (await list.handle(listTasksQuery(OWNER, filter))).total;
    expect(screen.counts).toEqual({
      blocked: await total({ states: ["blocked", "waiting"] }),
      closed: 1,
      inEpic: 1,
    });
    expect(screen.epics.map((task) => task.key)).toEqual(["T-1"]);
    expect(
      screen.labels.map((label) => [label.name, label.openTasks, label.tasks]),
    ).toEqual([["ui", 1, 2]]);
    expect(screen.repositories).toEqual([
      { name: "daniel88dev/fenro-dashboard", openTasks: 1, tasks: 1 },
    ]);
  });

  it("answers the board the board query would", async () => {
    await work();
    const query = { epic: "T-1" };

    const screen = await new TasksScreenHandler(store, clock).handle(
      tasksScreenQuery(OWNER, { layout: "board", filter: query, done: "week" }),
    );

    expect(screen.content).toEqual({
      layout: "board",
      board: await new TaskBoardHandler(store, clock).handle(
        taskBoardQuery(OWNER, query, "week"),
      ),
    });
  });
});

describe("searching tasks", () => {
  const search = (text: string, descriptions = false) =>
    new SearchTasksHandler(store, clock).handle(
      searchTasksQuery(OWNER, text, descriptions),
    );
  const keys = (hits: readonly { key: string }[]) => hits.map((hit) => hit.key);

  beforeEach(async () => {
    await create({ title: "GitHub sync reliability", kind: "epic" });
    await create({
      title: "Retry the sync after a rate limit",
      description: "Wait for the reset header.",
    });
    await create({
      title: "Board on touch screens",
      description: "Keep the board in SYNC with the list after a drop.",
    });
    await create({ title: "Someone else's sync" }, "user-2");
  });

  it("finds tasks and epics by every word of their name, never another owner's", async () => {
    const found = await search("  Sync  ");

    expect(keys(found.tasks)).toEqual(["T-2"]);
    expect(keys(found.epics)).toEqual(["T-1"]);
    expect(found.tasks[0]).toMatchObject({ state: "ready", excerpt: null });
    expect(keys((await search("rate sync")).tasks)).toEqual(["T-2"]);
  });

  it("only counts description matches until descriptions are switched on", async () => {
    const off = await search("sync");
    expect(off.inDescriptions).toEqual([]);
    expect(off.moreInDescriptions).toBe(1);

    const on = await search("sync", true);
    expect(keys(on.inDescriptions)).toEqual(["T-3"]);
    expect(on.inDescriptions[0]!.excerpt).toBe(
      "Keep the board in SYNC with the list after a drop.",
    );
    expect(on.moreInDescriptions).toBe(0);
  });

  it("finds a task by its key, the exact number first", async () => {
    for (let n = 4; n <= 12; n += 1) await create({ title: `Task ${n}` });

    expect(keys((await search("T-1")).byNumber)).toEqual([
      "T-1",
      "T-10",
      "T-11",
      "T-12",
    ]);
    expect(keys((await search("#2")).byNumber)).toEqual(["T-2"]);
    const twelve = await search("12");
    expect(keys(twelve.byNumber)).toEqual(["T-12"]);
    expect(twelve.tasks).toEqual([]);
    expect(twelve.moreInDescriptions).toBe(0);
  });

  it("offers recently changed tasks when nothing is typed", async () => {
    now = new Date("2026-09-24T10:00:00Z");
    await changeStatus({ actor: DANIEL, task: "T-3", status: "in_progress" });

    const found = await search("");
    expect(keys(found.recent)).toEqual(["T-3", "T-1", "T-2"]);
    expect(found.tasks).toEqual([]);
  });

  it("cuts a long description down to the words around the match", () => {
    const text = `${"a".repeat(100)}\n\nthe sync ${"b".repeat(200)}`;
    const cut = excerpt(text, ["sync"]);

    expect(cut.startsWith("…")).toBe(true);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).toContain(" the sync b");
  });
});
