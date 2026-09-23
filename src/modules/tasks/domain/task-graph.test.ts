import { describe, expect, it } from "vitest";

import { TaskGraph, type TaskNode } from "./task-graph";

const node = (
  id: string,
  overrides: Partial<Omit<TaskNode, "id">> = {},
): TaskNode => ({
  id,
  number: Number(id.slice(1)),
  status: "todo",
  parentId: null,
  blockedBy: [],
  ...overrides,
});

describe("TaskGraph", () => {
  it("names open blockers and open sub-tasks, and ignores finished ones", () => {
    const graph = new TaskGraph([
      node("t1", { blockedBy: ["t2", "t3"] }),
      node("t2"),
      node("t3", { status: "done" }),
      node("t4", { parentId: "t1" }),
      node("t5", { parentId: "t1", status: "cancelled" }),
    ]);

    expect(graph.surroundingsOf("t1")).toEqual({
      openBlockers: ["T-2"],
      openSubtasks: ["T-4"],
    });
  });

  it("refuses a blocking link that closes a loop", () => {
    const graph = new TaskGraph([
      node("t1", { blockedBy: ["t2"] }),
      node("t2", { blockedBy: ["t3"] }),
      node("t3"),
    ]);

    expect(graph.wouldCycleByBlocking("t3", "t1")).toBe(true);
    expect(graph.wouldCycleByBlocking("t1", "t1")).toBe(true);
    expect(graph.wouldCycleByBlocking("t1", "t3")).toBe(false);
  });

  it("refuses a sub-task blocked by its own ancestor", () => {
    const graph = new TaskGraph([
      node("t1"),
      node("t2", { parentId: "t1" }),
      node("t3", { parentId: "t2" }),
    ]);

    expect(graph.wouldCycleByBlocking("t3", "t1")).toBe(true);
    // A parent waiting on its own sub-task is what it does anyway.
    expect(graph.wouldCycleByBlocking("t1", "t3")).toBe(false);
  });

  it("refuses a parent that is the task's own descendant", () => {
    const graph = new TaskGraph([
      node("t1"),
      node("t2", { parentId: "t1" }),
      node("t3", { parentId: "t2" }),
    ]);

    expect(graph.wouldCycleByParent("t1", "t3")).toBe(true);
    expect(graph.wouldCycleByParent("t3", "t1")).toBe(false);
  });

  it("refuses a parent the task is already blocking", () => {
    const graph = new TaskGraph([
      node("t1", { blockedBy: ["t2"] }),
      node("t2"),
    ]);

    // t1 under t2 makes t2 wait on t1, which already waits on t2. t2 under
    // t1 only makes t1 wait on t2 a second way.
    expect(graph.wouldCycleByParent("t1", "t2")).toBe(true);
    expect(graph.wouldCycleByParent("t2", "t1")).toBe(false);
  });
});
