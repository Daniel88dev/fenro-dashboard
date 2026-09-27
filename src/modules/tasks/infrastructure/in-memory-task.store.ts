import type {
  LabelRecord,
  PictureRecord,
  SessionRecord,
  TaskDetailRecord,
  TaskReadStore,
  TaskRecord,
} from "@/modules/tasks/application/ports/task-read-store";
import {
  Label,
  labelExists,
  Task,
  TaskGraph,
  taskError,
  type JournalEntry,
  type LabelRepository,
  type Picture,
  type PictureRepository,
  type Session,
  type TaskError,
  type TaskRepository,
  type TaskState,
} from "@/modules/tasks/domain";
import { err, ok, UniqueId, type Result } from "@/shared/domain";

type Stored = {
  readonly id: string;
  readonly ownerId: string;
  readonly number: number;
  readonly createdAt: Date;
  readonly state: TaskState;
  readonly version: number;
};

/**
 * Both sides of the tasks store, in memory, for tests. It keeps what a save
 * wrote rather than the aggregate itself, and checks versions the way the
 * Postgres adapter does, so a handler that forgets to save — or saves over a
 * newer copy — fails here too.
 */
export class InMemoryTaskStore
  implements TaskRepository, TaskReadStore, LabelRepository, PictureRepository
{
  readonly #tasks = new Map<string, Stored>();
  readonly #labels: Label[] = [];
  readonly #pictures: Picture[] = [];
  readonly #journal: (JournalEntry & { taskId: string })[] = [];
  readonly #loadedVersions = new WeakMap<Task, number>();

  // --- TaskRepository ----------------------------------------------------------

  async findById(ownerId: string, id: string): Promise<Task | undefined> {
    const stored = this.#tasks.get(id);
    return stored?.ownerId === ownerId ? this.#restore(stored) : undefined;
  }

  async findByNumber(
    ownerId: string,
    number: number,
  ): Promise<Task | undefined> {
    const stored = [...this.#tasks.values()].find(
      (task) => task.ownerId === ownerId && task.number === number,
    );
    return stored ? this.#restore(stored) : undefined;
  }

  async nextNumber(ownerId: string): Promise<number> {
    return (
      this.#owned(ownerId).reduce(
        (last, task) => Math.max(last, task.number),
        0,
      ) + 1
    );
  }

  async graph(ownerId: string): Promise<TaskGraph> {
    return new TaskGraph(
      this.#owned(ownerId).map((task) => ({
        id: task.id,
        number: task.number,
        status: task.state.status,
        parentId: task.state.parentId,
        blockedBy: blockedBy(task.state),
      })),
    );
  }

  async #saveTask(task: Task): Promise<Result<void, TaskError>> {
    const loaded = this.#loadedVersions.get(task);
    const current = this.#tasks.get(task.id.value);
    const numberTaken = [...this.#tasks.values()].some(
      (other) =>
        other.id !== task.id.value &&
        other.ownerId === task.ownerId &&
        other.number === task.number,
    );
    if (
      (loaded === undefined && (current || numberTaken)) ||
      (loaded !== undefined && current?.version !== loaded)
    ) {
      return err(
        taskError(
          "concurrent-modification",
          `${task.key} changed while this was being saved. Read it again and retry.`,
        ),
      );
    }

    const version = (loaded ?? 0) + 1;
    this.#tasks.set(task.id.value, {
      id: task.id.value,
      ownerId: task.ownerId,
      number: task.number,
      createdAt: task.createdAt,
      state: task.state,
      version,
    });
    for (const entry of task.pullNewJournalEntries()) {
      this.#journal.push({ ...entry, taskId: task.id.value });
    }
    this.#loadedVersions.set(task, version);
    task.pullDomainEvents();
    return ok(undefined);
  }

  // --- LabelRepository ---------------------------------------------------------

  async all(ownerId: string): Promise<Label[]> {
    return this.#labels.filter((label) => label.ownerId === ownerId);
  }

  async save(label: Label): Promise<Result<void, TaskError>>;
  async save(task: Task): Promise<Result<void, TaskError>>;
  async save(item: Task | Label): Promise<Result<void, TaskError>> {
    return item instanceof Label ? this.#saveLabel(item) : this.#saveTask(item);
  }

  #saveLabel(label: Label): Result<void, TaskError> {
    if (
      this.#labels.some(
        (other) => other.ownerId === label.ownerId && other.name === label.name,
      )
    ) {
      return err(labelExists(label.name));
    }
    this.#labels.push(label);
    label.pullDomainEvents();
    return ok(undefined);
  }

  // --- PictureRepository -------------------------------------------------------

  async pictureById(ownerId: string, id: string): Promise<Picture | undefined> {
    return this.#pictures.find(
      (picture) => picture.ownerId === ownerId && picture.id.value === id,
    );
  }

  async add(picture: Picture): Promise<void> {
    if (this.#pictures.some((other) => other.id.equals(picture.id))) {
      throw new Error(`Picture ${picture.id.value} is already stored.`);
    }
    this.#pictures.push(picture);
  }

  async remove(picture: Picture): Promise<void> {
    const index = this.#pictures.findIndex((other) =>
      other.id.equals(picture.id),
    );
    if (index >= 0) this.#pictures.splice(index, 1);
  }

  // --- TaskReadStore -----------------------------------------------------------

  async picture(
    ownerId: string,
    id: string,
  ): Promise<PictureRecord | undefined> {
    const picture = await this.pictureById(ownerId, id);
    return picture ? this.#pictureRecord(picture) : undefined;
  }

  async labels(ownerId: string): Promise<LabelRecord[]> {
    return this.#labels
      .filter((label) => label.ownerId === ownerId)
      .map((label) => ({ name: label.name, colour: label.colour }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async records(ownerId: string): Promise<TaskRecord[]> {
    return this.#owned(ownerId).map((task) => this.#record(task));
  }

  async detail(
    ownerId: string,
    id: string,
  ): Promise<TaskDetailRecord | undefined> {
    const stored = this.#tasks.get(id);
    if (!stored || stored.ownerId !== ownerId) return undefined;
    const { state } = stored;
    const sessions = state.sessions.map(toSessionRecord);

    return {
      ...this.#record(stored),
      description: state.description,
      criteria: state.criteria,
      links: state.links,
      incoming: this.#owned(ownerId).flatMap((other) =>
        other.state.links
          .filter((link) => link.taskId === id)
          .map((link) => ({ kind: link.kind, taskId: other.id })),
      ),
      references: state.references.map((reference) => ({
        system: reference.system,
        key: reference.key,
        url: reference.url,
        title: reference.title,
        isSource: reference.isSource,
      })),
      sessions,
      journal: this.#journalOf(id).map((entry) => ({
        kind: entry.kind,
        text: entry.text,
        authorKind: entry.author.kind,
        authorName: entry.author.name,
        sessionNumber:
          sessions.find((session) => session.id === entry.sessionId)?.number ??
          null,
        recordedAt: entry.recordedAt,
      })),
      pictures: this.#pictures
        .filter((picture) => picture.taskId === id)
        .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())
        .map((picture) => this.#pictureRecord(picture)),
      completedAt: state.completedAt,
    };
  }

  // --- Internals ---------------------------------------------------------------

  #pictureRecord(picture: Picture): PictureRecord {
    const sessions = this.#tasks.get(picture.taskId)?.state.sessions ?? [];
    return {
      id: picture.id.value,
      taskId: picture.taskId,
      name: picture.name,
      type: picture.type,
      byteSize: picture.byteSize,
      storageKey: picture.storageKey,
      addedByKind: picture.addedBy.kind,
      addedByName: picture.addedBy.name,
      sessionNumber:
        sessions.find((session) => session.id === picture.sessionId)?.number ??
        null,
      addedAt: picture.addedAt,
    };
  }

  #owned(ownerId: string): Stored[] {
    return [...this.#tasks.values()].filter((task) => task.ownerId === ownerId);
  }

  #journalOf(taskId: string) {
    return this.#journal.filter((entry) => entry.taskId === taskId);
  }

  #restore(stored: Stored): Task {
    const task = Task.restore(
      UniqueId.create(stored.id),
      {
        ownerId: stored.ownerId,
        number: stored.number,
        createdAt: stored.createdAt,
      },
      stored.state,
    );
    this.#loadedVersions.set(task, stored.version);
    return task;
  }

  #record(stored: Stored): TaskRecord {
    const { state } = stored;
    const latest = state.sessions.at(-1);
    return {
      id: stored.id,
      number: stored.number,
      title: state.title,
      status: state.status,
      priority: state.priority,
      labels: state.labels,
      repository: state.repository
        ? { owner: state.repository.owner, name: state.repository.name }
        : null,
      parentId: state.parentId,
      blockedBy: blockedBy(state),
      hold: state.hold,
      latestSession: latest ? toSessionRecord(latest) : null,
      criteriaMet: state.criteria.filter((criterion) => criterion.metAt).length,
      criteriaTotal: state.criteria.length,
      journalEntries: this.#journalOf(stored.id).length,
      createdAt: stored.createdAt,
      updatedAt: state.updatedAt,
    };
  }
}

function blockedBy(state: TaskState): string[] {
  return state.links
    .filter((link) => link.kind === "blocked-by")
    .map((link) => link.taskId);
}

function toSessionRecord(session: Session): SessionRecord {
  return {
    id: session.id,
    number: session.number,
    actorKind: session.actor.kind,
    actorName: session.actor.name,
    startedAt: session.startedAt,
    lastSeenAt: session.lastSeenAt,
    endedAt: session.endedAt,
    outcome: session.outcome,
  };
}
