import {
  formatTaskKey,
  isOpen,
  normaliseLabelName,
  priorityRank,
  SESSION_LEASE_MS,
  type Priority,
  type TaskStatus,
} from "@/modules/tasks/domain";

import type {
  SessionRecord,
  TaskDetailRecord,
  TaskRecord,
} from "../ports/task-read-store";
import type {
  JournalItem,
  RepositoryTasks,
  TaskBrief,
  TaskCountsByRepository,
  TaskList,
  TaskListItem,
  TaskMention,
  TaskState,
  TaskSummary,
} from "./read-models";

export type TaskFilter = {
  /** Only tasks an agent could pick up now, best first. */
  readonly ready?: boolean;
  /** Only tasks in one of these derived states. */
  readonly states?: readonly TaskState[];
  readonly statuses?: readonly TaskStatus[];
  /** Include done and cancelled tasks when no status is asked for. */
  readonly includeClosed?: boolean;
  readonly repository?: string;
  /** Only tasks carrying at least one of these labels. */
  readonly labels?: readonly string[];
  /** Only the sub-tasks of this task (its id). */
  readonly parentId?: string;
  /** Words that must all appear in the title or the key. */
  readonly text?: string;
  readonly limit?: number;
};

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
export const DEFAULT_JOURNAL_LIMIT = 20;

/**
 * The owner's tasks, indexed once, so every derived fact — is it blocked, is it
 * ready, who is on it — is worked out the same way for a list, a count and a
 * brief. `now` decides which sessions are still live.
 */
export class TaskIndex {
  readonly #byId: ReadonlyMap<string, TaskRecord>;
  readonly #children = new Map<string, TaskRecord[]>();

  constructor(
    readonly records: readonly TaskRecord[],
    private readonly now: Date,
  ) {
    this.#byId = new Map(records.map((record) => [record.id, record]));
    for (const record of records) {
      if (!record.parentId) continue;
      this.#children.set(record.parentId, [
        ...(this.#children.get(record.parentId) ?? []),
        record,
      ]);
    }
  }

  get(id: string): TaskRecord | undefined {
    return this.#byId.get(id);
  }

  children(id: string): readonly TaskRecord[] {
    return this.#children.get(id) ?? [];
  }

  openBlockers(record: TaskRecord): TaskRecord[] {
    return record.blockedBy
      .map((id) => this.#byId.get(id))
      .filter((blocker): blocker is TaskRecord =>
        blocker !== undefined ? isOpen(blocker.status) : false,
      );
  }

  liveSession(record: TaskRecord): SessionRecord | null {
    const session = record.latestSession;
    return session && isLive(session, this.now) ? session : null;
  }

  state(record: TaskRecord): TaskState {
    switch (record.status) {
      case "done":
      case "cancelled":
        return record.status;
      case "backlog":
        return "backlog";
    }
    if (this.liveSession(record)) return "running";
    if (record.hold || this.openBlockers(record).length > 0) return "blocked";
    if (record.status === "in_review") return "in-review";
    if (record.status === "in_progress") return "paused";
    const openChildren = this.children(record.id).filter((child) =>
      isOpen(child.status),
    );
    return openChildren.length > 0 ? "waiting" : "ready";
  }

  item(record: TaskRecord): TaskListItem {
    const children = this.children(record.id);
    const live = this.liveSession(record);
    return {
      key: formatTaskKey(record.number),
      title: record.title,
      status: record.status,
      state: this.state(record),
      priority: record.priority,
      labels: record.labels,
      repository: fullName(record),
      parent: this.#keyOf(record.parentId),
      blockedBy: this.openBlockers(record).map((blocker) =>
        formatTaskKey(blocker.number),
      ),
      hold: record.hold?.reason ?? null,
      workedOnBy: live?.actorName ?? null,
      subtasks: {
        open: children.filter((child) => isOpen(child.status)).length,
        total: children.length,
      },
      criteria: { met: record.criteriaMet, total: record.criteriaTotal },
      journalEntries: record.journalEntries,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  mention(id: string): TaskMention | null {
    const record = this.#byId.get(id);
    if (!record) return null;
    return {
      key: formatTaskKey(record.number),
      title: record.title,
      status: record.status,
      state: this.state(record),
    };
  }

  #keyOf(id: string | null): string | null {
    const record = id ? this.#byId.get(id) : undefined;
    return record ? formatTaskKey(record.number) : null;
  }
}

export function isLive(session: SessionRecord, now: Date): boolean {
  return (
    session.endedAt === null &&
    now.getTime() - session.lastSeenAt.getTime() < SESSION_LEASE_MS
  );
}

// --- Lists ------------------------------------------------------------------

const READY_STATES: readonly TaskState[] = ["ready", "paused"];

/**
 * The ready queue's order: most urgent first; within a priority, work already
 * under way before work not started, then oldest first.
 */
function readyOrder(a: TaskListItem & { priority: Priority }, b: TaskListItem) {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) ||
    Number(b.state === "paused") - Number(a.state === "paused") ||
    keyNumber(a) - keyNumber(b)
  );
}

const STATE_ORDER: readonly TaskState[] = [
  "running",
  "paused",
  "ready",
  "blocked",
  "waiting",
  "in-review",
  "backlog",
  "done",
  "cancelled",
];

function listOrder(a: TaskListItem, b: TaskListItem) {
  return (
    STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    keyNumber(a) - keyNumber(b)
  );
}

export function listTasks(index: TaskIndex, filter: TaskFilter): TaskList {
  const words = (filter.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const repository = filter.repository?.toLowerCase();
  const labels = new Set((filter.labels ?? []).map(normaliseLabelName));

  const matching = index.records
    .filter((record) => {
      if (filter.statuses?.length) {
        if (!filter.statuses.includes(record.status)) return false;
      } else if (!filter.includeClosed && !isOpen(record.status)) {
        return false;
      }
      if (repository && fullName(record)?.toLowerCase() !== repository) {
        return false;
      }
      if (
        labels.size > 0 &&
        !record.labels.some((label) => labels.has(label))
      ) {
        return false;
      }
      if (filter.parentId && record.parentId !== filter.parentId) return false;
      if (words.length > 0) {
        const haystack =
          `${formatTaskKey(record.number)} ${record.title}`.toLowerCase();
        if (!words.every((word) => haystack.includes(word))) return false;
      }
      return true;
    })
    .map((record) => index.item(record))
    .filter((item) => !filter.ready || READY_STATES.includes(item.state))
    .filter(
      (item) => !filter.states?.length || filter.states.includes(item.state),
    )
    .sort(filter.ready ? readyOrder : listOrder);

  const limit = Math.min(Math.max(filter.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  return { total: matching.length, tasks: matching.slice(0, limit) };
}

// --- The brief --------------------------------------------------------------

export function brief(
  detail: TaskDetailRecord,
  index: TaskIndex,
  now: Date,
  journalLimit = DEFAULT_JOURNAL_LIMIT,
): TaskBrief {
  const mentions = (ids: readonly string[]) =>
    ids
      .map((id) => index.mention(id))
      .filter((mention): mention is TaskMention => mention !== null);
  const linked = (kind: string) =>
    detail.links
      .filter((link) => link.kind === kind)
      .map((link) => link.taskId);
  const incoming = (kind: string) =>
    detail.incoming
      .filter((link) => link.kind === kind)
      .map((link) => link.taskId);

  const journal: JournalItem[] = detail.journal.map((entry) => ({
    kind: entry.kind,
    text: entry.text,
    author: entry.authorName,
    session: entry.sessionNumber,
    recordedAt: entry.recordedAt.toISOString(),
  }));
  const latest = detail.latestSession;

  return {
    key: formatTaskKey(detail.number),
    id: detail.id,
    title: detail.title,
    status: detail.status,
    state: index.state(detail),
    priority: detail.priority,
    labels: detail.labels,
    repository: fullName(detail),
    description: detail.description,
    acceptanceCriteria: detail.criteria.map((criterion) => ({
      number: criterion.number,
      text: criterion.text,
      met: criterion.metAt !== null,
      evidence: criterion.evidence,
    })),
    hold: detail.hold
      ? { reason: detail.hold.reason, since: detail.hold.since.toISOString() }
      : null,
    parent: detail.parentId ? index.mention(detail.parentId) : null,
    subtasks: mentions(index.children(detail.id).map((child) => child.id)),
    blockedBy: mentions(linked("blocked-by")),
    blocks: mentions(incoming("blocked-by")),
    relatesTo: mentions([
      ...new Set([...linked("relates-to"), ...incoming("relates-to")]),
    ]),
    discoveredFrom: mentions(linked("discovered-from"))[0] ?? null,
    discovered: mentions(incoming("discovered-from")),
    references: detail.references,
    session: latest
      ? {
          number: latest.number,
          by: latest.actorName,
          startedAt: latest.startedAt.toISOString(),
          lastSeenAt: latest.lastSeenAt.toISOString(),
          live: isLive(latest, now),
        }
      : null,
    sessions: detail.sessions.length,
    latestHandoff:
      journal.findLast((entry) => entry.kind === "handoff") ?? null,
    decisions: journal.filter((entry) => entry.kind === "decision"),
    recentJournal: journal.slice(-journalLimit),
    journalEntries: journal.length,
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
  };
}

// --- The repository table -----------------------------------------------------

export function countsByRepository(index: TaskIndex): TaskCountsByRepository {
  const counts: Record<string, { total: number; running: number }> = {};
  for (const record of index.records) {
    const name = fullName(record)?.toLowerCase();
    if (!name || !isOpen(record.status)) continue;
    const count = (counts[name] ??= { total: 0, running: 0 });
    count.total += 1;
    if (index.liveSession(record)) count.running += 1;
  }
  return Object.fromEntries(
    Object.entries(counts).map(([name, count]) => [
      name,
      { ...count, hint: countHint(count) },
    ]),
  );
}

function countHint({ total, running }: { total: number; running: number }) {
  if (total === 0) return "no tasks";
  return running > 0 ? `${running} running` : "none running";
}

/** How many tasks a repository's panel lists before saying how many more. */
export const PANEL_LIMIT = 5;

const PANEL_ORDER: readonly TaskState[] = [
  "running",
  "blocked",
  "in-review",
  "paused",
  "ready",
  "waiting",
  "backlog",
];

export function repositoryTasks(
  index: TaskIndex,
  owner: string,
  name: string,
  now: Date,
): RepositoryTasks {
  const wanted = `${owner}/${name}`.toLowerCase();
  const open = index.records
    .filter(
      (record) =>
        isOpen(record.status) && fullName(record)?.toLowerCase() === wanted,
    )
    .map((record) => ({ record, state: index.state(record) }))
    .sort(
      (a, b) =>
        PANEL_ORDER.indexOf(a.state) - PANEL_ORDER.indexOf(b.state) ||
        priorityRank(a.record.priority) - priorityRank(b.record.priority) ||
        a.record.number - b.record.number,
    );

  const shown: TaskSummary[] = open
    .slice(0, PANEL_LIMIT)
    .map(({ record, state }) => ({
      id: formatTaskKey(record.number),
      title: record.title,
      lastActivity: lastActivity(index, record, state, now),
      state,
      contextItems: record.journalEntries,
    }));
  return {
    summary: panelSummary(open.map(({ state }) => state)),
    total: open.length,
    shown,
  };
}

function panelSummary(states: readonly TaskState[]): string {
  if (states.length === 0) return "no tasks yet";
  const count = (state: TaskState) =>
    states.filter((candidate) => candidate === state).length;
  const parts = [
    [count("running"), "running"],
    [count("blocked"), "blocked"],
    [count("in-review"), "in review"],
    [count("paused"), "paused"],
    [count("ready") + count("waiting") + count("backlog"), "not started"],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, what]) => `${n} ${what}`)
    .join(", ");
}

function lastActivity(
  index: TaskIndex,
  record: TaskRecord,
  state: TaskState,
  now: Date,
): string {
  const session = record.latestSession;
  switch (state) {
    case "running":
      return `Session ${session!.number} running, ${duration(session!.startedAt, now)} in`;
    case "paused":
      return session
        ? `Paused after session ${session.number}, ${duration(session.lastSeenAt, now)} ago`
        : "In progress, no session yet";
    case "blocked":
      if (record.hold) {
        return `On hold since ${day(record.hold.since)}: ${record.hold.reason}`;
      }
      return `Blocked by ${index
        .openBlockers(record)
        .map((blocker) => formatTaskKey(blocker.number))
        .join(", ")}`;
    case "in-review":
      return `In review for ${duration(record.updatedAt, now)}`;
    case "waiting":
      return "Waiting on its sub-tasks";
    case "backlog":
      return "In the backlog";
    default:
      return session ? `Ready, after session ${session.number}` : "Not started";
  }
}

// --- Helpers ------------------------------------------------------------------

function fullName(record: TaskRecord): string | null {
  return record.repository
    ? `${record.repository.owner}/${record.repository.name}`
    : null;
}

function keyNumber(item: TaskListItem): number {
  return Number(item.key.slice(2));
}

function duration(from: Date, to: Date): string {
  const minutes = Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

function day(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
