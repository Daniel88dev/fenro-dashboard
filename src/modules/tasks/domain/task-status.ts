/**
 * `blocked` and `ready` are deliberately missing: they depend on the world
 * around a task and are worked out when read, never stored.
 */
export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export function isOpen(status: TaskStatus): boolean {
  return status !== "done" && status !== "cancelled";
}

export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;

export type Priority = (typeof PRIORITIES)[number];

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

export function priorityRank(priority: Priority): number {
  return PRIORITIES.indexOf(priority);
}
