import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import { TaskDetail } from "@/modules/tasks/ui/task-detail";
import { picturesEnabled } from "@/shared/infrastructure/container";

import { signInWithGitHubAction } from "../../sign-in/actions";
import { SignedInAccount } from "../../signed-in-account";
import { tasksContext } from "../signed-in-owner";
import { TASK_ACTIONS } from "../task-actions";

export const metadata = {
  title: "Task · Fenro Dashboard",
};

const JOURNAL_LIMIT = 200;

export default function TaskPage({
  params,
  searchParams,
}: PageProps<"/tasks/[key]">) {
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
        <TaskScreen params={params} searchParams={searchParams} />
      </Suspense>
    </DashboardChrome>
  );
}

async function TaskScreen({
  params,
  searchParams,
}: {
  params: PageProps<"/tasks/[key]">["params"];
  searchParams: PageProps<"/tasks/[key]">["searchParams"];
}) {
  const key = decodeURIComponent((await params).key);
  const { round } = await searchParams;
  const shownRound = Number(Array.isArray(round) ? round[0] : round);
  const now = new Date();
  const { container, spaces, you, spaceOf, repositoryOptions, parentOptions } =
    await tasksContext(now);
  if (!spaces) {
    return (
      <SignInPanel
        heading="Sign in to see this task"
        action={signInWithGitHubAction}
      />
    );
  }

  const ownerId = spaces.ownerOf(key);
  const [task, labels, repositories, parents, space] = await Promise.all([
    container.queryBus.ask(
      taskBriefQuery(ownerId, key, JOURNAL_LIMIT, {
        readerId: spaces.personal.ownerId,
      }),
    ),
    container.queryBus.ask(listLabelsQuery(ownerId)),
    repositoryOptions(),
    parentOptions(ownerId),
    spaceOf(key),
  ]);
  if (!task.ok) notFound();
  return (
    <TaskDetail
      task={task.value}
      actions={TASK_ACTIONS}
      labels={labels}
      repositories={repositories}
      parents={parents}
      picturesEnabled={picturesEnabled()}
      now={now}
      round={Number.isInteger(shownRound) ? shownRound : null}
      you={you?.login}
      space={space}
    />
  );
}
