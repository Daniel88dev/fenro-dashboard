import type {
  ExternalSystem,
  JournalKind,
  LabelColour,
  LinkKind,
  PictureType,
  Priority,
  SessionOutcome,
  TaskKind,
  TaskStatus,
} from "@/modules/tasks/domain";

/** One owner id, or several when a reader sees more than one space at once. */
export type TaskOwners = string | readonly string[];

export interface TaskReadStore {
  records(owners: TaskOwners): Promise<TaskRecord[]>;
  detail(ownerId: string, id: string): Promise<TaskDetailRecord | undefined>;
  descriptionsContaining(
    ownerId: string,
    words: readonly string[],
    limit: number,
  ): Promise<TaskDescriptionRecord[]>;
  labels(ownerId: string): Promise<LabelRecord[]>;
  picture(ownerId: string, id: string): Promise<PictureRecord | undefined>;
  skills(ownerId: string): Promise<SkillRecord[]>;
  skill(
    ownerId: string,
    reference: { readonly id: string } | { readonly name: string },
    revisions: number,
  ): Promise<SkillDetailRecord | undefined>;
  skillsLinkedTo(
    ownerId: string,
    labels: readonly string[],
  ): Promise<SkillTextRecord[]>;
}

export type TaskDescriptionRecord = {
  readonly id: string;
  readonly description: string;
};

export type SkillRecord = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly revision: number;
  readonly createdByKind: "agent" | "human";
  readonly createdByName: string;
  readonly createdAt: Date;
  readonly updatedByKind: "agent" | "human";
  readonly updatedByName: string;
  readonly updatedAt: Date;
};

export type SkillTextRecord = SkillRecord & { readonly instructions: string };

export type SkillRevisionRecord = {
  readonly revision: number;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly byKind: "agent" | "human";
  readonly byName: string;
  readonly at: Date;
};

export type SkillDetailRecord = SkillTextRecord & {
  /** Newest first. */
  readonly revisions: readonly SkillRevisionRecord[];
};

export type PictureRecord = {
  readonly id: string;
  readonly taskId: string;
  readonly name: string;
  readonly type: PictureType;
  readonly byteSize: number;
  readonly storageKey: string;
  readonly addedByKind: "agent" | "human";
  readonly addedByName: string;
  readonly sessionNumber: number | null;
  readonly addedAt: Date;
};

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
  readonly ownerId: string;
  readonly keyPrefix: string;
  readonly number: number;
  readonly kind: TaskKind;
  readonly title: string;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly labels: readonly string[];
  readonly repository: { readonly owner: string; readonly name: string } | null;
  readonly parentId: string | null;
  readonly blockedBy: readonly string[];
  readonly hold: { readonly reason: string; readonly since: Date } | null;
  readonly latestSession: SessionRecord | null;
  readonly criteriaMet: number;
  readonly criteriaTotal: number;
  readonly journalEntries: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
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
  /** Oldest first. */
  readonly pictures: readonly PictureRecord[];
};
