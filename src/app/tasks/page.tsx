import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import type { ListTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { listTaskRepositoriesQuery } from "@/modules/tasks/application/queries/list-task-repositories";
import { listTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import { taskBoardQuery } from "@/modules/tasks/application/queries/task-board";
import {
  ASSIGNED_TO_ME,
  isTaskView,
  parseDoneParam,
  parseEpicParam,
  parseAssigneesParam,
  parseLabelsParam,
  parseSpacesParam,
  TASK_VIEWS,
  TaskList,
  UNASSIGNED,
  type AssigneePerson,
  type TaskListFilter,
  type TaskView,
} from "@/modules/tasks/ui/task-list";

import { signInWithGitHubAction } from "../sign-in/actions";
import { moveTaskAction } from "./actions";
import { SignedInAccount } from "../signed-in-account";
import { tasksContext } from "./signed-in-owner";

export const metadata = {
  title: "Tasks · Fenro Dashboard",
  description: "Your tasks, and the ones agents are working on.",
};

const LIST_LIMIT = 100;
const EPIC_LIMIT = 100;

const VIEW_FILTERS: Record<TaskView, ListTasksQuery["filter"]> = {
  open: {},
  ready: { ready: true },
  active: { states: ["running", "paused", "in-review"] },
  blocked: { states: ["blocked", "waiting"] },
  closed: { statuses: ["done", "cancelled"] },
};

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <DashboardChrome
      current="tasks"
      account={
        <Suspense fallback={null}>
          <SignedInAccount />
        </Suspense>
      }
    >
      <Suspense fallback={<TaskLoading what="your tasks" />}>
        <TasksScreen searchParams={searchParams} />
      </Suspense>
    </DashboardChrome>
  );
}

async function TasksScreen({
  searchParams,
}: {
  searchParams: PageProps<"/tasks">["searchParams"];
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const filter: TaskListFilter = {
    view: isTaskView(params.view) ? params.view : "open",
    repository: one(params.repository),
    text: one(params.q),
    labels: parseLabelsParam(one(params.labels)),
    epic: parseEpicParam(one(params.epic)),
    layout: one(params.layout) === "board" ? "board" : "list",
    done: parseDoneParam(one(params.done)),
    spaces: parseSpacesParam(one(params.spaces)),
    needsAnswer: one(params.needs) === "answer",
    assignees: parseAssigneesParam(one(params.assignee)),
  };

  const { container, spaces, you, groupMembers } = await tasksContext();
  if (!spaces || !you) {
    return (
      <SignInPanel
        heading="Sign in to see your tasks"
        action={signInWithGitHubAction}
      />
    );
  }

  const shown = filter.spaces?.length
    ? spaces.all.filter((space) => filter.spaces!.includes(space.prefix))
    : spaces.all;
  const ownerId = shown.map((space) => space.ownerId);

  const members = await groupMembers();
  const people = peopleIn(members, spaces.groups);
  const userIdOf = new Map(
    [...members.values()]
      .flat()
      .map((member) => [member.login.toLowerCase(), member.userId]),
  );

  const scope: ListTasksQuery["filter"] = {
    repository: filter.repository || undefined,
    text: filter.text || undefined,
    labels: filter.labels,
    needsAnswer: filter.needsAnswer || undefined,
    assignees: filter.assignees?.length
      ? filter.assignees.map((token) =>
          token === ASSIGNED_TO_ME
            ? you.id
            : token === UNASSIGNED
              ? null
              : (userIdOf.get(token) ?? ""),
        )
      : undefined,
    ...epicScope(filter.epic ?? ""),
  };
  const ask = container.queryBus.ask.bind(container.queryBus);
  const onBoard = filter.layout === "board";
  const [
    labels,
    repositories,
    epics,
    needing,
    content,
    scopeTotals,
    ...totals
  ] = await Promise.all([
    ask(listLabelsQuery(ownerId)),
    ask(listTaskRepositoriesQuery(ownerId)),
    ask(listTasksQuery(ownerId, { kinds: ["epic"], limit: EPIC_LIMIT })),
    ask(listTasksQuery(ownerId, { needsAnswer: true, limit: 1 })),
    onBoard
      ? ask(taskBoardQuery(ownerId, scope, filter.done))
      : ask(
          listTasksQuery(ownerId, {
            ...VIEW_FILTERS[filter.view],
            ...scope,
            limit: LIST_LIMIT,
          }),
        ),
    Promise.all(
      (["", "epics", "none"] as const).map((rail) =>
        ask(listTasksQuery(ownerId, { ...epicScope(rail), limit: 1 })),
      ),
    ),
    ...(onBoard
      ? []
      : TASK_VIEWS.map(({ view }) =>
          ask(
            listTasksQuery(ownerId, {
              ...VIEW_FILTERS[view],
              ...scope,
              limit: 1,
            }),
          ),
        )),
  ]);
  const counts = onBoard
    ? undefined
    : Object.fromEntries(
        TASK_VIEWS.map(({ view }, index) => [view, totals[index]!.total]),
      );
  const [all, epicsOnly, none] = scopeTotals.map((result) => result.total);
  return (
    <TaskList
      list={"columns" in content ? undefined : content}
      board={"columns" in content ? content : undefined}
      filter={filter}
      counts={counts}
      labels={labels}
      repositories={repositories}
      epics={epics.tasks}
      scopeCounts={{ all: all!, epics: epicsOnly!, none: none! }}
      spaces={spaces.all}
      needingAnswers={needing.total}
      you={you}
      people={people}
      move={moveTaskAction}
    />
  );
}

function epicScope(scope: string): ListTasksQuery["filter"] {
  if (!scope) return {};
  if (scope === "epics") return { kinds: ["epic"] };
  if (scope === "none") return { outsideEpics: true };
  return { epic: scope };
}

function peopleIn(
  members: ReadonlyMap<string, readonly { userId: string; login: string }[]>,
  groups: readonly { id: string; prefix: string }[],
): AssigneePerson[] {
  const shared = new Map<string, { login: string; groups: string[] }>();
  for (const group of groups) {
    for (const member of members.get(group.id) ?? []) {
      const person = shared.get(member.userId) ?? {
        login: member.login,
        groups: [],
      };
      person.groups.push(group.prefix);
      shared.set(member.userId, person);
    }
  }
  return [...shared.values()]
    .map(({ login, groups }) => ({ login, groups: groups.join(" ") }))
    .sort((a, b) => a.login.localeCompare(b.login));
}
