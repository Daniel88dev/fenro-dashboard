import type {
  ExternalSystem,
  JournalKind,
  Priority,
  TaskStatus,
} from "@/modules/tasks/domain";

/**
 * What the tasks context answers with: plain objects with ISO-string times, so
 * they cross the React Server Component boundary and serialise to an agent
 * as they are.
 */

/**
 * Where a task stands, all things considered: its status, whether anything
 * holds it back, whether an agent is on it. The one word a list shows.
 *
 * - `ready`: todo, nothing blocking, nobody on it — the next thing to pick up.
 * - `paused`: in progress, but no session is running; ready to resume.
 * - `waiting`: todo, but its sub-tasks come first.
 * - `blocked`: on hold, or blocked by an open task.
 */
export type TaskState =
  | "backlog"
  | "ready"
  | "waiting"
  | "blocked"
  | "running"
  | "paused"
  | "in-review"
  | "done"
  | "cancelled";

/** One task in a list: enough to choose it, not enough to work it. */
export type TaskListItem = {
  readonly key: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly state: TaskState;
  readonly priority: Priority;
  readonly labels: readonly string[];
  readonly repository: string | null;
  readonly parent: string | null;
  /** Keys of the open tasks it is blocked by. */
  readonly blockedBy: readonly string[];
  readonly hold: string | null;
  /** The agent or person with a live session on it. */
  readonly workedOnBy: string | null;
  readonly subtasks: { readonly open: number; readonly total: number };
  readonly criteria: { readonly met: number; readonly total: number };
  readonly journalEntries: number;
  readonly updatedAt: string;
};

export type TaskList = {
  /** How many matched, of which `tasks` holds the first `limit`. */
  readonly total: number;
  readonly tasks: readonly TaskListItem[];
};

export type TaskMention = {
  readonly key: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly state: TaskState;
};

export type JournalItem = {
  readonly kind: JournalKind;
  readonly text: string;
  readonly author: string;
  readonly session: number | null;
  readonly recordedAt: string;
};

/**
 * Everything the next session needs to pick a task up: what it is, how to know
 * it is finished, what stands in its way, and what earlier sessions learned.
 * Derived on every read rather than stored (ticket 08).
 */
export type TaskBrief = {
  readonly key: string;
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly state: TaskState;
  readonly priority: Priority;
  readonly labels: readonly string[];
  readonly repository: string | null;
  readonly description: string;
  readonly acceptanceCriteria: readonly {
    readonly number: number;
    readonly text: string;
    readonly met: boolean;
    readonly evidence: string | null;
  }[];
  readonly hold: { readonly reason: string; readonly since: string } | null;
  readonly parent: TaskMention | null;
  readonly subtasks: readonly TaskMention[];
  readonly blockedBy: readonly TaskMention[];
  readonly blocks: readonly TaskMention[];
  readonly relatesTo: readonly TaskMention[];
  readonly discoveredFrom: TaskMention | null;
  readonly discovered: readonly TaskMention[];
  readonly references: readonly {
    readonly system: ExternalSystem;
    readonly key: string;
    readonly url: string;
    readonly title: string | null;
    readonly isSource: boolean;
  }[];
  readonly session: {
    readonly number: number;
    readonly by: string;
    readonly startedAt: string;
    readonly lastSeenAt: string;
    readonly live: boolean;
  } | null;
  readonly sessions: number;
  /** The summary the last session left. Read this first. */
  readonly latestHandoff: JournalItem | null;
  /** Every decision ever recorded: they stay true until a later one says not. */
  readonly decisions: readonly JournalItem[];
  /** The most recent entries of any kind, oldest first. */
  readonly recentJournal: readonly JournalItem[];
  readonly journalEntries: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// --- The repository table ---------------------------------------------------

export type TaskCount = {
  readonly total: number;
  readonly running: number;
  /** "1 running", "none running", "no tasks" */
  readonly hint: string;
};

/**
 * Open tasks per repository, keyed by `owner/name` in lower case: GitHub
 * names are case-insensitive, and the route joins on this key.
 */
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
