import { ArrowsOutSimple } from "@phosphor-icons/react/ssr";

import type { TaskBrief } from "@/modules/tasks/application/queries/read-models";

import {
  AgentLine,
  CriteriaList,
  HandoffCard,
  HoldNotice,
  JournalSection,
  StatusActions,
  TaskChips,
  TaskProperties,
} from "./task-detail";
import type { LabelOption } from "./labels";
import type { TaskActions } from "./task-forms";
import { PictureStrip } from "./pictures";
import { CloseDialogButton } from "./route-dialog";
import { taskHref } from "./task-state";

/**
 * A task opened over the list it was clicked in: the handoff, the criteria,
 * the newest journal entries and the facts. Everything else is one click
 * away on the full page.
 */
export function TaskDialogContent({
  task,
  actions,
  labels = [],
  picturesEnabled = false,
}: {
  task: TaskBrief;
  actions: TaskActions;
  /** The owner's labels. */
  labels?: readonly LabelOption[];
  /** Whether this Fenro has somewhere to keep pictures. */
  picturesEnabled?: boolean;
}) {
  const fullPage = taskHref(task.key);
  return (
    <>
      <div className="border-hairline-soft flex items-start justify-between gap-4 border-b px-5 pt-[18px] pb-3.5 sm:px-[22px]">
        <div className="flex min-w-0 flex-col gap-2">
          <h2
            id="task-dialog-title"
            className="text-ink text-[19px] leading-snug font-semibold tracking-tight"
          >
            <span className="text-ink-faint mr-2 font-mono font-medium">
              {task.key}
            </span>
            {task.title}
          </h2>
          <TaskChips task={task} labels={labels} actions={actions} />
          <AgentLine task={task} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* A plain link, so the router does not intercept it again. */}
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

      <div className="grid min-h-0 flex-1 gap-7 overflow-y-auto px-5 py-[18px] sm:px-[22px] md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex min-w-0 flex-col gap-5">
          <HoldNotice task={task} />
          <HandoffCard entry={task.latestHandoff} />
          <PictureStrip
            taskKey={task.key}
            pictures={task.pictures}
            removeAction={actions.removePicture}
            enabled={picturesEnabled}
            fullPage={fullPage}
          />
          <CriteriaList task={task} actions={actions} addable={false} />
          <JournalSection
            task={task}
            actions={actions}
            limit={2}
            moreHref={fullPage}
          />
        </div>
        <TaskProperties task={task} />
      </div>

      <div className="border-hairline-soft bg-surface-raised flex flex-col gap-3 border-t px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-[22px]">
        <span className="text-ink-muted hidden text-[12px] sm:block">
          Esc closes. The address is this task&apos;s, so a reload opens the
          full page.
        </span>
        <StatusActions task={task} actions={actions} menuOpensUp />
      </div>
    </>
  );
}
