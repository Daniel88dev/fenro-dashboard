import { ArrowsOutSimple } from "@phosphor-icons/react/ssr";

import {
  CancelDialogButton,
  CloseDialogButton,
  RouteDialog,
} from "@/modules/tasks/ui/route-dialog";
import { NewTaskForm } from "@/modules/tasks/ui/task-forms";

import { newTaskDefaults } from "../../../tasks/new/defaults";
import { tasksContext } from "../../../tasks/signed-in-owner";
import { TASK_ACTIONS } from "../../../tasks/task-actions";

/**
 * New task as a dialog over the page it was started from: a repository row,
 * a pull request's checks, the task list. The full form is one click away.
 */
export default async function NewTaskDialogPage({
  searchParams,
}: PageProps<"/tasks/new">) {
  const { ownerId } = await tasksContext();
  if (!ownerId) return null;

  const params = await searchParams;
  const defaults = newTaskDefaults(params);
  const query = new URLSearchParams(
    Object.entries({
      repository: defaults.repository,
      parent: defaults.parent,
      from: defaults.source,
      title: defaults.title,
    }).filter(([, value]) => value !== ""),
  ).toString();
  const fullPage = `/tasks/new${query ? `?${query}` : ""}`;

  return (
    <RouteDialog labelledBy="new-task-title" width="sm:w-[720px]">
      <div className="border-hairline-soft flex items-center justify-between gap-4 border-b px-5 pt-[18px] pb-3.5 sm:px-[22px]">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h2
            id="new-task-title"
            className="text-ink text-[18px] font-semibold tracking-tight"
          >
            New task
          </h2>
          <p className="text-ink-muted text-[12.5px]">
            {defaults.repository ? (
              <>
                In <span className="font-mono">{defaults.repository}</span>
                .{" "}
              </>
            ) : null}
            What you write is the brief an agent reads.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={fullPage}
            className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr flex h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium focus-visible:outline-2"
          >
            <ArrowsOutSimple aria-hidden="true" className="size-3.5" />
            Full page
          </a>
          <CloseDialogButton />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NewTaskForm
          action={TASK_ACTIONS.create}
          defaults={defaults}
          variant="dialog"
          cancel={<CancelDialogButton />}
        />
      </div>
    </RouteDialog>
  );
}
