import {
  ChatCircleDots,
  Kanban,
  ListBullets,
  MagnifyingGlass,
  Plus,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import Form from "next/form";
import Link from "next/link";

import {
  DONE_WINDOWS,
  type DoneWindow,
  type TaskBoard as TaskBoardResult,
  type TaskListItem,
  type TaskList as TaskListResult,
  type TaskRepositoryItem,
  type TaskState,
} from "@/modules/tasks/application/queries/read-models";
import { PERSONAL_KEY_PREFIX } from "@/modules/tasks/domain";

import { AssigneeFilter, type AssigneeFilterOption } from "./assignee-filter";
import { Avatar, assigneeLogin, assigneeWords, type Reader } from "./assignee";
import { EpicRail } from "./epic-rail";
import { LabelFilter, type LabelFilterOption } from "./label-filter";
import { QuestionsChip } from "./questions-chip";
import { colourOf, LabelDot, type LabelOption } from "./labels";
import { RepositoryFilter } from "./repository-filter";
import { SpaceFilter } from "./space-filter";
import { TaskBoard, type MoveTask } from "./task-board";
import { EpicProgress, EpicTag, TaskKindIcon } from "./task-kind";
import { StateChip } from "./state-chip";
import { taskHref } from "./task-state";

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
  readonly labels: readonly string[];
  readonly epic?: EpicScope;
  readonly layout?: TaskLayout;
  readonly done?: DoneWindow;
  /** Key prefixes of the spaces shown; empty shows every space. */
  readonly spaces?: readonly string[];
  readonly needsAnswer?: boolean;
  /** Lower-case logins, or `ASSIGNED_TO_ME` and `UNASSIGNED`. */
  readonly assignees?: readonly string[];
};

// A tilde cannot appear in a GitHub login, so these never shadow a person.
export const ASSIGNED_TO_ME = "~me";
export const UNASSIGNED = "~none";

export function parseAssigneesParam(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((token) => token.trim().toLowerCase())
        .filter(
          (token) =>
            token === ASSIGNED_TO_ME ||
            token === UNASSIGNED ||
            /^[a-z\d](?:[a-z\d-]{0,38})$/.test(token),
        ),
    ),
  ];
}

export type AssigneePerson = {
  readonly login: string;
  /** Prefixes of the groups shared with them, as in "HAL MOR". */
  readonly groups: string;
};

export type ListSpace = {
  readonly prefix: string;
  readonly name: string;
  readonly kind: "personal" | "group";
};

export function parseSpacesParam(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((prefix) => prefix.trim().toUpperCase())
        .filter((prefix) => /^[A-Z]{1,5}$/.test(prefix)),
    ),
  ];
}

/** A label name never holds a comma. */
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
  // The board has no views: its columns are the statuses.
  if (filter.view !== "open" && filter.layout !== "board") {
    params.set("view", filter.view);
  }
  if (filter.layout === "board") params.set("layout", "board");
  if (filter.layout === "board" && filter.done && filter.done !== "week") {
    params.set("done", filter.done);
  }
  if (filter.spaces?.length) params.set("spaces", filter.spaces.join(","));
  if (filter.needsAnswer) params.set("needs", "answer");
  if (filter.assignees?.length) {
    params.set("assignee", filter.assignees.join(","));
  }
  if (filter.epic) params.set("epic", filter.epic);
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

export type EpicScope = "" | "epics" | "none" | (string & {});

export type TaskLayout = "list" | "board";

export function parseEpicParam(value: string): EpicScope {
  const scope = value.trim();
  if (scope === "epics" || scope === "none") return scope;
  return /^[a-z]{1,5}-\d+$/i.test(scope) ? scope.toUpperCase() : "";
}

export function parseDoneParam(value: string): DoneWindow {
  return DONE_WINDOWS.find((window) => window === value) ?? "week";
}

export function TaskList({
  list,
  board,
  filter,
  counts,
  labels = [],
  repositories = [],
  epics,
  scopeCounts,
  spaces = [],
  needingAnswers = 0,
  you,
  people = [],
  move,
}: {
  list?: TaskListResult;
  board?: TaskBoardResult;
  filter: TaskListFilter;
  labels?: readonly (LabelOption & { readonly openTasks?: number })[];
  repositories?: readonly Pick<TaskRepositoryItem, "name" | "openTasks">[];
  counts?: Partial<Record<TaskView, number>>;
  epics?: readonly TaskListItem[];
  scopeCounts?: {
    readonly all: number;
    readonly epics: number;
    readonly none: number;
  };
  spaces?: readonly ListSpace[];
  needingAnswers?: number;
  you?: Reader;
  people?: readonly AssigneePerson[];
  move?: MoveTask;
}) {
  const layout = filter.layout ?? "list";
  const groups = spaces.filter((space) => space.kind === "group");
  const shownSpaces = filter.spaces?.length
    ? spaces.filter((space) => filter.spaces!.includes(space.prefix))
    : spaces;
  const groupNames =
    shownSpaces.length > 1
      ? new Map(groups.map((group) => [group.prefix, group.name]))
      : undefined;
  const scope = filter.epic ?? "";
  const pickedEpic =
    scope && scope !== "epics" && scope !== "none" ? scope : "";
  const newParams = new URLSearchParams();
  if (filter.repository) newParams.set("repository", filter.repository);
  if (pickedEpic) newParams.set("parent", pickedEpic);
  const newHref = newParams.size ? `/tasks/new?${newParams}` : "/tasks/new";
  const shownTasks =
    list?.tasks ?? board?.columns.flatMap((c) => c.tasks) ?? [];
  const working = shownTasks.filter((task) => task.workedOnBy).length;
  const total =
    list?.total ??
    board?.columns
      .filter((column) => column.status !== "done")
      .reduce((sum, column) => sum + column.total, 0) ??
    0;
  const epicTitle = epics?.find((epic) => epic.key === pickedEpic)?.title;

  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <div className="border-hairline flex flex-col-reverse gap-3 border-b md:flex-row md:items-end md:justify-between">
        {layout === "list" ? (
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
        ) : (
          <p className="text-ink-muted pb-2.5 text-[12.5px]">
            Drag a card to change its status, or use its menu. Cancelled tasks
            stay in the list under Closed.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 md:mb-2 md:flex-nowrap">
          {needingAnswers > 0 || filter.needsAnswer ? (
            <NeedsAnswerFilter
              on={filter.needsAnswer ?? false}
              count={needingAnswers}
              href={hrefFor({ ...filter, needsAnswer: !filter.needsAnswer })}
            />
          ) : null}
          {groups.length > 0 ? (
            <SpaceFilter {...spaceFilterProps(filter, groups)} />
          ) : null}
          {you ? (
            <AssigneeFilter {...assigneeFilterProps(filter, you, people)} />
          ) : null}
          <LabelFilter
            options={labelOptions(filter, labels)}
            clearHref={hrefFor({ ...filter, labels: [] })}
          />
          <RepositoryFilter
            options={repositoryOptions(filter, repositories)}
            picked={filter.repository}
            allHref={hrefFor({ ...filter, repository: "" })}
          />
          <Form
            action="/tasks"
            role="search"
            className="border-hairline bg-surface focus-within:outline-pr flex h-[34px] items-center gap-2 rounded-lg border px-[11px] focus-within:outline-2 focus-within:outline-offset-1 max-md:flex-1 md:w-[240px]"
          >
            {hiddenFields(filter).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
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

      {layout === "board" && board && move ? (
        <TaskBoard
          columns={board.columns}
          labels={labels}
          you={you}
          move={move}
          done={{
            current: board.done,
            hrefs: {
              week: hrefFor({ ...filter, done: "week" }),
              month: hrefFor({ ...filter, done: "month" }),
              all: hrefFor({ ...filter, done: "all" }),
            },
          }}
        />
      ) : list && list.tasks.length === 0 ? (
        <p className="border-hairline bg-surface text-ink-muted rounded-xl border px-5 py-10 text-center text-[13px]">
          {emptyMessage(filter)}
        </p>
      ) : list ? (
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
                  <TaskRow
                    task={task}
                    labels={labels}
                    groupNames={groupNames}
                    you={you}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : null}
      {list && list.total > list.tasks.length ? (
        <p className="text-ink-muted text-[12px]">
          Showing {list.tasks.length} of {list.total}. Search or pick a view to
          narrow it down.
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-ink text-[24px] leading-tight font-semibold tracking-tight">
            {epicTitle ?? "Tasks"}
          </h1>
          <p className="text-ink-muted text-[13px]">
            {total === 1 ? "1 task" : `${total} tasks`}
            {layout === "board" ? " open" : null}
            {working > 0
              ? `, ${working} of them with an agent on ${working === 1 ? "it" : "them"}`
              : null}
            {pickedEpic ? (
              <>
                {" in epic "}
                <Link
                  href={taskHref(pickedEpic)}
                  scroll={false}
                  className="hover:text-ink font-mono underline underline-offset-2"
                >
                  {pickedEpic}
                </Link>
              </>
            ) : null}
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
        <div className="flex items-center gap-2 max-sm:w-full">
          <nav
            aria-label="Layout"
            className="border-hairline bg-surface inline-flex rounded-lg border p-0.5 max-sm:flex-1"
          >
            {(
              [
                ["list", "List", ListBullets],
                ["board", "Board", Kanban],
              ] as const
            ).map(([value, label, Icon]) => {
              const here = value === layout;
              return (
                <Link
                  key={value}
                  href={hrefFor({ ...filter, layout: value })}
                  scroll={false}
                  aria-current={here ? "page" : undefined}
                  className={`focus-visible:outline-pr inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-[12.5px] focus-visible:outline-2 max-sm:flex-1 ${
                    here
                      ? "bg-ink text-ground font-medium"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-[13px]" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <Link
            href={newHref}
            className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex h-[34px] items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1"
          >
            <Plus aria-hidden="true" weight="bold" className="size-[15px]" />
            New task
          </Link>
        </div>
      </header>

      {epics ? (
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
          <EpicRail
            scopes={[
              ["", "All tasks", scopeCounts?.all],
              ["epics", "Epics only", scopeCounts?.epics],
              ["none", "Not in an epic", scopeCounts?.none],
            ].map(([value, label, count]) => ({
              label: String(label),
              count: Number(count ?? 0),
              href: hrefFor({ ...filter, epic: value as EpicScope }),
              current: scope === value,
            }))}
            epics={epics}
            epicHref={(key) => hrefFor({ ...filter, epic: key })}
            picked={pickedEpic}
            newEpicHref="/tasks/new?type=epic"
          />
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}

function hiddenFields(filter: TaskListFilter): [string, string][] {
  const fields: [string, string][] = [];
  if (filter.view !== "open" && (filter.layout ?? "list") === "list") {
    fields.push(["view", filter.view]);
  }
  if (filter.spaces?.length) fields.push(["spaces", filter.spaces.join(",")]);
  if (filter.needsAnswer) fields.push(["needs", "answer"]);
  if (filter.assignees?.length) {
    fields.push(["assignee", filter.assignees.join(",")]);
  }
  if (filter.epic) fields.push(["epic", filter.epic]);
  if (filter.repository) fields.push(["repository", filter.repository]);
  if (filter.labels.length > 0)
    fields.push(["labels", filter.labels.join(",")]);
  if (filter.layout === "board") fields.push(["layout", "board"]);
  if (filter.layout === "board" && filter.done && filter.done !== "week") {
    fields.push(["done", filter.done]);
  }
  return fields;
}

function spaceFilterProps(
  filter: TaskListFilter,
  groups: readonly ListSpace[],
) {
  const all = groups.map((group) => group.prefix);
  const chosen = filter.spaces ?? [];
  const personalOnly =
    chosen.length > 0 && !chosen.some((prefix) => all.includes(prefix));
  const picked =
    chosen.length === 0 ? all : chosen.filter((p) => p !== PERSONAL_KEY_PREFIX);
  const withGroups = (next: readonly string[]) =>
    hrefFor({
      ...filter,
      spaces:
        next.length === all.length
          ? []
          : next.length === 0
            ? [PERSONAL_KEY_PREFIX]
            : [PERSONAL_KEY_PREFIX, ...next],
    });
  return {
    personalOnly,
    personalHref: hrefFor({ ...filter, spaces: [PERSONAL_KEY_PREFIX] }),
    allHref: hrefFor({ ...filter, spaces: [] }),
    manageHref: "/settings#groups",
    groups: groups.map((group) => {
      const on = !personalOnly && picked.includes(group.prefix);
      return {
        prefix: group.prefix,
        name: group.name,
        picked: on,
        href: withGroups(
          personalOnly
            ? [group.prefix]
            : on
              ? picked.filter((prefix) => prefix !== group.prefix)
              : [...picked, group.prefix],
        ),
      };
    }),
  };
}

function assigneeFilterProps(
  filter: TaskListFilter,
  you: Reader,
  people: readonly AssigneePerson[],
): {
  me: AssigneeFilterOption;
  unassigned: AssigneeFilterOption;
  people: AssigneeFilterOption[];
  clearHref: string;
} {
  const chosen = filter.assignees ?? [];
  const option = (
    token: string,
    login: string | null,
    label: string,
    groups?: string,
  ): AssigneeFilterOption => {
    const picked = chosen.includes(token);
    return {
      login,
      label,
      groups,
      picked,
      href: hrefFor({
        ...filter,
        assignees: picked
          ? chosen.filter((other) => other !== token)
          : [...chosen, token],
      }),
    };
  };
  const mine = you.login.toLowerCase();
  return {
    me: option(ASSIGNED_TO_ME, you.login, "Assigned to me"),
    unassigned: option(UNASSIGNED, null, "Unassigned"),
    people: people
      .filter((person) => person.login.toLowerCase() !== mine)
      .map((person) =>
        option(
          person.login.toLowerCase(),
          person.login,
          person.login,
          person.groups,
        ),
      ),
    clearHref: hrefFor({ ...filter, assignees: [] }),
  };
}

function labelOptions(
  filter: TaskListFilter,
  labels: readonly (LabelOption & { readonly openTasks?: number })[],
): LabelFilterOption[] {
  const all = [
    ...labels,
    ...filter.labels
      .filter((name) => !labels.some((label) => label.name === name))
      .map((name) => ({ name, colour: colourOf(labels, name), openTasks: 0 })),
  ];
  return all.map((label) => {
    const picked = filter.labels.includes(label.name);
    return {
      name: label.name,
      colour: label.colour,
      openTasks: label.openTasks ?? 0,
      picked,
      href: hrefFor({
        ...filter,
        labels: picked
          ? filter.labels.filter((name) => name !== label.name)
          : [...filter.labels, label.name],
      }),
    };
  });
}

function NeedsAnswerFilter({
  on,
  count,
  href,
}: {
  on: boolean;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={on}
      className={`focus-visible:outline-pr inline-flex h-[34px] items-center gap-1.5 rounded-lg border px-[11px] text-[12.5px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 ${
        on
          ? "border-ink bg-surface text-ink font-medium shadow-[inset_0_0_0_0.5px_var(--color-ink)]"
          : "border-hairline bg-surface text-ink hover:bg-surface-sunken"
      }`}
    >
      <ChatCircleDots aria-hidden="true" className="size-[14px]" />
      Needs my answer
      {count > 0 ? (
        <span className="text-ink-faint font-mono text-[12px]">{count}</span>
      ) : null}
    </Link>
  );
}

function emptyMessage(filter: TaskListFilter): string {
  if (filter.needsAnswer) return "No task is waiting on your answers.";
  if (filter.assignees?.length) return "No task has that assignee here.";
  if (filter.text) return "No task matches that search.";
  if (filter.labels.length > 0) return "No task matches those labels.";
  return EMPTY[filter.view];
}

/**
 * One in the URL that no task names yet is still offered, so the list can show
 * it picked.
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

function TaskRow({
  task,
  labels,
  groupNames,
  you,
}: {
  task: TaskListItem;
  labels: readonly LabelOption[];
  groupNames?: ReadonlyMap<string, string>;
  you?: Reader;
}) {
  const priority = PRIORITY_WORDS[task.priority];
  return (
    <Link
      href={taskHref(task.key)}
      scroll={false}
      className={`hover:bg-surface-raised focus-visible:outline-pr grid grid-cols-[18px_64px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 md:grid-cols-[18px_68px_minmax(0,1fr)_170px_64px_92px] md:px-[18px] ${
        task.kind === "epic" ? "bg-epic-wash/40" : ""
      }`}
    >
      <span className="self-start pt-px md:self-center">
        <TaskKindIcon kind={task.kind} />
      </span>
      <span className="text-ink-faint self-start pt-px font-mono text-[12.5px] md:self-center">
        {task.key}
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span
          className={`text-ink text-[14px] ${task.kind === "epic" ? "font-medium" : ""}`}
        >
          {task.title}
        </span>
        <Meta
          task={task}
          labels={labels}
          group={groupNames?.get(task.key.slice(0, task.key.lastIndexOf("-")))}
          you={you}
        />
      </span>
      <span className="hidden min-w-0 items-center gap-2 text-[12.5px] md:flex">
        {task.kind === "epic" ? null : <AssigneeCell task={task} you={you} />}
      </span>
      <span className="text-ink-muted hidden text-[12px] md:block">
        {priority}
      </span>
      <span className="self-start justify-self-end md:self-center">
        <StateChip state={task.state} />
      </span>
    </Link>
  );
}

function AssigneeCell({ task, you }: { task: TaskListItem; you?: Reader }) {
  const words = assigneeWords(task.assignee, you);
  return (
    <>
      <Avatar login={assigneeLogin(task.assignee, you)} />
      <span
        className={`truncate ${
          !task.assignee
            ? "text-ink-faint"
            : words === "You"
              ? "text-ink"
              : "text-ink-soft font-mono text-[12px]"
        }`}
      >
        {words}
      </span>
    </>
  );
}

function Meta({
  task,
  labels,
  group,
  you,
}: {
  task: TaskListItem;
  labels: readonly LabelOption[];
  group?: string;
  you?: Reader;
}) {
  const facts: {
    text: string;
    mono?: boolean;
    attention?: boolean;
  }[] = [];
  if (task.repository) facts.push({ text: task.repository, mono: true });
  // Under an epic directly, the epic tag already says where it sits.
  if (task.parent && task.parent !== task.epic?.key) {
    facts.push({ text: `sub-task of ${task.parent}` });
  }
  if (task.hold) facts.push({ text: `on hold: ${task.hold}`, attention: true });
  if (task.blockedBy.length > 0) {
    facts.push({
      text: `blocked by ${task.blockedBy.join(", ")}`,
      attention: true,
    });
  }
  if (task.subtasks.total > 0 && !task.progress) {
    facts.push({
      text: `${task.subtasks.open} of ${task.subtasks.total} sub-tasks open`,
    });
  }
  if (task.criteria.total > 0) {
    facts.push({
      text: `${task.criteria.met} of ${task.criteria.total} criteria met`,
    });
  }
  if (
    facts.length === 0 &&
    !group &&
    !task.workedOnBy &&
    task.questions === 0 &&
    task.labels.length === 0 &&
    !task.epic &&
    !task.progress
  ) {
    facts.push({ text: "Nothing recorded yet" });
  }

  return (
    <span className="text-ink-muted flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-[12px]">
      {group ? (
        <span className="text-ink-soft inline-flex items-center gap-1.5">
          <UsersThree aria-hidden="true" className="size-3" />
          {group}
        </span>
      ) : null}
      {task.kind === "epic" ? null : (
        <span className="inline-flex items-center gap-1.5 md:hidden">
          <Avatar login={assigneeLogin(task.assignee, you)} size="sm" />
          {assigneeWords(task.assignee, you)}
        </span>
      )}
      <QuestionsChip count={task.questions} />
      {task.progress ? <EpicProgress progress={task.progress} /> : null}
      {task.epic ? <EpicTag title={task.epic.title} /> : null}
      {task.labels.map((name) => (
        <span
          key={`label:${name}`}
          className="inline-flex items-center gap-1.5"
        >
          <LabelDot colour={colourOf(labels, name)} />
          {name}
        </span>
      ))}
      {task.workedOnBy ? (
        <span className="text-ink-soft inline-flex items-center gap-1.5">
          <LiveDot />
          <span className="font-mono">{task.workedOnBy}</span> is on it
        </span>
      ) : null}
      {facts.map((fact) => (
        <span
          key={fact.text}
          className={`${fact.mono ? "font-mono" : ""} ${fact.attention ? "text-issue-strong" : ""}`}
        >
          {fact.text}
        </span>
      ))}
    </span>
  );
}

export function LiveDot() {
  return (
    <span
      aria-hidden="true"
      className="bg-running ring-state-running-wash size-[7px] shrink-0 rounded-full ring-[3px]"
    />
  );
}
