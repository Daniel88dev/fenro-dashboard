import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { fenro } from "@/shared/infrastructure/database/schema";

/**
 * Owners are the identity context's user ids, deliberately not foreign keys:
 * the contexts share a database, not a schema.
 */
const instant = (name: string) => timestamp(name, { withTimezone: true });

export type StoredCriterion = {
  readonly number: number;
  readonly text: string;
  readonly metAt: string | null;
  readonly evidence: string | null;
};

export const task = fenro.table(
  "task",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    keyPrefix: text("key_prefix").notNull().default("T"),
    number: integer("number").notNull(),
    kind: text("kind").notNull().default("task"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    labels: text("labels").array().notNull(),
    /** Compared case-insensitively. */
    repositoryOwner: text("repository_owner"),
    repositoryName: text("repository_name"),
    parentId: text("parent_id").references((): AnyPgColumn => task.id, {
      onDelete: "set null",
    }),
    criteria: jsonb("criteria").$type<StoredCriterion[]>().notNull(),
    holdReason: text("hold_reason"),
    holdSince: instant("hold_since"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    completedAt: instant("completed_at"),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("task_owner_number_idx").on(table.ownerId, table.number),
    index("task_owner_status_idx").on(table.ownerId, table.status),
    index("task_owner_repository_idx").on(
      table.ownerId,
      sql`lower(${table.repositoryOwner})`,
      sql`lower(${table.repositoryName})`,
    ),
    index("task_parent_idx").on(table.parentId),
  ],
);

const taskId = () =>
  text("task_id")
    .notNull()
    .references(() => task.id, { onDelete: "cascade" });

export const taskLink = fenro.table(
  "task_link",
  {
    taskId: taskId(),
    kind: text("kind").notNull(),
    targetId: text("target_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.kind, table.targetId] }),
    index("task_link_target_idx").on(table.targetId),
  ],
);

export const taskExternalReference = fenro.table(
  "task_external_reference",
  {
    taskId: taskId(),
    system: text("system").notNull(),
    key: text("key").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    isSource: boolean("is_source").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.system, table.key] }),
    index("task_external_reference_target_idx").on(table.system, table.key),
  ],
);

export const taskSession = fenro.table(
  "task_session",
  {
    id: text("id").primaryKey(),
    taskId: taskId(),
    number: integer("number").notNull(),
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    startedAt: instant("started_at").notNull(),
    lastSeenAt: instant("last_seen_at").notNull(),
    endedAt: instant("ended_at"),
    outcome: text("outcome"),
  },
  (table) => [
    uniqueIndex("task_session_number_idx").on(table.taskId, table.number),
  ],
);

export const taskJournalEntry = fenro.table(
  "task_journal_entry",
  {
    id: text("id").primaryKey(),
    taskId: taskId(),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    authorKind: text("author_kind").notNull(),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    sessionId: text("session_id"),
    recordedAt: instant("recorded_at").notNull(),
  },
  (table) => [
    index("task_journal_entry_task_idx").on(table.taskId, table.recordedAt),
  ],
);

/**
 * Tasks carry label names rather than ids: the name is unique per owner, and it
 * is what agents, filters and URLs use.
 */
export const taskLabel = fenro.table(
  "task_label",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    colour: text("colour").notNull(),
    createdAt: instant("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("task_label_owner_name_idx").on(table.ownerId, table.name),
  ],
);

export const taskPicture = fenro.table(
  "task_picture",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    taskId: taskId(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    byteSize: integer("byte_size").notNull(),
    storageKey: text("storage_key").notNull(),
    addedByKind: text("added_by_kind").notNull(),
    addedById: text("added_by_id").notNull(),
    addedByName: text("added_by_name").notNull(),
    sessionId: text("session_id"),
    addedAt: instant("added_at").notNull(),
  },
  (table) => [index("task_picture_task_idx").on(table.taskId, table.addedAt)],
);

/**
 * `revision` counts changes to the text; `version` is bumped on every save,
 * links included.
 */
export const taskSkill = fenro.table(
  "task_skill",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    instructions: text("instructions").notNull(),
    revision: integer("revision").notNull(),
    createdByKind: text("created_by_kind").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedByKind: text("updated_by_kind").notNull(),
    updatedById: text("updated_by_id").notNull(),
    updatedByName: text("updated_by_name").notNull(),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("task_skill_owner_name_idx").on(table.ownerId, table.name),
  ],
);

const skillId = () =>
  text("skill_id")
    .notNull()
    .references(() => taskSkill.id, { onDelete: "cascade" });

/** The owner rides along so "which skills does this label bring" is one lookup. */
export const taskSkillLabel = fenro.table(
  "task_skill_label",
  {
    skillId: skillId(),
    ownerId: text("owner_id").notNull(),
    labelName: text("label_name").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.skillId, table.labelName] }),
    index("task_skill_label_owner_label_idx").on(
      table.ownerId,
      table.labelName,
    ),
  ],
);

export const taskSkillRevision = fenro.table(
  "task_skill_revision",
  {
    skillId: skillId(),
    revision: integer("revision").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    instructions: text("instructions").notNull(),
    byKind: text("by_kind").notNull(),
    byId: text("by_id").notNull(),
    byName: text("by_name").notNull(),
    at: instant("at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.skillId, table.revision] })],
);
