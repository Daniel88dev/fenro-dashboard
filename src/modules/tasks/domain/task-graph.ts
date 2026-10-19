import { formatTaskKey, PERSONAL_KEY_PREFIX } from "./task-key";
import type { TaskSurroundings } from "./task";
import { isOpen, type TaskStatus } from "./task-status";

export type TaskNode = {
  readonly id: string;
  readonly number: number;
  readonly status: TaskStatus;
  readonly parentId: string | null;
  readonly blockedBy: readonly string[];
};

/**
 * Each task is its own aggregate, so no single task can see a cycle; this
 * service is asked before a link or a new parent is saved.
 */
export class TaskGraph {
  readonly #nodes: ReadonlyMap<string, TaskNode>;
  readonly #children = new Map<string, string[]>();

  constructor(
    nodes: Iterable<TaskNode>,
    readonly keyPrefix: string = PERSONAL_KEY_PREFIX,
  ) {
    this.#nodes = new Map([...nodes].map((node) => [node.id, node]));
    for (const node of this.#nodes.values()) {
      if (!node.parentId) continue;
      const siblings = this.#children.get(node.parentId) ?? [];
      siblings.push(node.id);
      this.#children.set(node.parentId, siblings);
    }
  }

  with(node: TaskNode): TaskGraph {
    return new TaskGraph([...this.#nodes.values(), node], this.keyPrefix);
  }

  surroundingsOf(id: string): TaskSurroundings {
    const node = this.#nodes.get(id);
    const openBlockers = (node?.blockedBy ?? [])
      .map((blockerId) => this.#nodes.get(blockerId))
      .filter((blocker) => blocker !== undefined && isOpen(blocker.status))
      .map((blocker) => formatTaskKey(blocker!.number, this.keyPrefix));
    const openSubtasks = (this.#children.get(id) ?? [])
      .map((childId) => this.#nodes.get(childId)!)
      .filter((child) => isOpen(child.status))
      .map((child) => formatTaskKey(child.number, this.keyPrefix));
    return { openBlockers, openSubtasks };
  }

  wouldCycleByBlocking(taskId: string, blockerId: string): boolean {
    return taskId === blockerId || this.#waitsOn(blockerId, taskId);
  }

  wouldCycleByParent(childId: string, parentId: string): boolean {
    return childId === parentId || this.#waitsOn(childId, parentId);
  }

  /**
   * Treating blocking and sub-tasks as one relation is what catches a
   * sub-task blocked by its own parent, which would never become ready.
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
