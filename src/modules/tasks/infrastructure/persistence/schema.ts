import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * The `Task` aggregate across six tables: the task itself, and the parts of it
 * that are either queried on their own (links, external references) or grow
 * without bound (sessions, the journal). Acceptance criteria are few and only
 * ever read with their task, so they ride along as JSON.
 *
 * Owners are the identity context's user ids, deliberately not foreign keys:
 * the contexts share a database, not a schema (as in github-insights).
 * Timestamps carry their time zone.
 */
const instant = (name: string) => timestamp(name, { withTimezone: true });

/** A criterion as stored in `criteria`, with ISO timestamps. */
export type StoredCriterion = {
  readonly number: number;
  readonly text: string;
  readonly metAt: string | null;
  readonly evidence: string | null;
};

export const task = pgTable(
  "task",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    /** Per owner: T-1, T-2… */
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    labels: text("labels").array().notNull(),
    /** As written when the task was made; compared case-insensitively. */
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
    /** Bumped on every save, so a save over someone else's fails. */
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

/** "`taskId` is blocked by / relates to / was discovered from `targetId`". */
export const taskLink = pgTable(
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

export const taskExternalReference = pgTable(
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
    // "Is there a task for this issue already?"
    index("task_external_reference_target_idx").on(table.system, table.key),
  ],
);

export const taskSession = pgTable(
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

/** Append-only: rows are inserted and never updated. */
export const taskJournalEntry = pgTable(
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
 * Each person's label catalogue. Tasks carry label names in `task.labels`
 * rather than ids: the name is unique per owner, and it is what agents,
 * filters and URLs use.
 */
export const taskLabel = pgTable(
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
