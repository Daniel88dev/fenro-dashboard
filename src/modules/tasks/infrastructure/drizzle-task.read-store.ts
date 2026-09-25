import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import type {
  LabelRecord,
  SessionRecord,
  TaskDetailRecord,
  TaskReadStore,
  TaskRecord,
} from "@/modules/tasks/application/ports/task-read-store";
import {
  isLabelColour,
  type ExternalSystem,
  type JournalKind,
  type LinkKind,
  type Priority,
  type SessionOutcome,
  type TaskStatus,
} from "@/modules/tasks/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import {
  task as taskTable,
  taskExternalReference,
  taskJournalEntry,
  taskLabel,
  taskLink,
  taskSession,
} from "./persistence/schema";

type TaskRow = typeof taskTable.$inferSelect;
type SessionRow = typeof taskSession.$inferSelect;

/**
 * The tasks read side, straight from the tables: no aggregate is loaded to
 * answer a query. A list costs four queries whatever its length — the tasks,
 * their blocking links, each one's latest session, and journal counts.
 */
export class DrizzleTaskReadStore implements TaskReadStore {
  constructor(private readonly db: Database) {}

  async records(ownerId: string): Promise<TaskRecord[]> {
    const rows = await this.db
      .select()
      .from(taskTable)
      .where(eq(taskTable.ownerId, ownerId));
    if (rows.length === 0) return [];
    return this.#records(rows);
  }

  async detail(
    ownerId: string,
    id: string,
  ): Promise<TaskDetailRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(taskTable)
      .where(and(eq(taskTable.ownerId, ownerId), eq(taskTable.id, id)));
    if (!row) return undefined;

    const [[record], links, incoming, references, sessions, journal] =
      await Promise.all([
        this.#records([row]),
        this.db
          .select({ kind: taskLink.kind, taskId: taskLink.targetId })
          .from(taskLink)
          .where(eq(taskLink.taskId, id)),
        this.db
          .select({ kind: taskLink.kind, taskId: taskLink.taskId })
          .from(taskLink)
          .where(eq(taskLink.targetId, id)),
        this.db
          .select()
          .from(taskExternalReference)
          .where(eq(taskExternalReference.taskId, id))
          .orderBy(asc(taskExternalReference.position)),
        this.db
          .select()
          .from(taskSession)
          .where(eq(taskSession.taskId, id))
          .orderBy(asc(taskSession.number)),
        this.db
          .select()
          .from(taskJournalEntry)
          .where(eq(taskJournalEntry.taskId, id))
          .orderBy(asc(taskJournalEntry.recordedAt)),
      ]);

    const sessionRecords = sessions.map(toSessionRecord);
    const sessionNumbers = new Map(
      sessions.map((session) => [session.id, session.number]),
    );

    return {
      ...record!,
      description: row.description,
      criteria: row.criteria.map((criterion) => ({
        number: criterion.number,
        text: criterion.text,
        metAt: criterion.metAt ? new Date(criterion.metAt) : null,
        evidence: criterion.evidence,
      })),
      links: links.map((link) => ({
        kind: link.kind as LinkKind,
        taskId: link.taskId,
      })),
      incoming: incoming.map((link) => ({
        kind: link.kind as LinkKind,
        taskId: link.taskId,
      })),
      references: references.map((reference) => ({
        system: reference.system as ExternalSystem,
        key: reference.key,
        url: reference.url,
        title: reference.title,
        isSource: reference.isSource,
      })),
      sessions: sessionRecords,
      journal: journal.map((entry) => ({
        kind: entry.kind as JournalKind,
        text: entry.text,
        authorKind: entry.authorKind === "agent" ? "agent" : "human",
        authorName: entry.authorName,
        sessionNumber: entry.sessionId
          ? (sessionNumbers.get(entry.sessionId) ?? null)
          : null,
        recordedAt: entry.recordedAt,
      })),
      completedAt: row.completedAt,
    };
  }

  async labels(ownerId: string): Promise<LabelRecord[]> {
    const rows = await this.db
      .select({ name: taskLabel.name, colour: taskLabel.colour })
      .from(taskLabel)
      .where(eq(taskLabel.ownerId, ownerId))
      .orderBy(asc(taskLabel.name));
    return rows.map((row) => ({
      name: row.name,
      colour: isLabelColour(row.colour) ? row.colour : "gray",
    }));
  }

  async #records(rows: readonly TaskRow[]): Promise<TaskRecord[]> {
    const ids = rows.map((row) => row.id);
    const [links, sessions, journalCounts] = await Promise.all([
      this.db
        .select({ taskId: taskLink.taskId, targetId: taskLink.targetId })
        .from(taskLink)
        .where(
          and(inArray(taskLink.taskId, ids), eq(taskLink.kind, "blocked-by")),
        ),
      // Each task's latest session. Starting one ends any before it, so
      // only the latest can still be running.
      this.db
        .selectDistinctOn([taskSession.taskId])
        .from(taskSession)
        .where(inArray(taskSession.taskId, ids))
        .orderBy(taskSession.taskId, desc(taskSession.number)),
      this.db
        .select({ taskId: taskJournalEntry.taskId, entries: count() })
        .from(taskJournalEntry)
        .where(inArray(taskJournalEntry.taskId, ids))
        .groupBy(taskJournalEntry.taskId),
    ]);

    const blockedBy = new Map<string, string[]>();
    for (const link of links) {
      blockedBy.set(link.taskId, [
        ...(blockedBy.get(link.taskId) ?? []),
        link.targetId,
      ]);
    }
    const latestSession = new Map(
      sessions.map((session) => [session.taskId, toSessionRecord(session)]),
    );
    const entries = new Map(
      journalCounts.map((row) => [row.taskId, Number(row.entries)]),
    );

    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      status: row.status as TaskStatus,
      priority: row.priority as Priority,
      labels: row.labels,
      repository:
        row.repositoryOwner && row.repositoryName
          ? { owner: row.repositoryOwner, name: row.repositoryName }
          : null,
      parentId: row.parentId,
      blockedBy: blockedBy.get(row.id) ?? [],
      hold:
        row.holdReason && row.holdSince
          ? { reason: row.holdReason, since: row.holdSince }
          : null,
      latestSession: latestSession.get(row.id) ?? null,
      criteriaMet: row.criteria.filter((criterion) => criterion.metAt).length,
      criteriaTotal: row.criteria.length,
      journalEntries: entries.get(row.id) ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}

function toSessionRecord(session: SessionRow): SessionRecord {
  return {
    id: session.id,
    number: session.number,
    actorKind: session.actorKind === "agent" ? "agent" : "human",
    actorName: session.actorName,
    startedAt: session.startedAt,
    lastSeenAt: session.lastSeenAt,
    endedAt: session.endedAt,
    outcome: session.outcome as SessionOutcome | null,
  };
}
