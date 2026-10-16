import type {
  ExternalSystem,
  JournalKind,
  LabelColour,
  PictureType,
  Priority,
  TaskKind,
  TaskStatus,
} from "@/modules/tasks/domain";

/**
 * Plain objects with ISO-string times, so they cross the React Server
 * Component boundary and serialise to an agent as they are.
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

export type LabelItem = {
  readonly name: string;
  readonly colour: LabelColour;
  readonly openTasks: number;
  readonly tasks: number;
  readonly skills: readonly string[];
};

export type SkillItem = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly revision: number;
  readonly openTasks: number;
  readonly updatedBy: string;
  readonly updatedByKind: "agent" | "human";
  readonly updatedAt: string;
};

export type SkillRevisionItem = {
  readonly revision: number;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly by: string;
  readonly byKind: "agent" | "human";
  readonly at: string;
};

export type SkillDetail = SkillItem & {
  readonly instructions: string;
  readonly createdBy: string;
  readonly createdByKind: "agent" | "human";
  readonly createdAt: string;
  readonly revisions: readonly SkillRevisionItem[];
};

export type BriefSkill = {
  readonly name: string;
  readonly description: string;
  readonly via: readonly string[];
  readonly revision: number;
  readonly instructions: string | null;
};

export type TaskRepositoryItem = {
  readonly name: string;
  readonly openTasks: number;
  readonly tasks: number;
};

export type EpicMention = { readonly key: string; readonly title: string };

export type TaskListItem = {
  readonly key: string;
  readonly kind: TaskKind;
  readonly title: string;
  readonly status: TaskStatus;
  readonly state: TaskState;
  readonly priority: Priority;
  readonly labels: readonly string[];
  readonly repository: string | null;
  readonly parent: string | null;
  readonly epic: EpicMention | null;
  readonly progress: { readonly done: number; readonly total: number } | null;
  readonly blockedBy: readonly string[];
  readonly hold: string | null;
  readonly workedOnBy: string | null;
  readonly subtasks: { readonly open: number; readonly total: number };
  readonly criteria: { readonly met: number; readonly total: number };
  readonly journalEntries: number;
  readonly updatedAt: string;
};

export type TaskList = {
  readonly total: number;
  readonly tasks: readonly TaskListItem[];
};

export type BoardColumn = {
  readonly status: TaskStatus;
  readonly total: number;
  readonly tasks: readonly TaskListItem[];
};

export type TaskBoard = { readonly columns: readonly BoardColumn[] };

export type TaskMention = {
  readonly key: string;
  readonly kind: TaskKind;
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

export type PictureItem = {
  readonly id: string;
  readonly name: string;
  readonly type: PictureType;
  readonly bytes: number;
  readonly addedBy: string;
  readonly addedByKind: "agent" | "human";
  readonly session: number | null;
  readonly addedAt: string;
};

export type TaskBrief = {
  readonly key: string;
  readonly id: string;
  readonly kind: TaskKind;
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
  readonly epic: EpicMention | null;
  readonly progress: { readonly done: number; readonly total: number } | null;
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
  readonly latestHandoff: JournalItem | null;
  readonly decisions: readonly JournalItem[];
  readonly recentJournal: readonly JournalItem[];
  readonly journalEntries: number;
  readonly pictures: readonly PictureItem[];
  readonly skills: readonly BriefSkill[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TaskCount = {
  readonly total: number;
  readonly running: number;
  readonly hint: string;
};

/**
 * Keyed by `owner/name` in lower case: GitHub names are case-insensitive,
 * and the route joins on this key.
 */
export type TaskCountsByRepository = Readonly<Record<string, TaskCount>>;

export type TaskSummary = {
  readonly id: string;
  readonly title: string;
  readonly lastActivity: string;
  readonly state: TaskState;
  readonly contextItems: number;
};

export type RepositoryTasks = {
  readonly summary: string;
  readonly total: number;
  readonly shown: readonly TaskSummary[];
};
