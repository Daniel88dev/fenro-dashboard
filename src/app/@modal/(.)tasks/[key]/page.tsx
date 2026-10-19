import { notFound } from "next/navigation";

import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import { RouteDialog } from "@/modules/tasks/ui/route-dialog";
import { TaskDialogContent } from "@/modules/tasks/ui/task-dialog";
import { picturesEnabled } from "@/shared/infrastructure/container";

import { tasksContext } from "../../../tasks/signed-in-owner";
import { TASK_ACTIONS } from "../../../tasks/task-actions";

const JOURNAL_LIMIT = 20;

export default async function TaskDialogPage({
  params,
}: PageProps<"/tasks/[key]">) {
  const key = decodeURIComponent((await params).key);
  const { container, spaces } = await tasksContext();
  if (!spaces) return null;

  const ownerId = spaces.ownerOf(key);
  const [task, labels] = await Promise.all([
    container.queryBus.ask(taskBriefQuery(ownerId, key, JOURNAL_LIMIT)),
    container.queryBus.ask(listLabelsQuery(ownerId)),
  ]);
  if (!task.ok) notFound();

  return (
    <RouteDialog labelledBy="task-dialog-title" width="sm:w-[920px]">
      <TaskDialogContent
        task={task.value}
        actions={TASK_ACTIONS}
        labels={labels}
        picturesEnabled={picturesEnabled()}
      />
    </RouteDialog>
  );
}
