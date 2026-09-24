import Form from "next/form";
import Link from "next/link";

import { Chip } from "@/modules/github-insights/ui/chip";
import type { TaskList as TaskListResult } from "@/modules/tasks/application/queries/read-models";

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
};

function hrefFor(filter: TaskListFilter): string {
  const params = new URLSearchParams();
  if (filter.view !== "open") params.set("view", filter.view);
  if (filter.repository) params.set("repository", filter.repository);
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

/**
 * Every task, the way a person scans them: which view, then the rows. The
 * view and search live in the URL, so a filtered list can be shared.
 */
export function TaskList({
  list,
  filter,
}: {
  list: TaskListResult;
  filter: TaskListFilter;
}) {
  const newHref = filter.repository
    ? `/tasks/new?repository=${encodeURIComponent(filter.repository)}`
    : "/tasks/new";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-ink text-[22px] font-semibold tracking-tight">
            Tasks
          </h1>
          <p className="text-ink-muted text-[13px]">
            {list.total === 1 ? "1 task" : `${list.total} tasks`}
            {filter.repository ? (
              <>
                {" in "}
                <span className="font-mono">{filter.repository}</span>
                {" · "}
                <Link
                  href={hrefFor({ ...filter, repository: "" })}
                  className="hover:text-ink underline underline-offset-2"
                >
                  all repositories
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Link
          href={newHref}
          className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex h-[34px] items-center rounded-lg border px-[13px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          New task
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Views" className="flex flex-wrap gap-1.5">
          {TASK_VIEWS.map(({ view, label }) => {
            const here = view === filter.view;
            return (
              <Link
                key={view}
                href={hrefFor({ ...filter, view })}
                aria-current={here ? "page" : undefined}
                className={`focus-visible:outline-pr rounded-full border px-2.5 py-0.5 text-[12px] font-medium focus-visible:outline-2 ${
                  here
                    ? "border-pr bg-pr-wash text-pr-strong"
                    : "border-hairline bg-surface text-ink-soft hover:bg-surface-sunken"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Form action="/tasks" role="search" className="flex items-center gap-2">
          {filter.view !== "open" ? (
            <input type="hidden" name="view" value={filter.view} />
          ) : null}
          {filter.repository ? (
            <input type="hidden" name="repository" value={filter.repository} />
          ) : null}
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
            className="border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr h-[32px] w-[240px] rounded-lg border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
          />
        </Form>
      </div>

      {list.tasks.length === 0 ? (
        <p className="border-hairline bg-surface text-ink-muted rounded-xl border px-[18px] py-10 text-center text-[13px]">
          {filter.text ? "No task matches that search." : EMPTY[filter.view]}
        </p>
      ) : (
        <ul
          aria-label="Tasks"
          className="border-hairline bg-surface divide-hairline-soft divide-y rounded-xl border"
        >
          {list.tasks.map((task) => (
            <li key={task.key}>
              <Link
                href={taskHref(task.key)}
                className="hover:bg-surface-raised focus-visible:outline-pr flex flex-wrap items-center gap-x-3 gap-y-1 px-[18px] py-3 focus-visible:outline-2"
              >
                <span className="text-ink-faint w-[54px] shrink-0 font-mono text-[12.5px]">
                  {task.key}
                </span>
                <span className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                  <span className="text-ink text-[13.5px]">{task.title}</span>
                  <span className="text-ink-muted text-[11.5px]">
                    {describe(task)}
                  </span>
                </span>
                {task.priority !== "none" ? (
                  <span className="text-ink-muted text-[11.5px]">
                    {task.priority}
                  </span>
                ) : null}
                <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip>
              </Link>
            </li>
          ))}
        </ul>
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

function describe(task: TaskListResult["tasks"][number]): string {
  const parts: string[] = [];
  if (task.repository) parts.push(task.repository);
  if (task.parent) parts.push(`sub-task of ${task.parent}`);
  if (task.workedOnBy) parts.push(`${task.workedOnBy} is on it`);
  if (task.hold) parts.push(`on hold: ${task.hold}`);
  if (task.blockedBy.length > 0) {
    parts.push(`blocked by ${task.blockedBy.join(", ")}`);
  }
  if (task.subtasks.total > 0) {
    parts.push(
      `${task.subtasks.open} of ${task.subtasks.total} sub-tasks open`,
    );
  }
  if (task.criteria.total > 0) {
    parts.push(`${task.criteria.met}/${task.criteria.total} criteria met`);
  }
  return parts.join(" · ") || "Nothing recorded yet";
}
