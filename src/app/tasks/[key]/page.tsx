import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import { TaskDetail } from "@/modules/tasks/ui/task-detail";
import { TaskDialogContent } from "@/modules/tasks/ui/task-dialog";
import { OnTaskPage, TaskPageDialog } from "@/modules/tasks/ui/task-link";
import { OPEN_PARAM } from "@/modules/tasks/ui/task-state";
import { picturesEnabled } from "@/shared/infrastructure/container";

import { signInWithGitHubAction } from "../../sign-in/actions";
import { SignedInAccount } from "../../signed-in-account";
import { tasksContext } from "../signed-in-owner";
import { TASK_ACTIONS } from "../task-actions";

export const metadata = {
  title: "Task · Fenro Dashboard",
};

const JOURNAL_LIMIT = 200;
const DIALOG_JOURNAL_LIMIT = 20;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

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
  const query = await searchParams;
  const shownRound = Number(first(query.round));
  const opened = first(query[OPEN_PARAM]);
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
  const openedOwnerId = opened ? spaces.ownerOf(opened) : null;
  const readerId = spaces.personal.ownerId;
  const [task, labels, repositories, parents, space, openedTask, openedLabels] =
    await Promise.all([
      container.queryBus.ask(
        taskBriefQuery(ownerId, key, JOURNAL_LIMIT, { readerId }),
      ),
      container.queryBus.ask(listLabelsQuery(ownerId)),
      repositoryOptions(),
      parentOptions(ownerId),
      spaceOf(key),
      opened && openedOwnerId
        ? container.queryBus.ask(
            taskBriefQuery(openedOwnerId, opened, DIALOG_JOURNAL_LIMIT, {
              readerId,
            }),
          )
        : null,
      openedOwnerId && openedOwnerId !== ownerId
        ? container.queryBus.ask(listLabelsQuery(openedOwnerId))
        : null,
    ]);
  if (!task.ok) notFound();
  return (
    <OnTaskPage taskKey={task.value.key}>
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
      {openedTask?.ok && (
        <TaskPageDialog
          key={openedTask.value.key}
          taskKey={opened ?? openedTask.value.key}
        >
          <TaskDialogContent
            task={openedTask.value}
            actions={TASK_ACTIONS}
            labels={openedLabels ?? labels}
            picturesEnabled={picturesEnabled()}
            you={you ?? undefined}
          />
        </TaskPageDialog>
      )}
    </OnTaskPage>
  );
}
