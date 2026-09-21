/**
 * What the Tasks column and the tasks panel render. No `Task` aggregate exists
 * yet — ticket 08 owns that model, and inventing one to serve a read would be
 * exactly the mistake the plan warns about.
 */

export type TaskState = "running" | "paused" | "blocked" | "ready" | "queued";

export type TaskCount = {
  readonly total: number;
  readonly running: number;
  /** "1 running", "none running", "no tasks" */
  readonly hint: string;
};

/** Keyed by `owner/name`, the join key the route uses. */
export type TaskCountsByRepository = Readonly<Record<string, TaskCount>>;

export type TaskSummary = {
  readonly id: string;
  readonly title: string;
  /** "Session 1 running, 6 min in" */
  readonly lastActivity: string;
  readonly state: TaskState;
  readonly contextItems: number;
};

export type RepositoryTasks = {
  readonly summary: string;
  readonly total: number;
  readonly shown: readonly TaskSummary[];
};
