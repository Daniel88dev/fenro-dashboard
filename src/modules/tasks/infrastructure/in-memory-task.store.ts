import type {
  LabelRecord,
  PictureRecord,
  SessionRecord,
  SkillDetailRecord,
  SkillRecord,
  SkillTextRecord,
  TaskDetailRecord,
  TaskReadStore,
  TaskRecord,
} from "@/modules/tasks/application/ports/task-read-store";
import {
  Label,
  labelExists,
  LabelRenamed,
  Skill,
  skillExists,
  Task,
  TaskGraph,
  taskError,
  type JournalEntry,
  type LabelRepository,
  type Picture,
  type PictureRepository,
  type LabelColour,
  type Session,
  type SkillRepository,
  type SkillRevision,
  type SkillState,
  type TaskError,
  type TaskRepository,
  type TaskState,
} from "@/modules/tasks/domain";
import { err, ok, UniqueId, type Result } from "@/shared/domain";

type StoredLabel = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly colour: LabelColour;
  readonly createdAt: Date;
};

type StoredSkill = {
  readonly id: string;
  readonly ownerId: string;
  readonly state: SkillState;
  readonly version: number;
  readonly revisions: readonly SkillRevision[];
};

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
  #labels: StoredLabel[] = [];
  readonly #skills = new Map<string, StoredSkill>();
  readonly #loadedSkillVersions = new WeakMap<Skill, number>();
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
    return this.#labels
      .filter((label) => label.ownerId === ownerId)
      .map(restoreLabel);
  }

  async findByName(ownerId: string, name: string): Promise<Label | undefined> {
    const stored = this.#labels.find(
      (label) => label.ownerId === ownerId && label.name === name,
    );
    return stored ? restoreLabel(stored) : undefined;
  }

  async inUse(ownerId: string, name: string): Promise<boolean> {
    return (
      this.#owned(ownerId).some((task) => task.state.labels.includes(name)) ||
      [...this.#skills.values()].some(
        (skill) =>
          skill.ownerId === ownerId && skill.state.labels.includes(name),
      )
    );
  }

  async update(label: Label): Promise<Result<void, TaskError>> {
    if (
      this.#labels.some(
        (other) =>
          other.ownerId === label.ownerId &&
          other.name === label.name &&
          other.id !== label.id.value,
      )
    ) {
      return err(labelExists(label.name));
    }
    this.#labels = this.#labels.map((other) =>
      other.id === label.id.value ? storedLabel(label) : other,
    );
    for (const event of label.pullDomainEvents()) {
      if (event instanceof LabelRenamed) {
        this.#renameEverywhere(label.ownerId, event.from, event.to);
      }
    }
    return ok(undefined);
  }

  #renameEverywhere(ownerId: string, from: string, to: string): void {
    const rename = (labels: readonly string[]) => [
      ...new Set(labels.map((name) => (name === from ? to : name))),
    ];
    for (const task of this.#owned(ownerId)) {
      if (!task.state.labels.includes(from)) continue;
      this.#tasks.set(task.id, {
        ...task,
        state: { ...task.state, labels: rename(task.state.labels) },
        version: task.version + 1,
      });
    }
    for (const skill of this.#skills.values()) {
      if (skill.ownerId !== ownerId || !skill.state.labels.includes(from)) {
        continue;
      }
      this.#skills.set(skill.id, {
        ...skill,
        state: { ...skill.state, labels: rename(skill.state.labels).sort() },
        version: skill.version + 1,
      });
    }
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
    this.#labels.push(storedLabel(label));
    label.pullDomainEvents();
    return ok(undefined);
  }

  // --- SkillRepository ---------------------------------------------------------

  /** The skill side, sharing this store's tasks and labels. */
  readonly skillRepository: SkillRepository = {
    findById: async (ownerId, id) => {
      const stored = this.#skills.get(id);
      return stored?.ownerId === ownerId
        ? this.#restoreSkill(stored)
        : undefined;
    },
    findByName: async (ownerId, name) => {
      const stored = this.#skillNamed(ownerId, name);
      return stored ? this.#restoreSkill(stored) : undefined;
    },
    revision: async (ownerId, skillId, revision) => {
      const stored = this.#skills.get(skillId);
      if (stored?.ownerId !== ownerId) return undefined;
      return stored.revisions.find((kept) => kept.revision === revision);
    },
    save: async (skill) => this.#saveSkill(skill),
    remove: async (skill) => {
      if (this.#skills.get(skill.id.value)?.ownerId === skill.ownerId) {
        this.#skills.delete(skill.id.value);
      }
      skill.pullDomainEvents();
    },
  };

  #saveSkill(skill: Skill): Result<void, TaskError> {
    const loaded = this.#loadedSkillVersions.get(skill);
    const current = this.#skills.get(skill.id.value);
    if (
      (loaded === undefined && current) ||
      (loaded !== undefined && current?.version !== loaded)
    ) {
      return err(
        taskError(
          "concurrent-modification",
          `Skill "${skill.name}" changed while this was being saved. Read it again and retry.`,
        ),
      );
    }
    const named = this.#skillNamed(skill.ownerId, skill.name);
    if (named && named.id !== skill.id.value)
      return err(skillExists(skill.name));

    const version = (loaded ?? 0) + 1;
    this.#skills.set(skill.id.value, {
      id: skill.id.value,
      ownerId: skill.ownerId,
      state: skill.state,
      version,
      revisions: [...(current?.revisions ?? []), ...skill.pullNewRevisions()],
    });
    this.#loadedSkillVersions.set(skill, version);
    skill.pullDomainEvents();
    return ok(undefined);
  }

  #skillNamed(ownerId: string, name: string): StoredSkill | undefined {
    return [...this.#skills.values()].find(
      (skill) => skill.ownerId === ownerId && skill.state.name === name,
    );
  }

  #restoreSkill(stored: StoredSkill): Skill {
    const skill = Skill.restore(
      UniqueId.create(stored.id),
      stored.ownerId,
      stored.state,
    );
    this.#loadedSkillVersions.set(skill, stored.version);
    return skill;
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

  async skills(ownerId: string): Promise<SkillRecord[]> {
    return [...this.#skills.values()]
      .filter((skill) => skill.ownerId === ownerId)
      .sort((a, b) => a.state.name.localeCompare(b.state.name))
      .map(skillRecord);
  }

  async skill(
    ownerId: string,
    reference: { readonly id: string } | { readonly name: string },
    revisions: number,
  ): Promise<SkillDetailRecord | undefined> {
    const stored =
      "id" in reference
        ? this.#skills.get(reference.id)
        : this.#skillNamed(ownerId, reference.name);
    if (stored?.ownerId !== ownerId) return undefined;
    return {
      ...skillRecord(stored),
      instructions: stored.state.instructions,
      revisions: [...stored.revisions]
        .reverse()
        .slice(0, revisions)
        .map((kept) => ({
          revision: kept.revision,
          name: kept.name,
          description: kept.description,
          instructions: kept.instructions,
          byKind: kept.by.kind,
          byName: kept.by.name,
          at: kept.at,
        })),
    };
  }

  async skillsLinkedTo(
    ownerId: string,
    labels: readonly string[],
  ): Promise<SkillTextRecord[]> {
    return [...this.#skills.values()]
      .filter(
        (skill) =>
          skill.ownerId === ownerId &&
          skill.state.labels.some((label) => labels.includes(label)),
      )
      .map((skill) => ({
        ...skillRecord(skill),
        instructions: skill.state.instructions,
      }));
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

function storedLabel(label: Label): StoredLabel {
  return {
    id: label.id.value,
    ownerId: label.ownerId,
    name: label.name,
    colour: label.colour,
    createdAt: label.createdAt,
  };
}

function restoreLabel(stored: StoredLabel): Label {
  return Label.restore(UniqueId.create(stored.id), stored);
}

function skillRecord(stored: StoredSkill): SkillRecord {
  const { state } = stored;
  return {
    id: stored.id,
    name: state.name,
    description: state.description,
    labels: state.labels,
    revision: state.revision,
    createdByKind: state.createdBy.kind,
    createdByName: state.createdBy.name,
    createdAt: state.createdAt,
    updatedByKind: state.updatedBy.kind,
    updatedByName: state.updatedBy.name,
    updatedAt: state.updatedAt,
  };
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
