import { and, asc, eq, max } from "drizzle-orm";

import {
  ExternalReference,
  RepositoryReference,
  Session,
  Task,
  TaskGraph,
  taskError,
  type Actor,
  type ExternalSystem,
  type LinkKind,
  type Priority,
  type SessionOutcome,
  type TaskError,
  type TaskRepository,
  type TaskStatus,
} from "@/modules/tasks/domain";
import { err, ok, UniqueId, unwrap, type Result } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import {
  task as taskTable,
  taskExternalReference,
  taskJournalEntry,
  taskLink,
  taskSession,
  type StoredCriterion,
} from "./persistence/schema";

type TaskRow = typeof taskTable.$inferSelect;
type SessionRow = typeof taskSession.$inferSelect;
type ReferenceRow = typeof taskExternalReference.$inferSelect;
type LinkRow = typeof taskLink.$inferSelect;

/**
 * `Task` in Postgres, with optimistic concurrency as `WatchedRepository` has
 * it: the version a task was loaded at is remembered beside it, and a save only
 * lands if the row still has that version. A new task that loses the race for
 * its number fails the same way, and the handler takes the next one.
 *
 * The journal is never loaded into the aggregate — nothing it enforces reads
 * old entries — so a save only inserts the entries appended since.
 */
export class DrizzleTaskRepository implements TaskRepository {
  readonly #loadedVersions = new WeakMap<Task, number>();

  constructor(private readonly db: Database) {}

  async findById(ownerId: string, id: string): Promise<Task | undefined> {
    const [row] = await this.db
      .select()
      .from(taskTable)
      .where(and(eq(taskTable.ownerId, ownerId), eq(taskTable.id, id)));
    return row ? this.#restore(row) : undefined;
  }

  async findByNumber(
    ownerId: string,
    number: number,
  ): Promise<Task | undefined> {
    const [row] = await this.db
      .select()
      .from(taskTable)
      .where(and(eq(taskTable.ownerId, ownerId), eq(taskTable.number, number)));
    return row ? this.#restore(row) : undefined;
  }

  async nextNumber(ownerId: string): Promise<number> {
    const [row] = await this.db
      .select({ last: max(taskTable.number) })
      .from(taskTable)
      .where(eq(taskTable.ownerId, ownerId));
    return (row?.last ?? 0) + 1;
  }

  async graph(ownerId: string): Promise<TaskGraph> {
    const [tasks, links] = await Promise.all([
      this.db
        .select({
          id: taskTable.id,
          number: taskTable.number,
          status: taskTable.status,
          parentId: taskTable.parentId,
        })
        .from(taskTable)
        .where(eq(taskTable.ownerId, ownerId)),
      this.db
        .select({ taskId: taskLink.taskId, targetId: taskLink.targetId })
        .from(taskLink)
        .innerJoin(taskTable, eq(taskTable.id, taskLink.taskId))
        .where(
          and(eq(taskTable.ownerId, ownerId), eq(taskLink.kind, "blocked-by")),
        ),
    ]);

    const blockedBy = new Map<string, string[]>();
    for (const link of links) {
      blockedBy.set(link.taskId, [
        ...(blockedBy.get(link.taskId) ?? []),
        link.targetId,
      ]);
    }
    return new TaskGraph(
      tasks.map((row) => ({
        id: row.id,
        number: row.number,
        status: row.status as TaskStatus,
        parentId: row.parentId,
        blockedBy: blockedBy.get(row.id) ?? [],
      })),
    );
  }

  async save(task: Task): Promise<Result<void, TaskError>> {
    const loaded = this.#loadedVersions.get(task);
    const values = toRow(task);
    const journal = task.pullNewJournalEntries();

    const version = await this.db.transaction(async (tx) => {
      const [saved] =
        loaded === undefined
          ? await tx
              .insert(taskTable)
              .values({ ...values, version: 1 })
              .onConflictDoNothing()
              .returning({ version: taskTable.version })
          : await tx
              .update(taskTable)
              .set({ ...values, version: loaded + 1 })
              .where(
                and(eq(taskTable.id, values.id), eq(taskTable.version, loaded)),
              )
              .returning({ version: taskTable.version });
      if (!saved) return undefined;

      const id = values.id;
      await tx.delete(taskLink).where(eq(taskLink.taskId, id));
      await tx
        .delete(taskExternalReference)
        .where(eq(taskExternalReference.taskId, id));
      await tx.delete(taskSession).where(eq(taskSession.taskId, id));

      const { links, references, sessions } = task.state;
      if (links.length > 0) {
        await tx.insert(taskLink).values(
          links.map((link) => ({
            taskId: id,
            kind: link.kind,
            targetId: link.taskId,
          })),
        );
      }
      if (references.length > 0) {
        await tx.insert(taskExternalReference).values(
          references.map((reference, position) => ({
            taskId: id,
            system: reference.system,
            key: reference.key,
            url: reference.url,
            title: reference.title,
            isSource: reference.isSource,
            position,
          })),
        );
      }
      if (sessions.length > 0) {
        await tx.insert(taskSession).values(
          sessions.map((session) => ({
            id: session.id,
            taskId: id,
            number: session.number,
            actorKind: session.actor.kind,
            actorId: session.actor.id,
            actorName: session.actor.name,
            startedAt: session.startedAt,
            lastSeenAt: session.lastSeenAt,
            endedAt: session.endedAt,
            outcome: session.outcome,
          })),
        );
      }
      if (journal.length > 0) {
        await tx.insert(taskJournalEntry).values(
          journal.map((entry) => ({
            id: entry.id,
            taskId: id,
            kind: entry.kind,
            text: entry.text,
            authorKind: entry.author.kind,
            authorId: entry.author.id,
            authorName: entry.author.name,
            sessionId: entry.sessionId,
            recordedAt: entry.recordedAt,
          })),
        );
      }
      return saved.version;
    });

    if (version === undefined) {
      return err(
        taskError(
          "concurrent-modification",
          `${task.key} changed while this was being saved. Read it again and retry.`,
        ),
      );
    }
    this.#loadedVersions.set(task, version);
    // Drained rather than published: nothing subscribes yet.
    task.pullDomainEvents();
    return ok(undefined);
  }

  async #restore(row: TaskRow): Promise<Task> {
    const [links, references, sessions] = await Promise.all([
      this.db.select().from(taskLink).where(eq(taskLink.taskId, row.id)),
      this.db
        .select()
        .from(taskExternalReference)
        .where(eq(taskExternalReference.taskId, row.id))
        .orderBy(asc(taskExternalReference.position)),
      this.db
        .select()
        .from(taskSession)
        .where(eq(taskSession.taskId, row.id))
        .orderBy(asc(taskSession.number)),
    ]);

    const task = restoreTask(row, links, references, sessions);
    this.#loadedVersions.set(task, row.version);
    return task;
  }
}

export function restoreTask(
  row: TaskRow,
  links: readonly LinkRow[],
  references: readonly ReferenceRow[],
  sessions: readonly SessionRow[],
): Task {
  return Task.restore(
    UniqueId.create(row.id),
    { ownerId: row.ownerId, number: row.number, createdAt: row.createdAt },
    {
      title: row.title,
      description: row.description,
      status: row.status as TaskStatus,
      priority: row.priority as Priority,
      labels: row.labels,
      repository:
        row.repositoryOwner && row.repositoryName
          ? unwrap(
              RepositoryReference.parse(
                `${row.repositoryOwner}/${row.repositoryName}`,
              ),
            )
          : null,
      parentId: row.parentId,
      links: links.map((link) => ({
        kind: link.kind as LinkKind,
        taskId: link.targetId,
      })),
      references: references.map((reference) =>
        ExternalReference.restore({
          system: reference.system as ExternalSystem,
          key: reference.key,
          url: reference.url,
          title: reference.title,
          isSource: reference.isSource,
        }),
      ),
      criteria: row.criteria.map((criterion) => ({
        number: criterion.number,
        text: criterion.text,
        metAt: criterion.metAt ? new Date(criterion.metAt) : null,
        evidence: criterion.evidence,
      })),
      hold:
        row.holdReason && row.holdSince
          ? { reason: row.holdReason, since: row.holdSince }
          : null,
      sessions: sessions.map((session) =>
        Session.restore({
          id: session.id,
          number: session.number,
          actor: toActor(session.actorKind, session.actorId, session.actorName),
          startedAt: session.startedAt,
          lastSeenAt: session.lastSeenAt,
          endedAt: session.endedAt,
          outcome: session.outcome as SessionOutcome | null,
        }),
      ),
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    },
  );
}

export function toActor(kind: string, id: string, name: string): Actor {
  return kind === "agent"
    ? { kind: "agent", id, name }
    : { kind: "human", id, name };
}

function toRow(task: Task) {
  const state = task.state;
  return {
    id: task.id.value,
    ownerId: task.ownerId,
    number: task.number,
    title: state.title,
    description: state.description,
    status: state.status,
    priority: state.priority,
    labels: [...state.labels],
    repositoryOwner: state.repository?.owner ?? null,
    repositoryName: state.repository?.name ?? null,
    parentId: state.parentId,
    criteria: state.criteria.map((criterion): StoredCriterion => ({
      number: criterion.number,
      text: criterion.text,
      metAt: criterion.metAt?.toISOString() ?? null,
      evidence: criterion.evidence,
    })),
    holdReason: state.hold?.reason ?? null,
    holdSince: state.hold?.since ?? null,
    createdAt: task.createdAt,
    updatedAt: state.updatedAt,
    completedAt: state.completedAt,
  };
}
