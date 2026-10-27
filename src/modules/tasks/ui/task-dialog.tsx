import { ArrowsOutSimple, ChatCircleDots } from "@phosphor-icons/react/ssr";

import type { TaskBrief } from "@/modules/tasks/application/queries/read-models";

import { Avatar, assigneeLogin, assigneeWords, type Reader } from "./assignee";
import {
  AgentLine,
  CriteriaList,
  HandoffCard,
  HoldNotice,
  JournalSection,
  StatusActions,
  TaskChips,
  TaskProperties,
  TaskTrail,
} from "./task-detail";
import type { LabelOption } from "./labels";
import type { TaskActions } from "./task-forms";
import { PictureStrip } from "./pictures";
import { questionsLabel } from "./questions-chip";
import { CloseDialogButton } from "./route-dialog";
import { TaskKindIcon } from "./task-kind";
import { taskHref } from "./task-state";
import { TaskSkillsLine } from "./task-skills";

export function TaskDialogContent({
  task,
  actions,
  labels = [],
  picturesEnabled = false,
  you,
}: {
  task: TaskBrief;
  actions: TaskActions;
  labels?: readonly LabelOption[];
  picturesEnabled?: boolean;
  you?: Reader;
}) {
  const fullPage = taskHref(task.key);
  return (
    <>
      <div className="border-hairline-soft flex items-start justify-between gap-4 border-b px-5 pt-[18px] pb-3.5 sm:px-[22px]">
        <div className="flex min-w-0 flex-col gap-2">
          <TaskTrail task={task} />
          <h2
            id="task-dialog-title"
            className="text-ink text-[19px] leading-snug font-semibold tracking-tight"
          >
            <span className="mr-2 inline-block align-[-3px]">
              <TaskKindIcon kind={task.kind} />
            </span>
            <span className="text-ink-faint mr-2 font-mono font-medium">
              {task.key}
            </span>
            {task.title}
          </h2>
          <TaskChips
            task={task}
            labels={labels}
            actions={actions}
            questions={<QuestionsLink task={task} fullPage={fullPage} />}
          />
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
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-ink-muted text-[12px] font-medium">Assignee</h3>
            <span className="text-ink flex items-center gap-2 text-[13px]">
              <Avatar login={assigneeLogin(task.assignee, you)} size="sm" />
              {assigneeWords(task.assignee, you)}
            </span>
          </div>
          <TaskProperties task={task} />
          <TaskSkillsLine skills={task.skills} />
        </div>
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

function QuestionsLink({
  task,
  fullPage,
}: {
  task: TaskBrief;
  fullPage: string;
}) {
  const waiting = task.questionnaires.find((round) => round.status === "open");
  if (!waiting) return null;
  // A plain link: the drawer lives on the full page, not over this dialog.
  return (
    <a
      href={`${fullPage}?round=${waiting.round}`}
      className="bg-state-waiting-wash text-state-waiting border-state-waiting-line focus-visible:outline-pr inline-flex h-[22px] items-center gap-1 rounded-md border px-[7px] text-[11.5px] font-medium whitespace-nowrap focus-visible:outline-2"
    >
      <ChatCircleDots aria-hidden="true" weight="bold" className="size-3" />
      {questionsLabel(waiting.questions.length, true)}
    </a>
  );
}
