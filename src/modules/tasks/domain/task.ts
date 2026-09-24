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
  TaskCreated,
  TaskStatusChanged,
} from "./events";
import type { ExternalReference } from "./external-reference";
import {
  JOURNAL_TEXT_LIMIT,
  type JournalEntry,
  type JournalKind,
  type NoteKind,
} from "./journal-entry";
import type { RepositoryReference } from "./repository-reference";
import { Session, type FinishOutcome, type SessionOutcome } from "./session";
import { formatTaskKey } from "./task-key";
import type { LinkKind, TaskLink } from "./task-link";
import { isOpen, type Priority, type TaskStatus } from "./task-status";

export const TITLE_LIMIT = 200;
export const DESCRIPTION_LIMIT = 50_000;
export const LABEL_LIMIT = 20;
export const CRITERIA_LIMIT = 50;

const LABEL = /^[a-z0-9][a-z0-9._:/-]{0,39}$/;

/**
 * What the task cannot see from inside itself but must obey: whether the tasks
 * it is blocked by are finished, and whether its sub-tasks are. The
 * application layer reads them from the task graph and hands them in, and the
 * task decides; they are keys so a refusal can name them.
 */
export type TaskSurroundings = {
  readonly openBlockers: readonly string[];
  readonly openSubtasks: readonly string[];
};

export type Hold = { readonly reason: string; readonly since: Date };

type Props = {
  readonly ownerId: string;
  readonly number: number;
  readonly createdAt: Date;
};

export type TaskState = {
  readonly title: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly labels: readonly string[];
  readonly repository: RepositoryReference | null;
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
  readonly number: number;
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
  /** What the next session needs to know. Required: it is the handoff. */
  readonly summary: string;
  /** Required when the outcome is `blocked`: what the task is waiting on. */
  readonly reason?: string;
};

/** Where a status change may be asked for; `in_progress` comes from a session. */
export type StatusTarget = Exclude<TaskStatus, "in_progress">;

/**
 * A piece of work, and the context it carries from one agent session to the
 * next. Every task and sub-task is its own aggregate (Daniel's call on ticket
 * 08), so agents working siblings never contend on a parent.
 *
 * What it guards:
 *
 * - **One live session.** An agent claims the task by starting a session; a
 *   second agent is refused until the first finishes or its lease lapses.
 *   While a session is live, status moves go through it: its holder finishes
 *   the session, another agent is refused, and a person may override.
 * - **Finishing honestly.** A task is not done while a sub-task is open or an
 *   acceptance criterion is unmet, and a session does not end without a
 *   handoff summary.
 * - **Ready means ready.** A session cannot start while the task is in the
 *   backlog, on hold, blocked by an open task, or — before work on it has
 *   begun — waiting on its open sub-tasks.
 * - **An append-only journal.** Entries are added, never changed.
 *
 * Rules that span tasks — no cycle through `blocked-by` or through parents —
 * belong to `TaskGraph`, which the application layer consults before calling
 * `link` or `moveUnder`.
 */
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

    const task = new Task(
      UniqueId.create(input.id),
      { ownerId: input.ownerId, number: input.number, createdAt: input.now },
      {
        title: title.value,
        description: description.value,
        status: input.status ?? "todo",
        priority: input.priority ?? "none",
        labels: labels.value,
        repository: input.repository ?? null,
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
    task.record(
      new TaskCreated(task.id.value, formatTaskKey(input.number), input.now),
    );
    return ok(task);
  }

  /** Rebuild a task a store already holds, recording no event. */
  static restore(id: UniqueId, props: Props, state: TaskState): Task {
    return new Task(id, props, state);
  }

  // --- Editing -------------------------------------------------------------

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
   * Make this a sub-task of `parentId`, or a top-level task with `null`. The
   * caller has already asked `TaskGraph` whether that would close a cycle.
   */
  moveUnder(
    parentId: string | null,
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    if (parentId === this.id.value) {
      return err(invalidTask("A task cannot be its own parent."));
    }
    this.#state = { ...this.#state, parentId };
    this.#touch(actor, now);
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

  /** Mark a criterion met (with how it was shown) or not met again. */
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
   * Relate this task to another. Adding a link that exists is a no-op, so an
   * agent retrying after a timeout does no harm. For `blocked-by`, the caller
   * has already asked `TaskGraph` whether it would close a cycle.
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

  /**
   * Attach a link to the outside world, replacing one to the same target. Only
   * one reference is the task's source; marking a new one moves the mark.
   */
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

  /** Append to the journal. Anyone may; nothing appended is ever changed. */
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

  // --- Sessions ------------------------------------------------------------

  /**
   * Claim the task. Starting again as the agent that already holds it resumes
   * that session rather than failing, so an agent that lost its context can
   * pick its work back up.
   */
  startSession(
    actor: Actor,
    surroundings: TaskSurroundings,
    now: Date,
  ): Result<Session, TaskError> {
    const { status, hold } = this.#state;
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

  /**
   * End the actor's session, leaving a handoff for whoever comes next. A
   * session that lapsed can still be finished by its own agent, as long as
   * nobody else has started one since.
   */
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

  // --- Status --------------------------------------------------------------

  /**
   * Move the task to another status outside a session: plan it, cancel it,
   * reopen it, send it to review, or mark it done when no session is needed.
   */
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

    // A person overriding a live session ends it for the agent.
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

  /** Mark the task as waiting on something outside fenro. */
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

  // --- Reading -------------------------------------------------------------

  get ownerId(): string {
    return this.props.ownerId;
  }

  get number(): number {
    return this.props.number;
  }

  get key(): string {
    return formatTaskKey(this.props.number);
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

  get parentId(): string | null {
    return this.#state.parentId;
  }

  get links(): readonly TaskLink[] {
    return this.#state.links;
  }

  get sessions(): readonly Session[] {
    return this.#state.sessions;
  }

  liveSession(now: Date): Session | undefined {
    return this.#state.sessions.find((session) => session.isLive(now));
  }

  /** Entries appended since the task was loaded, for the store to add. */
  pullNewJournalEntries(): JournalEntry[] {
    const entries = this.#newJournalEntries;
    this.#newJournalEntries = [];
    return entries;
  }

  // --- Internals -----------------------------------------------------------

  #moveTo(status: TaskStatus, now: Date): void {
    const from = this.#state.status;
    if (from === status) return;
    this.#state = {
      ...this.#state,
      status,
      updatedAt: now,
      completedAt: status === "done" ? now : null,
      // Finishing or cancelling a task ends whatever it was waiting on.
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
   * Another agent's live session keeps this agent's hands off the task's
   * status and criteria. People are not stopped: it is their task list.
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

  /** Any change the session holder makes renews its lease. */
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

/** Labels are compared as written, so they are stored lower-case. */
function checkLabels(
  labels: readonly string[],
): Result<readonly string[], TaskError> {
  const normalised = [
    ...new Set(labels.map((label) => label.trim().toLowerCase())),
  ].filter(Boolean);
  const bad = normalised.find((label) => !LABEL.test(label));
  if (bad !== undefined) {
    return err(
      invalidTask(
        `"${bad}" is not a label: up to 40 lower-case letters, digits and . _ : / -`,
      ),
    );
  }
  if (normalised.length > LABEL_LIMIT) {
    return err(invalidTask(`A task has at most ${LABEL_LIMIT} labels.`));
  }
  return ok(normalised);
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
