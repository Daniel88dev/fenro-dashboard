import { MagnifyingGlass, Plus } from "@phosphor-icons/react/ssr";
import Form from "next/form";
import Link from "next/link";

import { Chip } from "@/modules/github-insights/ui/chip";
import type {
  TaskListItem,
  TaskList as TaskListResult,
  TaskRepositoryItem,
  TaskState,
} from "@/modules/tasks/application/queries/read-models";

import { colourOf, LabelDot, type LabelOption } from "./labels";
import { RepositoryFilter } from "./repository-filter";
import { STATE_TONES, taskHref } from "./task-state";

export const TASK_VIEWS = [
  { view: "open", label: "Open" },
  { view: "ready", label: "Ready" },
  { view: "active", label: "In progress" },
  { view: "blocked", label: "Blocked" },
  { view: "closed", label: "Closed" },
] as const;

export type TaskView = (typeof TASK_VIEWS)[number]["view"];

export function isTaskView(value: unknown): value is TaskView {
  return TASK_VIEWS.some((candidate) => candidate.view === value);
}

export type TaskListFilter = {
  readonly view: TaskView;
  readonly repository: string;
  readonly text: string;
  /** Tasks carrying any of these; none means every task. */
  readonly labels: readonly string[];
};

/** `labels=bug,docs` in the URL: a label name never holds a comma. */
export function parseLabelsParam(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function hrefFor(filter: TaskListFilter): string {
  const params = new URLSearchParams();
  if (filter.view !== "open") params.set("view", filter.view);
  if (filter.repository) params.set("repository", filter.repository);
  if (filter.labels.length > 0) params.set("labels", filter.labels.join(","));
  if (filter.text) params.set("q", filter.text);
  const query = params.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

const EMPTY: Record<TaskView, string> = {
  open: "No open tasks. Create one, or let an agent file what it finds.",
  ready: "Nothing is ready: every open task is blocked, waiting or taken.",
  active: "No task is being worked on.",
  blocked: "Nothing is blocked.",
  closed: "No task is done or cancelled yet.",
};

/** The groups the open list falls into, in the order a person acts on them. */
const GROUPS: readonly { label: string; states: readonly TaskState[] }[] = [
  { label: "In progress", states: ["running", "paused", "in-review"] },
  { label: "Blocked", states: ["blocked", "waiting"] },
  { label: "Ready", states: ["ready"] },
  { label: "Backlog", states: ["backlog"] },
  { label: "Done", states: ["done"] },
  { label: "Cancelled", states: ["cancelled"] },
];

function groupsOf(tasks: readonly TaskListItem[]) {
  return GROUPS.map((group) => ({
    label: group.label,
    tasks: tasks.filter((task) => group.states.includes(task.state)),
  })).filter((group) => group.tasks.length > 0);
}

/**
 * Every task, the way a person scans them: which view, then the rows grouped
 * by what is happening to them. The view and search live in the URL, so a
 * filtered list can be shared.
 */
export function TaskList({
  list,
  filter,
  counts,
  labels = [],
  repositories = [],
}: {
  list: TaskListResult;
  filter: TaskListFilter;
  /** The owner's labels, offered as filters. */
  labels?: readonly LabelOption[];
  /** The repositories the owner's tasks name, offered as filters. */
  repositories?: readonly Pick<TaskRepositoryItem, "name" | "openTasks">[];
  /** How many tasks each view holds, for the tabs. */
  counts?: Partial<Record<TaskView, number>>;
}) {
  const newHref = filter.repository
    ? `/tasks/new?repository=${encodeURIComponent(filter.repository)}`
    : "/tasks/new";
  const working = list.tasks.filter((task) => task.workedOnBy).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-ink text-[24px] leading-tight font-semibold tracking-tight">
            Tasks
          </h1>
          <p className="text-ink-muted text-[13px]">
            {list.total === 1 ? "1 task" : `${list.total} tasks`}
            {working > 0
              ? `, ${working} of them with an agent on ${working === 1 ? "it" : "them"}`
              : null}
            {filter.repository ? (
              <>
                {" in "}
                <span className="font-mono">{filter.repository}</span>
                {". "}
                <Link
                  href={hrefFor({ ...filter, repository: "" })}
                  className="hover:text-ink underline underline-offset-2"
                >
                  Show all repositories
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Link
          href={newHref}
          className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex h-[34px] items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          <Plus aria-hidden="true" weight="bold" className="size-[15px]" />
          New task
        </Link>
      </header>

      <div className="border-hairline flex flex-col-reverse gap-3 border-b md:flex-row md:items-end md:justify-between">
        <nav
          aria-label="Views"
          className="-mb-px flex [scrollbar-width:none] gap-1 overflow-x-auto"
        >
          {TASK_VIEWS.map(({ view, label }) => {
            const here = view === filter.view;
            const count = counts?.[view];
            return (
              <Link
                key={view}
                href={hrefFor({ ...filter, view })}
                aria-current={here ? "page" : undefined}
                className={`focus-visible:outline-pr flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pt-1.5 pb-2.5 text-[13px] whitespace-nowrap focus-visible:outline-2 ${
                  here
                    ? "border-ink text-ink font-medium"
                    : "text-ink-muted hover:text-ink border-transparent"
                }`}
              >
                {label}
                {count === undefined ? null : (
                  <span className="text-ink-faint font-mono text-[12px]">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-2 md:mb-2 md:flex-nowrap">
          <RepositoryFilter
            options={repositoryOptions(filter, repositories)}
            picked={filter.repository}
            allHref={hrefFor({ ...filter, repository: "" })}
          />
          <Form
            action="/tasks"
            role="search"
            className="border-hairline bg-surface focus-within:outline-pr flex h-[34px] items-center gap-2 rounded-lg border px-[11px] focus-within:outline-2 focus-within:outline-offset-1 max-md:flex-1 md:w-[260px]"
          >
            {filter.view !== "open" ? (
              <input type="hidden" name="view" value={filter.view} />
            ) : null}
            {filter.repository ? (
              <input
                type="hidden"
                name="repository"
                value={filter.repository}
              />
            ) : null}
            {filter.labels.length > 0 ? (
              <input
                type="hidden"
                name="labels"
                value={filter.labels.join(",")}
              />
            ) : null}
            <MagnifyingGlass
              aria-hidden="true"
              className="text-ink-faint size-[15px] shrink-0"
            />
            <label htmlFor="task-search" className="sr-only">
              Search tasks
            </label>
            {/* Not a login field: the attributes keep password managers off it. */}
            <input
              id="task-search"
              name="q"
              type="search"
              defaultValue={filter.text}
              placeholder="Search by title or key"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              className="text-ink placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </Form>
        </div>
      </div>

      <LabelFilter filter={filter} labels={labels} />

      {list.tasks.length === 0 ? (
        <p className="border-hairline bg-surface text-ink-muted rounded-xl border px-5 py-10 text-center text-[13px]">
          {emptyMessage(filter)}
        </p>
      ) : (
        groupsOf(list.tasks).map((group) => (
          <section
            key={group.label}
            aria-label={group.label}
            className="flex flex-col gap-2"
          >
            <h2 className="flex items-baseline gap-2 px-0.5">
              <span className="text-ink text-[13px] font-semibold">
                {group.label}
              </span>
              <span className="text-ink-faint font-mono text-[12px]">
                {group.tasks.length}
              </span>
            </h2>
            <ul className="border-hairline bg-surface divide-hairline-soft m-0 list-none divide-y overflow-hidden rounded-xl border p-0">
              {group.tasks.map((task) => (
                <li key={task.key}>
                  <TaskRow task={task} labels={labels} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {list.total > list.tasks.length ? (
        <p className="text-ink-muted text-[12px]">
          Showing {list.tasks.length} of {list.total}. Search or pick a view to
          narrow it down.
        </p>
      ) : null}
    </div>
  );
}

function emptyMessage(filter: TaskListFilter): string {
  if (filter.text) return "No task matches that search.";
  if (filter.labels.length > 0) return "No task matches those labels.";
  return EMPTY[filter.view];
}

/**
 * The repositories to offer, busiest first. One in the URL that no task
 * names yet is still offered, so the list can show it picked.
 */
function repositoryOptions(
  filter: TaskListFilter,
  repositories: readonly Pick<TaskRepositoryItem, "name" | "openTasks">[],
) {
  const picked = filter.repository.toLowerCase();
  const all =
    picked && !repositories.some(({ name }) => name.toLowerCase() === picked)
      ? [...repositories, { name: filter.repository, openTasks: 0 }]
      : repositories;
  return [...all]
    .sort(
      (a, b) =>
        b.openTasks - a.openTasks ||
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    )
    .map(({ name, openTasks }) => ({
      name,
      openTasks,
      href: hrefFor({ ...filter, repository: name }),
    }));
}

const PRIORITY_WORDS: Record<TaskListItem["priority"], string | null> = {
  none: null,
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PILL =
  "focus-visible:outline-pr inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1";
const PILL_ON = "border-ink bg-ink text-ground font-medium";
const PILL_OFF =
  "border-hairline bg-surface text-ink-soft hover:border-ink-faint hover:text-ink";

/**
 * One pill per label, pressed ones filtering the list to tasks carrying any
 * of them. The pick lives in the URL beside the view and the search, as the
 * issue chips on the repository table do.
 */
function LabelFilter({
  filter,
  labels,
}: {
  filter: TaskListFilter;
  labels: readonly LabelOption[];
}) {
  // A label in the URL that no longer exists can still be unpressed.
  const shown = [
    ...labels,
    ...filter.labels
      .filter((name) => !labels.some((label) => label.name === name))
      .map((name) => ({ name, colour: colourOf(labels, name) })),
  ];
  if (shown.length === 0) return null;

  return (
    <nav
      aria-label="Filter by label"
      className="-mt-1 flex [scrollbar-width:none] items-center gap-1.5 overflow-x-auto md:flex-wrap"
    >
      <span className="text-ink-muted shrink-0 pr-1 text-[12px]">Labels</span>
      {shown.map((label) => {
        const on = filter.labels.includes(label.name);
        const next = on
          ? filter.labels.filter((name) => name !== label.name)
          : [...filter.labels, label.name];
        return (
          <Link
            key={label.name}
            href={hrefFor({ ...filter, labels: next })}
            aria-pressed={on}
            scroll={false}
            className={`${PILL} ${on ? PILL_ON : PILL_OFF}`}
          >
            <LabelDot colour={label.colour} />
            {label.name}
          </Link>
        );
      })}
      {filter.labels.length > 0 ? (
        <Link
          href={hrefFor({ ...filter, labels: [] })}
          scroll={false}
          className="text-ink-muted hover:text-ink shrink-0 px-1.5 text-[12px] underline underline-offset-2"
        >
          Clear
        </Link>
      ) : null}
    </nav>
  );
}

function TaskRow({
  task,
  labels,
}: {
  task: TaskListItem;
  labels: readonly LabelOption[];
}) {
  const priority = PRIORITY_WORDS[task.priority];
  return (
    <Link
      href={taskHref(task.key)}
      scroll={false}
      className="hover:bg-surface-raised focus-visible:outline-pr grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 md:grid-cols-[52px_minmax(0,1fr)_170px_64px_92px] md:px-[18px]"
    >
      <span className="text-ink-faint self-start pt-px font-mono text-[12.5px] md:self-center">
        {task.key}
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-ink text-[14px]">{task.title}</span>
        <Meta task={task} labels={labels} />
      </span>
      <span className="text-ink-soft hidden items-center gap-[7px] text-[12px] md:flex">
        {task.workedOnBy ? (
          <>
            <LiveDot />
            <span className="truncate font-mono">{task.workedOnBy}</span>
          </>
        ) : null}
      </span>
      <span className="text-ink-muted hidden text-[12px] md:block">
        {priority}
      </span>
      <span className="self-start justify-self-end md:self-center">
        <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip>
      </span>
    </Link>
  );
}

/** The facts under a title, spaced apart rather than joined with dots. */
function Meta({
  task,
  labels,
}: {
  task: TaskListItem;
  labels: readonly LabelOption[];
}) {
  const facts: {
    text: string;
    mono?: boolean;
    attention?: boolean;
    /** Said in its own column from md up. */
    narrowOnly?: boolean;
  }[] = [];
  if (task.repository) facts.push({ text: task.repository, mono: true });
  if (task.parent) facts.push({ text: `sub-task of ${task.parent}` });
  if (task.hold) facts.push({ text: `on hold: ${task.hold}`, attention: true });
  if (task.blockedBy.length > 0) {
    facts.push({
      text: `blocked by ${task.blockedBy.join(", ")}`,
      attention: true,
    });
  }
  if (task.subtasks.total > 0) {
    facts.push({
      text: `${task.subtasks.open} of ${task.subtasks.total} sub-tasks open`,
    });
  }
  if (task.criteria.total > 0) {
    facts.push({
      text: `${task.criteria.met} of ${task.criteria.total} criteria met`,
    });
  }
  if (task.workedOnBy) {
    facts.push({ text: `${task.workedOnBy} is on it`, narrowOnly: true });
  }
  if (facts.length === 0 && task.labels.length === 0) {
    facts.push({ text: "Nothing recorded yet" });
  }

  return (
    <span className="text-ink-muted flex flex-wrap gap-x-3.5 gap-y-0.5 text-[12px]">
      {task.labels.map((name) => (
        <span
          key={`label:${name}`}
          className="inline-flex items-center gap-1.5"
        >
          <LabelDot colour={colourOf(labels, name)} />
          {name}
        </span>
      ))}
      {facts.map((fact) => (
        <span
          key={fact.text}
          className={`${fact.mono ? "font-mono" : ""} ${fact.attention ? "text-issue-strong" : ""} ${fact.narrowOnly ? "md:hidden" : ""}`}
        >
          {fact.text}
        </span>
      ))}
    </span>
  );
}

/** Only a live agent session gets a dot. */
export function LiveDot() {
  return (
    <span
      aria-hidden="true"
      className="bg-pr ring-pr-wash size-[7px] shrink-0 rounded-full ring-[3px]"
    />
  );
}
