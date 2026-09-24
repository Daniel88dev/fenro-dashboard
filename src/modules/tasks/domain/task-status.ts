/**
 * Where a task stands in its lifecycle, as a fixed set rather than a workflow
 * each user configures: an agent should never have to ask which states exist.
 *
 * `blocked` and `ready` are deliberately missing. They describe the world
 * around a task — whether what it depends on is finished, whether an agent
 * holds it — and are worked out when read, never stored (ticket 08).
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

/** Done and cancelled tasks block nothing and need nothing. */
export function isOpen(status: TaskStatus): boolean {
  return status !== "done" && status !== "cancelled";
}

export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;

export type Priority = (typeof PRIORITIES)[number];

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

/** Lower sorts first. */
export function priorityRank(priority: Priority): number {
  return PRIORITIES.indexOf(priority);
}
