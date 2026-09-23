import { formatTaskKey } from "./task-key";
import type { TaskSurroundings } from "./task";
import { isOpen, type TaskStatus } from "./task-status";

/** What the graph needs to know about each of one person's tasks. */
export type TaskNode = {
  readonly id: string;
  readonly number: number;
  readonly status: TaskStatus;
  readonly parentId: string | null;
  readonly blockedBy: readonly string[];
};

/**
 * The rules that span tasks, over one person's whole task graph: a task may
 * not end up waiting on itself, through `blocked-by` links or through its
 * parents. Each task is its own aggregate, so no single task can see a cycle;
 * this service is asked before a link or a new parent is saved.
 *
 * It is small enough to load whole: one person's tasks, their parents and
 * their blocking links, without descriptions or journals.
 */
export class TaskGraph {
  readonly #nodes: ReadonlyMap<string, TaskNode>;
  readonly #children = new Map<string, string[]>();

  constructor(nodes: Iterable<TaskNode>) {
    this.#nodes = new Map([...nodes].map((node) => [node.id, node]));
    for (const node of this.#nodes.values()) {
      if (!node.parentId) continue;
      const siblings = this.#children.get(node.parentId) ?? [];
      siblings.push(node.id);
      this.#children.set(node.parentId, siblings);
    }
  }

  /** The same graph with one more task in it, to check a task before it exists. */
  with(node: TaskNode): TaskGraph {
    return new TaskGraph([...this.#nodes.values(), node]);
  }

  /** What `Task` must be told about the world around it. */
  surroundingsOf(id: string): TaskSurroundings {
    const node = this.#nodes.get(id);
    const openBlockers = (node?.blockedBy ?? [])
      .map((blockerId) => this.#nodes.get(blockerId))
      .filter((blocker) => blocker !== undefined && isOpen(blocker.status))
      .map((blocker) => formatTaskKey(blocker!.number));
    const openSubtasks = (this.#children.get(id) ?? [])
      .map((childId) => this.#nodes.get(childId)!)
      .filter((child) => isOpen(child.status))
      .map((child) => formatTaskKey(child.number));
    return { openBlockers, openSubtasks };
  }

  /**
   * Would "`taskId` is blocked by `blockerId`" leave a task waiting on itself?
   * True when `blockerId` already waits on `taskId`.
   */
  wouldCycleByBlocking(taskId: string, blockerId: string): boolean {
    return taskId === blockerId || this.#waitsOn(blockerId, taskId);
  }

  /**
   * Would making `parentId` the parent of `childId` leave a task waiting on
   * itself? A parent waits on its new child, so this is true when the child
   * already waits on the parent: it is the parent's ancestor, or blocked by
   * it or by one of its ancestors.
   */
  wouldCycleByParent(childId: string, parentId: string): boolean {
    return childId === parentId || this.#waitsOn(childId, parentId);
  }

  /**
   * Whether `from` cannot finish before `target` does. A task waits on what
   * blocks it and on its sub-tasks, since a parent is not done until they
   * are. Treating both as one relation is what catches a sub-task blocked by
   * its own parent, which would never become ready.
   */
  #waitsOn(from: string, target: string): boolean {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === target) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(this.#nodes.get(id)?.blockedBy ?? []));
      stack.push(...(this.#children.get(id) ?? []));
    }
    return false;
  }
}
