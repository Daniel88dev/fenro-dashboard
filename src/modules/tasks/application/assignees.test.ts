import { beforeEach, describe, expect, it } from "vitest";

import type { Actor, SpaceMember } from "@/modules/tasks/domain";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";

import {
  CreateTaskHandler,
  type CreateTaskCommand,
} from "./commands/create-task";
import { ReleaseAssigneeHandler } from "./commands/release-assignee";
import { UpdateTaskHandler } from "./commands/update-task";
import type { SpaceMembers } from "./ports/space-members";
import { ListTasksHandler, listTasksQuery } from "./queries/list-tasks";

const OWNER = "user-1";
const GROUP = "group-hal";
const DANIEL: Actor = { kind: "human", id: OWNER, name: "Daniel88dev" };
const HAL: readonly SpaceMember[] = [
  { userId: OWNER, login: "Daniel88dev" },
  { userId: "user-2", login: "mira" },
];

const members: SpaceMembers = {
  of: async (ownerId, prefix) =>
    ownerId === GROUP && prefix === "HAL" ? HAL : [],
};

let store: InMemoryTaskStore;
let ids: number;
const clock = () => new Date("2026-10-27T10:00:00Z");

beforeEach(() => {
  store = new InMemoryTaskStore();
  ids = 0;
});

function create(
  fields: Partial<CreateTaskCommand> & { title: string },
  ownerId = GROUP,
) {
  ids += 1;
  return new CreateTaskHandler(store, store, clock, members).handle({
    type: "tasks.create-task",
    ownerId,
    keyPrefix: ownerId === GROUP ? "HAL" : undefined,
    actor: DANIEL,
    taskId: `00000000-0000-4000-8000-${String(ids).padStart(12, "0")}`,
    ...fields,
  });
}

const assign = (task: string, assignee: string | null, ownerId = GROUP) =>
  new UpdateTaskHandler(store, store, clock, members).handle({
    type: "tasks.update-task",
    ownerId,
    actor: DANIEL,
    task,
    assignee,
  });

const list = (filter: Parameters<typeof listTasksQuery>[1]) =>
  new ListTasksHandler(store, clock).handle(
    listTasksQuery([OWNER, GROUP], filter),
  );

describe("task assignees", () => {
  it("creates a group task assigned to the member named", async () => {
    expect((await create({ title: "Board", assignee: "mira" })).ok).toBe(true);

    const task = await store.findByNumber(GROUP, 1);
    expect(task?.state.assignee).toEqual({ userId: "user-2", login: "mira" });
  });

  it("refuses to create a group task for someone outside the group", async () => {
    const created = await create({ title: "Board", assignee: "stranger" });

    expect(!created.ok && created.error.code).toBe("invalid-assignee");
    expect(await store.findByNumber(GROUP, 1)).toBeUndefined();
  });

  it("refuses an assignee on a personal task", async () => {
    await create({ title: "Mine" }, OWNER);

    const assigned = await assign("T-1", "mira", OWNER);

    expect(!assigned.ok && assigned.error.code).toBe("invalid-assignee");
  });

  it("reassigns and unassigns a group task", async () => {
    await create({ title: "Board" });

    expect((await assign("HAL-1", "Daniel88dev")).ok).toBe(true);
    expect((await store.findByNumber(GROUP, 1))?.assigneeId).toBe(OWNER);

    expect((await assign("HAL-1", null)).ok).toBe(true);
    expect((await store.findByNumber(GROUP, 1))?.state.assignee).toBeNull();
  });

  it("filters by assignee, counting personal tasks as their owner's", async () => {
    await create({ title: "Mine" }, OWNER);
    await create({ title: "Daniel's", assignee: "Daniel88dev" });
    await create({ title: "Mira's", assignee: "mira" });
    await create({ title: "Nobody's" });

    const titles = async (assignees: (string | null)[]) =>
      (await list({ assignees })).tasks.map((task) => task.title).sort();

    expect(await titles([OWNER])).toEqual(["Daniel's", "Mine"]);
    expect(await titles([null])).toEqual(["Nobody's"]);
    expect(await titles(["user-2", null])).toEqual(["Mira's", "Nobody's"]);
  });

  it("shows the assignee on list items", async () => {
    await create({ title: "Mine" }, OWNER);
    await create({ title: "Mira's", assignee: "mira" });

    const { tasks } = await list({});

    expect(
      Object.fromEntries(tasks.map((task) => [task.key, task.assignee])),
    ).toEqual({
      "T-1": { id: OWNER, login: null },
      "HAL-1": { id: "user-2", login: "mira" },
    });
  });

  it("unassigns everything a member held when they leave", async () => {
    await create({ title: "One", assignee: "mira" });
    await create({ title: "Two", assignee: "mira" });
    await create({ title: "Daniel's", assignee: "Daniel88dev" });

    const released = await new ReleaseAssigneeHandler(store, clock).handle({
      type: "tasks.release-assignee",
      ownerId: GROUP,
      actor: DANIEL,
      userId: "user-2",
    });

    expect(released.ok).toBe(true);
    expect(await store.assignedTo(GROUP, "user-2")).toEqual([]);
    expect((await store.findByNumber(GROUP, 3))?.assigneeId).toBe(OWNER);
  });
});
