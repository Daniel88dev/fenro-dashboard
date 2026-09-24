import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import type { ListTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import { listTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import {
  isTaskView,
  TaskList,
  type TaskListFilter,
  type TaskView,
} from "@/modules/tasks/ui/task-list";

import { signInWithGitHubAction } from "../sign-in/actions";
import { SignedInAccount } from "../signed-in-account";
import { tasksContext } from "./signed-in-owner";

export const metadata = {
  title: "Tasks · Fenro Dashboard",
  description: "Your tasks, and the ones agents are working on.",
};

const LIST_LIMIT = 100;

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
  };

  const { container, ownerId } = await tasksContext();
  if (!ownerId) {
    return (
      <SignInPanel
        heading="Sign in to see your tasks"
        action={signInWithGitHubAction}
      />
    );
  }

  const list = await container.queryBus.ask(
    listTasksQuery(ownerId, {
      ...VIEW_FILTERS[filter.view],
      repository: filter.repository || undefined,
      text: filter.text || undefined,
      limit: LIST_LIMIT,
    }),
  );
  return <TaskList list={list} filter={filter} />;
}
