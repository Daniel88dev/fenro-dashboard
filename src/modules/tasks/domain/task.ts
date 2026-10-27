import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

import {
  CRITERION_TEXT_LIMIT,
  type AcceptanceCriterion,
} from "./acceptance-criterion";
import { describeActor, sameActor, type Actor } from "./actor";
import { invalidTask, taskError, type TaskError } from "./errors";
import {
  SessionEnded,
  SessionStarted,
  TaskAssigneeChanged,
  TaskCreated,
  TaskKindChanged,
  TaskStatusChanged,
} from "./events";
import type { ExternalReference } from "./external-reference";
import { parseLabelName } from "./label";
import {
  JOURNAL_TEXT_LIMIT,
  type JournalEntry,
  type JournalKind,
  type NoteKind,
} from "./journal-entry";
import type { RepositoryReference } from "./repository-reference";
import { Session, type FinishOutcome, type SessionOutcome } from "./session";
import { formatTaskKey, PERSONAL_KEY_PREFIX } from "./task-key";
import type { TaskKind } from "./task-kind";
import type { SpaceMember } from "./task-space";
import type { LinkKind, TaskLink } from "./task-link";
import { isOpen, type Priority, type TaskStatus } from "./task-status";

export const TITLE_LIMIT = 200;
export const DESCRIPTION_LIMIT = 50_000;
export const LABEL_LIMIT = 20;
export const CRITERIA_LIMIT = 50;

export type TaskSurroundings = {
  readonly openBlockers: readonly string[];
  readonly openSubtasks: readonly string[];
};

export type Hold = { readonly reason: string; readonly since: Date };

type Props = {
  readonly ownerId: string;
  /** Copied from the task's space when it is created; a prefix never changes. */
  readonly keyPrefix: string;
  readonly number: number;
  readonly createdAt: Date;
};

export type TaskState = {
  readonly kind: TaskKind;
  readonly title: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly labels: readonly string[];
  readonly repository: RepositoryReference | null;
  /** Only a group task stores one: a personal task is always its owner's. */
  readonly assignee: SpaceMember | null;
  readonly parentId: string | null;
  readonly links: readonly TaskLink[];
  readonly references: readonly ExternalReference[];
  readonly criteria: readonly AcceptanceCriterion[];
  readonly hold: Hold | null;
  readonly sessions: readonly Session[];
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
};

export type NewTask = {
  readonly id: string;
  readonly ownerId: string;
  readonly keyPrefix?: string;
  readonly number: number;
  readonly kind?: TaskKind;
  readonly title: string;
  readonly description?: string;
  readonly status?: "backlog" | "todo";
  readonly priority?: Priority;
  readonly labels?: readonly string[];
  readonly repository?: RepositoryReference | null;
  readonly parentId?: string | null;
  readonly criteria?: readonly string[];
  readonly references?: readonly ExternalReference[];
  readonly author: Actor;
  readonly now: Date;
};

export type TaskEdit = {
  readonly title?: string;
  readonly description?: string;
  readonly priority?: Priority;
  readonly labels?: readonly string[];
  readonly repository?: RepositoryReference | null;
};

export type Finish = {
  readonly outcome: FinishOutcome;
  readonly summary: string;
  readonly reason?: string;
};

export type StatusTarget = TaskStatus;

export class Task extends AggregateRoot<Props> {
  #state: TaskState;
  #newJournalEntries: JournalEntry[] = [];

  private constructor(id: UniqueId, props: Props, state: TaskState) {
    super(id, props);
    this.#state = state;
  }

  static create(input: NewTask): Result<Task, TaskError> {
    const title = checkTitle(input.title);
    if (!title.ok) return title;
    const description = checkDescription(input.description ?? "");
    if (!description.ok) return description;
    const labels = checkLabels(input.labels ?? []);
    if (!labels.ok) return labels;
    const criteria = checkCriteria(input.criteria ?? [], 0);
    if (!criteria.ok) return criteria;
    if (input.parentId === input.id) {
      return err(invalidTask("A task cannot be its own parent."));
    }
    const kind = input.kind ?? "task";
    if (kind === "epic" && input.parentId) {
      return err(epicWithParent("An epic"));
    }

    const task = new Task(
      UniqueId.create(input.id),
      {
        ownerId: input.ownerId,
        keyPrefix: input.keyPrefix ?? PERSONAL_KEY_PREFIX,
        number: input.number,
        createdAt: input.now,
      },
      {
        kind,
        title: title.value,
        description: description.value,
        status: input.status ?? "todo",
        priority: input.priority ?? "none",
        labels: labels.value,
        repository: input.repository ?? null,
        assignee: null,
        parentId: input.parentId ?? null,
        links: [],
        references: dedupeReferences(input.references ?? []),
        criteria: criteria.value,
        hold: null,
        sessions: [],
        updatedAt: input.now,
        completedAt: null,
      },
    );
    task.record(new TaskCreated(task.id.value, task.key, input.now));
    return ok(task);
  }

  static restore(id: UniqueId, props: Props, state: TaskState): Task {
    return new Task(id, props, state);
  }

  edit(changes: TaskEdit, actor: Actor, now: Date): Result<void, TaskError> {
    let next = this.#state;

    if (changes.title !== undefined) {
      const title = checkTitle(changes.title);
      if (!title.ok) return title;
      next = { ...next, title: title.value };
    }
    if (changes.description !== undefined) {
      const description = checkDescription(changes.description);
      if (!description.ok) return description;
      next = { ...next, description: description.value };
    }
    if (changes.labels !== undefined) {
      const labels = checkLabels(changes.labels);
      if (!labels.ok) return labels;
      next = { ...next, labels: labels.value };
    }
    if (changes.priority !== undefined) {
      next = { ...next, priority: changes.priority };
    }
    if (changes.repository !== undefined) {
      next = { ...next, repository: changes.repository };
    }

    this.#state = next;
    this.#touch(actor, now);
    return ok(undefined);
  }

  /**
   * `members` are the group's members now; a login is matched the way GitHub
   * compares them, ignoring case.
   */
  assign(
    login: string | null,
    members: readonly SpaceMember[],
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    if (this.isPersonal) {
      return err(
        taskError(
          "invalid-assignee",
          `${this.key} is a personal task, so it is always assigned to its owner. Leave the assignee out.`,
        ),
      );
    }
    const wanted = login?.trim().replace(/^@/, "").toLowerCase() || null;
    const member = wanted
      ? members.find((candidate) => candidate.login.toLowerCase() === wanted)
      : null;
    if (wanted && !member) {
      return err(
        taskError(
          "invalid-assignee",
          `${login} is not a member of the group ${this.key} belongs to. Assign it to a member, or leave it unassigned.`,
        ),
      );
    }
    const from = this.#state.assignee?.userId ?? null;
    const to = member?.userId ?? null;
    if (from === to) return ok(undefined);
    this.#state = { ...this.#state, assignee: member ?? null };
    this.#touch(actor, now);
    this.record(new TaskAssigneeChanged(this.id.value, from, to, now));
    return ok(undefined);
  }

  /**
   * The caller has already asked `TaskGraph` whether this would close a cycle.
   */
  moveUnder(
    parentId: string | null,
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    if (parentId === this.id.value) {
      return err(invalidTask("A task cannot be its own parent."));
    }
    if (parentId && this.#state.kind === "epic") {
      return err(epicWithParent(this.key));
    }
    this.#state = { ...this.#state, parentId };
    this.#touch(actor, now);
    return ok(undefined);
  }

  changeKind(kind: TaskKind, actor: Actor, now: Date): Result<void, TaskError> {
    const from = this.#state.kind;
    if (from === kind) return ok(undefined);
    if (kind === "epic" && this.#state.parentId) {
      return err(
        invalidTask(
          `${this.key} is a sub-task. Take it out from under its parent before making it an epic.`,
        ),
      );
    }
    const live = this.liveSession(now);
    if (kind === "epic" && live) {
      return err(
        taskError(
          "task-claimed",
          `${this.key} has a live session by ${describeActor(live.actor)}, and nobody works on an epic directly. Finish or hand off that session before making it an epic.`,
        ),
      );
    }
    this.#state = { ...this.#state, kind };
    this.#touch(actor, now);
    this.record(new TaskKindChanged(this.id.value, from, kind, now));
    return ok(undefined);
  }

  addCriteria(
    texts: readonly string[],
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    const numbered = checkCriteria(texts, this.#lastCriterionNumber());
    if (!numbered.ok) return numbered;
    const criteria = [...this.#state.criteria, ...numbered.value];
    if (criteria.length > CRITERIA_LIMIT) {
      return err(
        invalidTask(
          `A task has at most ${CRITERIA_LIMIT} acceptance criteria.`,
        ),
      );
    }
    this.#state = { ...this.#state, criteria };
    this.#touch(actor, now);
    return ok(undefined);
  }

  removeCriterion(
    number: number,
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    if (!this.#criterion(number)) return err(this.#noSuchCriterion(number));
    this.#state = {
      ...this.#state,
      criteria: this.#state.criteria.filter(
        (criterion) => criterion.number !== number,
      ),
    };
    this.#touch(actor, now);
    return ok(undefined);
  }

  checkCriterion(
    number: number,
    met: boolean,
    evidence: string | null,
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    const claim = this.#guardClaim(actor, now);
    if (!claim.ok) return claim;
    if (!this.#criterion(number)) return err(this.#noSuchCriterion(number));

    this.#state = {
      ...this.#state,
      criteria: this.#state.criteria.map((criterion) =>
        criterion.number === number
          ? {
              ...criterion,
              metAt: met ? now : null,
              evidence: met ? evidence?.trim() || null : null,
            }
          : criterion,
      ),
    };
    this.#touch(actor, now);
    return ok(undefined);
  }

  /**
   * Adding a link that exists is a no-op, so an agent retrying after a
   * timeout does no harm. For `blocked-by`, the caller has already asked
   * `TaskGraph` whether it would close a cycle.
   */
  link(
    kind: LinkKind,
    taskId: string,
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    if (taskId === this.id.value) {
      return err(invalidTask("A task cannot be linked to itself."));
    }
    if (!this.#hasLink(kind, taskId)) {
      this.#state = {
        ...this.#state,
        links: [...this.#state.links, { kind, taskId }],
      };
    }
    this.#touch(actor, now);
    return ok(undefined);
  }

  unlink(kind: LinkKind, taskId: string, actor: Actor, now: Date): void {
    this.#state = {
      ...this.#state,
      links: this.#state.links.filter(
        (link) => !(link.kind === kind && link.taskId === taskId),
      ),
    };
    this.#touch(actor, now);
  }

  attach(reference: ExternalReference, actor: Actor, now: Date): void {
    const others = this.#state.references
      .filter((existing) => !existing.sameTarget(reference))
      .map((existing) =>
        reference.isSource && existing.isSource
          ? existing.asSource(false)
          : existing,
      );
    this.#state = { ...this.#state, references: [...others, reference] };
    this.#touch(actor, now);
  }

  detach(url: string, actor: Actor, now: Date): void {
    this.#state = {
      ...this.#state,
      references: this.#state.references.filter(
        (reference) => reference.url !== url,
      ),
    };
    this.#touch(actor, now);
  }

  note(
    kind: NoteKind,
    text: string,
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    const entry = this.#entry(kind, text, actor, now);
    if (!entry.ok) return entry;
    this.#newJournalEntries.push(entry.value);
    this.#touch(actor, now);
    return ok(undefined);
  }

  /**
   * Starting again as the agent that already holds it resumes that session
   * rather than failing, so an agent that lost its context can pick it up.
   */
  startSession(
    actor: Actor,
    surroundings: TaskSurroundings,
    now: Date,
  ): Result<Session, TaskError> {
    const { status, hold } = this.#state;
    if (this.#state.kind === "epic") {
      return err(
        taskError(
          "invalid-transition",
          `${this.key} is an epic: its tasks are the work. Start one of them instead, or list tasks with this epic.`,
        ),
      );
    }
    if (!isOpen(status)) {
      return err(
        taskError(
          "invalid-transition",
          `${this.key} is ${status}. Reopen it before starting work on it.`,
        ),
      );
    }

    const live = this.liveSession(now);
    if (live && sameActor(live.actor, actor)) {
      this.#replaceSession(live.touched(now));
      this.#state = { ...this.#state, updatedAt: now };
      return ok(this.liveSession(now)!);
    }
    if (live) return err(this.#claimedBy(live));

    if (hold) {
      return err(
        taskError(
          "task-on-hold",
          `${this.key} is on hold: ${hold.reason}. Release the hold before starting it.`,
        ),
      );
    }
    if (surroundings.openBlockers.length > 0) {
      return err(
        taskError(
          "task-blocked",
          `${this.key} is blocked by ${surroundings.openBlockers.join(", ")}, still open. Pick a ready task instead.`,
        ),
      );
    }
    if (status === "backlog") {
      return err(
        taskError(
          "task-not-ready",
          `${this.key} is in the backlog. Move it to todo first, or pick a ready task instead.`,
        ),
      );
    }
    // Only a todo task waits on its sub-tasks. One already in progress stays
    // resumable, so an agent that split its own work can come back to it.
    if (status === "todo" && surroundings.openSubtasks.length > 0) {
      return err(
        taskError(
          "open-subtasks",
          `${this.key} waits on its open sub-tasks: ${surroundings.openSubtasks.join(", ")}. Start one of those instead.`,
        ),
      );
    }

    this.#endLapsedSessions(now);
    const session = Session.start(
      UniqueId.create().value,
      this.#state.sessions.length + 1,
      actor,
      now,
    );
    this.#state = {
      ...this.#state,
      sessions: [...this.#state.sessions, session],
    };
    this.#moveTo("in_progress", now);
    this.record(new SessionStarted(this.id.value, session.id, now));
    return ok(session);
  }

  finishSession(
    actor: Actor,
    finish: Finish,
    surroundings: TaskSurroundings,
    now: Date,
  ): Result<void, TaskError> {
    const session = this.#openSessionOf(actor);
    if (!session) {
      return err(
        taskError(
          "no-live-session",
          `You hold no session on ${this.key}. Start the task first.`,
        ),
      );
    }

    const handoff = this.#entry("handoff", finish.summary, actor, now);
    if (!handoff.ok) return handoff;

    switch (finish.outcome) {
      case "done": {
        const done = this.#canComplete(surroundings);
        if (!done.ok) return done;
        this.#moveTo("done", now);
        break;
      }
      case "in_review":
        this.#moveTo("in_review", now);
        break;
      case "paused":
        break;
      case "blocked": {
        const reason = finish.reason?.trim();
        if (!reason) {
          return err(
            invalidTask("Say what the task is waiting on when it is blocked."),
          );
        }
        this.#state = { ...this.#state, hold: { reason, since: now } };
        break;
      }
      case "released":
        this.#moveTo("todo", now);
        break;
    }

    this.#newJournalEntries.push({ ...handoff.value, sessionId: session.id });
    this.#endSession(session, finish.outcome, now);
    return ok(undefined);
  }

  changeStatus(
    target: StatusTarget,
    actor: Actor,
    surroundings: TaskSurroundings,
    now: Date,
  ): Result<void, TaskError> {
    const from = this.#state.status;
    if (from === target) return ok(undefined);

    const live = this.liveSession(now);
    if (live && sameActor(live.actor, actor)) {
      return err(
        taskError(
          "invalid-transition",
          `You are working on ${this.key}. Finish your session with an outcome instead of changing its status.`,
        ),
      );
    }
    if (live && actor.kind === "agent") return err(this.#claimedBy(live));
    if (target === "in_progress" && actor.kind === "agent") {
      return err(
        taskError(
          "invalid-transition",
          `Start ${this.key} to work on it: an agent moves a task into progress by starting a session.`,
        ),
      );
    }

    if (!isOpen(from) && target !== "todo" && target !== "backlog") {
      return err(
        taskError(
          "invalid-transition",
          `${this.key} is ${from}. Reopen it to todo or backlog first.`,
        ),
      );
    }
    if (target === "done") {
      const done = this.#canComplete(surroundings);
      if (!done.ok) return done;
    }

    if (live) {
      this.#endSession(
        live,
        target === "cancelled" ? "cancelled" : "released",
        now,
      );
    }
    this.#moveTo(target, now);
    return ok(undefined);
  }

  putOnHold(reason: string, actor: Actor, now: Date): Result<void, TaskError> {
    const claim = this.#guardClaim(actor, now);
    if (!claim.ok) return claim;
    const trimmed = reason.trim();
    if (!trimmed) {
      return err(invalidTask("Say what the task is waiting on."));
    }
    this.#state = { ...this.#state, hold: { reason: trimmed, since: now } };
    this.#touch(actor, now);
    return ok(undefined);
  }

  releaseHold(actor: Actor, now: Date): Result<void, TaskError> {
    const claim = this.#guardClaim(actor, now);
    if (!claim.ok) return claim;
    this.#state = { ...this.#state, hold: null };
    this.#touch(actor, now);
    return ok(undefined);
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get number(): number {
    return this.props.number;
  }

  get keyPrefix(): string {
    return this.props.keyPrefix;
  }

  get key(): string {
    return formatTaskKey(this.props.number, this.props.keyPrefix);
  }

  get isPersonal(): boolean {
    return this.props.keyPrefix === PERSONAL_KEY_PREFIX;
  }

  get assigneeId(): string | null {
    return this.isPersonal
      ? this.props.ownerId
      : (this.#state.assignee?.userId ?? null);
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get state(): TaskState {
    return this.#state;
  }

  get status(): TaskStatus {
    return this.#state.status;
  }

  get kind(): TaskKind {
    return this.#state.kind;
  }

  get parentId(): string | null {
    return this.#state.parentId;
  }

  get links(): readonly TaskLink[] {
    return this.#state.links;
  }

  get sessions(): readonly Session[] {
    return this.#state.sessions;
  }

  checkClaim(actor: Actor, now: Date): Result<void, TaskError> {
    return this.#guardClaim(actor, now);
  }

  liveSession(now: Date): Session | undefined {
    return this.#state.sessions.find((session) => session.isLive(now));
  }

  pullNewJournalEntries(): JournalEntry[] {
    const entries = this.#newJournalEntries;
    this.#newJournalEntries = [];
    return entries;
  }

  #moveTo(status: TaskStatus, now: Date): void {
    const from = this.#state.status;
    if (from === status) return;
    this.#state = {
      ...this.#state,
      status,
      updatedAt: now,
      completedAt: status === "done" ? now : null,
      hold: isOpen(status) ? this.#state.hold : null,
    };
    this.record(new TaskStatusChanged(this.id.value, from, status, now));
  }

  #canComplete(surroundings: TaskSurroundings): Result<void, TaskError> {
    if (surroundings.openSubtasks.length > 0) {
      return err(
        taskError(
          "open-subtasks",
          `${this.key} still has open sub-tasks: ${surroundings.openSubtasks.join(", ")}. Finish or cancel them first.`,
        ),
      );
    }
    const unmet = this.#state.criteria.filter(
      (criterion) => criterion.metAt === null,
    );
    if (unmet.length > 0) {
      return err(
        taskError(
          "unmet-criteria",
          `${this.key} has unmet acceptance criteria: ${unmet
            .map((criterion) => `${criterion.number}. ${criterion.text}`)
            .join(
              "; ",
            )}. Check each one with its evidence, or remove it if it no longer applies.`,
        ),
      );
    }
    return ok(undefined);
  }

  /**
   * People are not stopped by another agent's session: it is their task list.
   */
  #guardClaim(actor: Actor, now: Date): Result<void, TaskError> {
    const live = this.liveSession(now);
    if (live && actor.kind === "agent" && !sameActor(live.actor, actor)) {
      return err(this.#claimedBy(live));
    }
    return ok(undefined);
  }

  #claimedBy(session: Session): TaskError {
    return taskError(
      "task-claimed",
      `${this.key} is being worked on by ${describeActor(session.actor)} in session ${session.number}, until ${session.leaseEndsAt().toISOString()} unless it is heard from again. Pick another task.`,
    );
  }

  #touch(actor: Actor, now: Date): void {
    const live = this.liveSession(now);
    if (live && sameActor(live.actor, actor)) {
      this.#replaceSession(live.touched(now));
    }
    this.#state = { ...this.#state, updatedAt: now };
  }

  #openSessionOf(actor: Actor): Session | undefined {
    const open = this.#state.sessions.filter((session) => !session.isEnded);
    return open.find((session) => sameActor(session.actor, actor));
  }

  #endSession(session: Session, outcome: SessionOutcome, now: Date): void {
    this.#replaceSession(session.ended(outcome, now));
    this.#state = { ...this.#state, updatedAt: now };
    this.record(new SessionEnded(this.id.value, session.id, outcome, now));
  }

  #endLapsedSessions(now: Date): void {
    for (const session of this.#state.sessions) {
      if (!session.isEnded) this.#endSession(session, "lapsed", now);
    }
  }

  #replaceSession(updated: Session): void {
    this.#state = {
      ...this.#state,
      sessions: this.#state.sessions.map((session) =>
        session.id === updated.id ? updated : session,
      ),
    };
  }

  #entry(
    kind: JournalKind,
    text: string,
    actor: Actor,
    now: Date,
  ): Result<JournalEntry, TaskError> {
    const trimmed = text.trim();
    if (!trimmed) {
      return err(
        invalidTask(
          kind === "handoff"
            ? "Leave a handoff summary: what was done, what is left, and anything the next session must know."
            : "A journal entry needs some text.",
        ),
      );
    }
    if (trimmed.length > JOURNAL_TEXT_LIMIT) {
      return err(
        invalidTask(
          `Keep a journal entry under ${JOURNAL_TEXT_LIMIT} characters; split it into several.`,
        ),
      );
    }
    const session = this.#openSessionOf(actor);
    return ok({
      id: UniqueId.create().value,
      kind,
      text: trimmed,
      author: actor,
      sessionId: session?.id ?? null,
      recordedAt: now,
    });
  }

  #criterion(number: number): AcceptanceCriterion | undefined {
    return this.#state.criteria.find(
      (criterion) => criterion.number === number,
    );
  }

  #lastCriterionNumber(): number {
    return this.#state.criteria.reduce(
      (last, criterion) => Math.max(last, criterion.number),
      0,
    );
  }

  #noSuchCriterion(number: number): TaskError {
    return invalidTask(
      `${this.key} has no acceptance criterion ${number}. Read the task to see its criteria.`,
    );
  }

  #hasLink(kind: LinkKind, taskId: string): boolean {
    return this.#state.links.some(
      (link) => link.kind === kind && link.taskId === taskId,
    );
  }
}

function epicWithParent(subject: string): TaskError {
  return invalidTask(
    `${subject} sits at the top and cannot have a parent. Put tasks under the epic instead.`,
  );
}

function checkTitle(title: string): Result<string, TaskError> {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (!trimmed) return err(invalidTask("A task needs a title."));
  if (trimmed.length > TITLE_LIMIT) {
    return err(
      invalidTask(
        `Keep the title under ${TITLE_LIMIT} characters; put the detail in the description.`,
      ),
    );
  }
  return ok(trimmed);
}

function checkDescription(description: string): Result<string, TaskError> {
  const trimmed = description.trim();
  if (trimmed.length > DESCRIPTION_LIMIT) {
    return err(
      invalidTask(
        `Keep the description under ${DESCRIPTION_LIMIT} characters; record findings as journal entries instead.`,
      ),
    );
  }
  return ok(trimmed);
}

function checkLabels(
  labels: readonly string[],
): Result<readonly string[], TaskError> {
  const names = new Set<string>();
  for (const label of labels) {
    if (!label.trim()) continue;
    const name = parseLabelName(label);
    if (!name.ok) return name;
    names.add(name.value);
  }
  if (names.size > LABEL_LIMIT) {
    return err(invalidTask(`A task has at most ${LABEL_LIMIT} labels.`));
  }
  return ok([...names]);
}

function checkCriteria(
  texts: readonly string[],
  after: number,
): Result<AcceptanceCriterion[], TaskError> {
  const criteria: AcceptanceCriterion[] = [];
  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (trimmed.length > CRITERION_TEXT_LIMIT) {
      return err(
        invalidTask(
          `Keep each acceptance criterion under ${CRITERION_TEXT_LIMIT} characters.`,
        ),
      );
    }
    criteria.push({
      number: after + criteria.length + 1,
      text: trimmed,
      metAt: null,
      evidence: null,
    });
  }
  if (criteria.length > CRITERIA_LIMIT) {
    return err(
      invalidTask(`A task has at most ${CRITERIA_LIMIT} acceptance criteria.`),
    );
  }
  return ok(criteria);
}

function dedupeReferences(
  references: readonly ExternalReference[],
): ExternalReference[] {
  const kept: ExternalReference[] = [];
  for (const reference of references) {
    const index = kept.findIndex((existing) => existing.sameTarget(reference));
    if (index >= 0) kept.splice(index, 1);
    kept.push(reference);
  }
  const lastSource = kept.findLastIndex((reference) => reference.isSource);
  return kept.map((reference, index) =>
    reference.isSource && index !== lastSource
      ? reference.asSource(false)
      : reference,
  );
}
