import { notFound } from "next/navigation";

import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import { RouteDialog } from "@/modules/tasks/ui/route-dialog";
import { TaskDialogContent } from "@/modules/tasks/ui/task-dialog";

import { tasksContext } from "../../../tasks/signed-in-owner";
import { TASK_ACTIONS } from "../../../tasks/task-actions";

/** The dialog reads the same brief as the page, trimmed to what it shows. */
const JOURNAL_LIMIT = 20;

/**
 * A task clicked from a list opens here, over that list. Loaded directly
 * (a reload, a shared link), the same address renders the full page in
 * `tasks/[key]` instead.
 */
export default async function TaskDialogPage({
  params,
}: PageProps<"/tasks/[key]">) {
  const { key } = await params;
  const { container, ownerId } = await tasksContext();
  if (!ownerId) return null;

  const [task, labels] = await Promise.all([
    container.queryBus.ask(
      taskBriefQuery(ownerId, decodeURIComponent(key), JOURNAL_LIMIT),
    ),
    container.queryBus.ask(listLabelsQuery(ownerId)),
  ]);
  if (!task.ok) notFound();

  return (
    <RouteDialog labelledBy="task-dialog-title" width="sm:w-[920px]">
      <TaskDialogContent
        task={task.value}
        actions={TASK_ACTIONS}
        labels={labels}
      />
    </RouteDialog>
  );
}
