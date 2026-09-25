import type {
  ExternalSystem,
  JournalKind,
  LabelColour,
  LinkKind,
  Priority,
  SessionOutcome,
  TaskStatus,
} from "@/modules/tasks/domain";

/**
 * The read side of the tasks context. Queries read stored rows through this
 * port and shape them in `queries/projections.ts`; they never load an
 * aggregate. Every read is scoped to one owner.
 */
export interface TaskReadStore {
  /** Every one of the owner's tasks, without descriptions or journals. */
  records(ownerId: string): Promise<TaskRecord[]>;
  /** One task in full. */
  detail(ownerId: string, id: string): Promise<TaskDetailRecord | undefined>;
  /** The owner's label catalogue. */
  labels(ownerId: string): Promise<LabelRecord[]>;
}

export type LabelRecord = {
  readonly name: string;
  readonly colour: LabelColour;
};

export type SessionRecord = {
  readonly id: string;
  readonly number: number;
  readonly actorKind: "agent" | "human";
  readonly actorName: string;
  readonly startedAt: Date;
  readonly lastSeenAt: Date;
  readonly endedAt: Date | null;
  readonly outcome: SessionOutcome | null;
};

export type TaskRecord = {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly labels: readonly string[];
  readonly repository: { readonly owner: string; readonly name: string } | null;
  readonly parentId: string | null;
  /** Ids of the tasks this one is blocked by, open or not. */
  readonly blockedBy: readonly string[];
  readonly hold: { readonly reason: string; readonly since: Date } | null;
  /** The most recent session, ended or not. */
  readonly latestSession: SessionRecord | null;
  readonly criteriaMet: number;
  readonly criteriaTotal: number;
  readonly journalEntries: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type TaskDetailRecord = TaskRecord & {
  readonly description: string;
  readonly criteria: readonly {
    readonly number: number;
    readonly text: string;
    readonly metAt: Date | null;
    readonly evidence: string | null;
  }[];
  readonly links: readonly {
    readonly kind: LinkKind;
    readonly taskId: string;
  }[];
  /** Links other tasks hold to this one: the tasks it blocks, and so on. */
  readonly incoming: readonly {
    readonly kind: LinkKind;
    readonly taskId: string;
  }[];
  readonly references: readonly {
    readonly system: ExternalSystem;
    readonly key: string;
    readonly url: string;
    readonly title: string | null;
    readonly isSource: boolean;
  }[];
  readonly sessions: readonly SessionRecord[];
  /** Oldest first. */
  readonly journal: readonly {
    readonly kind: JournalKind;
    readonly text: string;
    readonly authorKind: "agent" | "human";
    readonly authorName: string;
    readonly sessionNumber: number | null;
    readonly recordedAt: Date;
  }[];
  readonly completedAt: Date | null;
};
