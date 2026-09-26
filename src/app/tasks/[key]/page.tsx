import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import { TaskDetail } from "@/modules/tasks/ui/task-detail";

import { signInWithGitHubAction } from "../../sign-in/actions";
import { SignedInAccount } from "../../signed-in-account";
import { tasksContext } from "../signed-in-owner";
import { TASK_ACTIONS } from "../task-actions";

export const metadata = {
  title: "Task · Fenro Dashboard",
};

/** A person reads the whole journal; an agent's brief stops at 20 entries. */
const JOURNAL_LIMIT = 200;

export default function TaskPage({ params }: PageProps<"/tasks/[key]">) {
  return (
    <DashboardChrome
      current="tasks"
      account={
        <Suspense fallback={null}>
          <SignedInAccount />
        </Suspense>
      }
    >
      <Suspense fallback={<TaskLoading what="the task" />}>
        <TaskScreen params={params} />
      </Suspense>
    </DashboardChrome>
  );
}

async function TaskScreen({
  params,
}: {
  params: PageProps<"/tasks/[key]">["params"];
}) {
  const { key } = await params;
  const { container, ownerId, repositoryOptions } = await tasksContext();
  if (!ownerId) {
    return (
      <SignInPanel
        heading="Sign in to see this task"
        action={signInWithGitHubAction}
      />
    );
  }

  const [task, labels, repositories] = await Promise.all([
    container.queryBus.ask(
      taskBriefQuery(ownerId, decodeURIComponent(key), JOURNAL_LIMIT),
    ),
    container.queryBus.ask(listLabelsQuery(ownerId)),
    repositoryOptions(),
  ]);
  if (!task.ok) notFound();
  return (
    <TaskDetail
      task={task.value}
      actions={TASK_ACTIONS}
      labels={labels}
      repositories={repositories}
    />
  );
}
