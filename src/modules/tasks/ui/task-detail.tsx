import {
  CaretRight,
  Check,
  CheckCircle,
  DotsThree,
  MagnifyingGlass,
  Plus,
  Robot,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Chip } from "@/modules/github-insights/ui/chip";
import { Menu } from "@/modules/github-insights/ui/menu";
import type {
  JournalItem,
  TaskBrief,
  TaskMention,
} from "@/modules/tasks/application/queries/read-models";

import {
  ButtonForm,
  CriterionForm,
  EditTaskForm,
  InlineForm,
  NoteForm,
  TaskLabelsForm,
  type TaskActions,
} from "./task-forms";
import { LabelChips, type LabelOption } from "./labels";
import type { RepositoryOption } from "./repository-select";
import { LiveDot } from "./task-list";
import { InlineMarkdown, Markdown } from "./markdown";
import { STATE_TONES, taskHref } from "./task-state";

const DATE = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const when = (iso: string) => `${DATE.format(new Date(iso))} UTC`;

const STATUS_WORDS: Record<TaskBrief["status"], string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_WORDS: Record<TaskBrief["priority"], string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const JOURNAL: Record<JournalItem["kind"], { word: string; icon: Icon }> = {
  note: { word: "Note", icon: UserCircle },
  decision: { word: "Decision", icon: CheckCircle },
  discovery: { word: "Discovery", icon: MagnifyingGlass },
  question: { word: "Question", icon: WarningCircle },
  handoff: { word: "Handoff", icon: Robot },
};

function isOpen(task: TaskBrief): boolean {
  return task.status !== "done" && task.status !== "cancelled";
}

/**
 * The chips under a task's title: state, priority, repository, labels. With
 * actions, the labels can be changed right there.
 */
export function TaskChips({
  task,
  labels = [],
  actions,
}: {
  task: TaskBrief;
  /** The owner's labels: their colours, and what the picker offers. */
  labels?: readonly LabelOption[];
  actions?: TaskActions;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip>
      {task.priority !== "none" ? (
        <Chip>{`${PRIORITY_WORDS[task.priority]} priority`}</Chip>
      ) : null}
      {task.repository ? (
        <Chip>
          <span className="font-mono">{task.repository}</span>
        </Chip>
      ) : null}
      {actions ? (
        <TaskLabelsForm
          action={actions.labels}
          task={task.key}
          labels={task.labels}
          catalogue={labels}
        />
      ) : (
        <LabelChips names={task.labels} catalogue={labels} />
      )}
    </div>
  );
}

/** Who has the task right now, if anyone. */
export function AgentLine({ task }: { task: TaskBrief }) {
  const session = task.session;
  if (!session) {
    return (
      <p className="text-ink-muted text-[12.5px]">
        No agent has worked on it yet.
      </p>
    );
  }
  return session.live ? (
    <p className="text-ink-soft flex items-center gap-2 text-[12.5px]">
      <LiveDot />
      <span>
        <span className="font-mono">{session.by}</span> is on it, session{" "}
        {session.number}, since {when(session.startedAt)}
      </span>
    </p>
  ) : (
    <p className="text-ink-muted text-[12.5px]">
      Last worked by <span className="font-mono">{session.by}</span> in session{" "}
      {session.number}, {when(session.lastSeenAt)}
    </p>
  );
}

/**
 * The status changes, weighted: one primary, one secondary, the rest in a
 * menu. A closed task only reopens.
 */
export function StatusActions({
  task,
  actions,
  menuOpensUp = false,
}: {
  task: TaskBrief;
  actions: TaskActions;
  menuOpensUp?: boolean;
}) {
  const { key } = task;
  if (!isOpen(task)) {
    return (
      <ButtonForm
        action={actions.changeStatus}
        task={key}
        label="Reopen"
        values={{ status: "todo" }}
        tone="primary"
      >
        Reopen
      </ButtonForm>
    );
  }

  const more = [
    { status: "todo", label: "Move to todo" },
    { status: "backlog", label: "Move to backlog" },
    { status: "cancelled", label: "Cancel task" },
  ].filter((move) => move.status !== task.status);

  return (
    <div className="flex flex-wrap items-start gap-2">
      {task.status !== "in_review" ? (
        <ButtonForm
          action={actions.changeStatus}
          task={key}
          label="Send to review"
          values={{ status: "in_review" }}
        >
          Send to review
        </ButtonForm>
      ) : null}
      <ButtonForm
        action={actions.changeStatus}
        task={key}
        label="Mark done"
        values={{ status: "done" }}
        tone="primary"
      >
        <Check aria-hidden="true" weight="bold" className="size-3.5" />
        Mark done
      </ButtonForm>
      <Menu
        label="More actions"
        triggerClassName="border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr grid size-[34px] place-items-center rounded-lg border"
        trigger={
          <DotsThree aria-hidden="true" weight="bold" className="size-4" />
        }
        panelClassName="w-64 gap-1"
        opensUp={menuOpensUp}
      >
        {more.map((move) => (
          <ButtonForm
            key={move.status}
            action={actions.changeStatus}
            task={key}
            label={move.label}
            values={{ status: move.status }}
            tone="menu"
          >
            {move.label}
          </ButtonForm>
        ))}
        <div className="border-hairline-soft mt-1 border-t px-1 pt-2 pb-1">
          {task.hold ? (
            <ButtonForm
              action={actions.changeStatus}
              task={key}
              label="Release hold"
              values={{ hold: "" }}
              tone="menu"
            >
              Release hold
            </ButtonForm>
          ) : (
            <InlineForm
              action={actions.changeStatus}
              task={key}
              label="Put on hold"
              name="hold"
              placeholder="Waiting on…"
              button="Hold"
            />
          )}
        </div>
      </Menu>
    </div>
  );
}

/** What the last session left for the next one. It leads the page. */
export function HandoffCard({ entry }: { entry: JournalItem | null }) {
  if (!entry) return null;
  return (
    <ol aria-label="Latest handoff" className="m-0 list-none p-0">
      <li className="bg-pr-wash flex flex-col gap-1.5 rounded-xl px-4 py-3.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
          <span className="text-pr-strong flex items-center gap-1.5 font-semibold">
            <Robot aria-hidden="true" className="size-[15px]" />
            Latest handoff
          </span>
          <span className="text-ink-soft">
            <span className="font-mono">{entry.author}</span>
            {entry.session ? `, session ${entry.session}` : ""},{" "}
            {when(entry.recordedAt)}
          </span>
        </span>
        <Markdown className="text-ink text-[14px] leading-relaxed">
          {entry.text}
        </Markdown>
      </li>
    </ol>
  );
}

function SectionHeading({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-ink text-[15px] font-semibold tracking-tight">
        {title}
      </h2>
      {aside}
    </div>
  );
}

/** A section of the task, separated from the one above by a hairline. */
function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-hairline flex flex-col gap-3 border-t pt-5 first:border-t-0 first:pt-0">
      <SectionHeading title={title} aside={aside} />
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-ink-muted text-[13px]">{children}</p>;
}

export function CriteriaList({
  task,
  actions,
  addable = true,
}: {
  task: TaskBrief;
  actions: TaskActions;
  addable?: boolean;
}) {
  const met = task.acceptanceCriteria.filter((criterion) => criterion.met);
  return (
    <Section
      title="Acceptance criteria"
      aside={
        task.acceptanceCriteria.length > 0 ? (
          <span className="text-ink-muted text-[12px]">
            {`${met.length} of ${task.acceptanceCriteria.length} met`}
          </span>
        ) : null
      }
    >
      {task.acceptanceCriteria.length === 0 ? (
        <Empty>None yet. Criteria are how an agent knows it is finished.</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {task.acceptanceCriteria.map((criterion) => (
            <li key={criterion.number}>
              <CriterionForm
                action={actions.checkCriterion}
                task={task.key}
                number={criterion.number}
                met={criterion.met}
                text={<InlineMarkdown>{criterion.text}</InlineMarkdown>}
                evidence={
                  criterion.evidence ? (
                    <InlineMarkdown>{criterion.evidence}</InlineMarkdown>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}
      {addable ? (
        <InlineForm
          action={actions.edit}
          task={task.key}
          label="Add acceptance criteria"
          name="criteria"
          placeholder="Add a criterion, one per line"
          button="Add"
          multiline
        />
      ) : null}
    </Section>
  );
}

function JournalEntry({ entry }: { entry: JournalItem }) {
  const { word, icon: KindIcon } = JOURNAL[entry.kind];
  return (
    <li className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 pb-[18px] before:absolute before:top-[22px] before:bottom-0 before:left-[9.5px] before:w-px before:bg-[var(--color-hairline)] last:before:hidden">
      <span className="border-hairline bg-surface text-ink-muted grid size-5 place-items-center rounded-full border">
        <KindIcon aria-hidden="true" className="size-3" />
      </span>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-ink-muted text-[12px]">
          <span className="text-ink-soft font-semibold">{word}</span>{" "}
          <span className="font-mono">{entry.author}</span>
          {entry.session ? `, session ${entry.session}` : ""},{" "}
          {when(entry.recordedAt)}
        </span>
        <Markdown className="text-ink text-[13px] leading-relaxed">
          {entry.text}
        </Markdown>
      </div>
    </li>
  );
}

/** The journal after the handoff, oldest first, and a way to add to it. */
export function JournalSection({
  task,
  actions,
  limit,
  moreHref,
}: {
  task: TaskBrief;
  actions: TaskActions;
  /** Show only the newest few, as the dialog does. */
  limit?: number;
  moreHref?: string;
}) {
  const handoff = task.latestHandoff;
  const earlier = task.recentJournal.filter(
    (entry) =>
      !handoff ||
      entry.kind !== "handoff" ||
      entry.recordedAt !== handoff.recordedAt,
  );
  const shown = limit ? earlier.slice(-limit) : earlier;
  // The page reads a capped journal; say so only when the cap cut something.
  const note =
    !moreHref && task.recentJournal.length < task.journalEntries
      ? `Latest ${task.recentJournal.length} of ${task.journalEntries} entries`
      : null;

  return (
    <Section
      title="Journal"
      aside={
        moreHref && task.journalEntries > shown.length ? (
          <Link
            href={moreHref}
            className="text-ink-muted hover:text-ink text-[12px]"
          >
            {`All ${task.journalEntries} entries`}
          </Link>
        ) : note ? (
          <span className="text-ink-muted text-[12px]">{note}</span>
        ) : null
      }
    >
      {shown.length > 0 ? (
        <ol className="m-0 list-none p-0">
          {shown.map((entry, index) => (
            <JournalEntry key={index} entry={entry} />
          ))}
        </ol>
      ) : task.journalEntries === 0 ? (
        <Empty>Nothing recorded yet.</Empty>
      ) : null}
      <NoteForm action={actions.note} task={task.key} />
    </Section>
  );
}

function MentionLink({ task }: { task: TaskMention }) {
  return (
    <Link
      href={taskHref(task.key)}
      className="hover:bg-surface-sunken focus-visible:outline-pr -mx-1.5 flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 focus-visible:outline-2"
      title={task.title}
    >
      <span className="text-ink font-mono text-[12.5px]">{task.key}</span>
      <span className="text-ink-soft min-w-0 flex-1 truncate text-[12.5px]">
        {task.title}
      </span>
      <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip>
    </Link>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-hairline-soft grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-2.5 border-t py-2.5 text-[12.5px] first:border-t-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink m-0 flex min-w-0 flex-col gap-1">{children}</dd>
    </div>
  );
}

/** The side list of facts about a task, one per line. */
export function TaskProperties({ task }: { task: TaskBrief }) {
  const source = task.references.find((reference) => reference.isSource);
  return (
    <dl className="m-0 flex flex-col">
      <Property label="Status">{STATUS_WORDS[task.status]}</Property>
      <Property label="Priority">{PRIORITY_WORDS[task.priority]}</Property>
      {task.repository ? (
        <Property label="Repository">
          <span className="truncate font-mono">{task.repository}</span>
        </Property>
      ) : null}
      {task.parent ? (
        <Property label="Sub-task of">
          <MentionLink task={task.parent} />
        </Property>
      ) : null}
      {task.blockedBy.length > 0 ? (
        <Property label="Blocked by">
          {task.blockedBy.map((mention) => (
            <MentionLink key={mention.key} task={mention} />
          ))}
        </Property>
      ) : null}
      {task.blocks.length > 0 ? (
        <Property label="Blocks">
          {task.blocks.map((mention) => (
            <MentionLink key={mention.key} task={mention} />
          ))}
        </Property>
      ) : null}
      {task.relatesTo.length > 0 ? (
        <Property label="Relates to">
          {task.relatesTo.map((mention) => (
            <MentionLink key={mention.key} task={mention} />
          ))}
        </Property>
      ) : null}
      {source ? (
        <Property label="Source">
          <a
            href={source.url}
            rel="noreferrer noopener"
            target="_blank"
            className="hover:text-pr-strong flex min-w-0 flex-col"
          >
            <span className="truncate">{source.title ?? source.key}</span>
            <span className="text-ink-muted font-mono text-[11.5px]">
              {`${source.system} ${source.key}`}
            </span>
          </a>
        </Property>
      ) : null}
      {task.subtasks.length > 0 ? (
        <Property label="Sub-tasks">
          {task.subtasks.map((mention) => (
            <MentionLink key={mention.key} task={mention} />
          ))}
        </Property>
      ) : null}
    </dl>
  );
}

export function HoldNotice({ task }: { task: TaskBrief }) {
  if (!task.hold) return null;
  return (
    <p className="bg-issue-wash text-issue-strong rounded-xl px-3.5 py-2.5 text-[12.5px]">
      On hold since {when(task.hold.since)}: {task.hold.reason}
    </p>
  );
}

/**
 * One task, as a person reads it: the handoff an agent left first, then what
 * the task asks, then the journal. Facts sit in a side list; the rarer edits
 * (links, references) sit under it.
 */
export function TaskDetail({
  task,
  actions,
  labels = [],
  repositories = [],
}: {
  task: TaskBrief;
  actions: TaskActions;
  /** The owner's labels. */
  labels?: readonly LabelOption[];
  /** The repositories the owner watches, for "Edit details". */
  repositories?: readonly RepositoryOption[];
}) {
  const { key } = task;
  const open = isOpen(task);
  const links = [
    ...task.blockedBy.map((mention) => ({
      kind: "blocked-by",
      mention,
      removable: true,
    })),
    ...task.blocks.map((mention) => ({
      kind: "blocks",
      mention,
      removable: false,
    })),
    ...task.relatesTo.map((mention) => ({
      kind: "relates-to",
      mention,
      removable: true,
    })),
    ...(task.discoveredFrom
      ? [
          {
            kind: "discovered-from",
            mention: task.discoveredFrom,
            removable: true,
          },
        ]
      : []),
    ...task.discovered.map((mention) => ({
      kind: "found here",
      mention,
      removable: false,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <nav
          aria-label="Breadcrumb"
          className="text-ink-muted flex flex-wrap items-center gap-1.5 text-[12.5px]"
        >
          <Link href="/tasks" className="hover:text-ink">
            Tasks
          </Link>
          {task.parent ? (
            <>
              <CaretRight aria-hidden="true" className="size-[11px]" />
              <Link href={taskHref(task.parent.key)} className="hover:text-ink">
                <span className="font-mono">{task.parent.key}</span>{" "}
                {task.parent.title}
              </Link>
            </>
          ) : null}
          <CaretRight aria-hidden="true" className="size-[11px]" />
          <span className="font-mono">{key}</span>
        </nav>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="text-ink text-[24px] leading-tight font-semibold tracking-tight">
              <span className="text-ink-faint mr-2.5 font-mono font-medium">
                {key}
              </span>
              {task.title}
            </h1>
            <TaskChips task={task} labels={labels} actions={actions} />
          </div>
          <StatusActions task={task} actions={actions} />
        </div>
        <HoldNotice task={task} />
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <HandoffCard entry={task.latestHandoff} />

          <div className="flex flex-col gap-6">
            <Section title="Description">
              {task.description ? (
                <Markdown className="text-ink max-w-[72ch] text-[13.5px] leading-relaxed">
                  {task.description}
                </Markdown>
              ) : (
                <Empty>No description yet.</Empty>
              )}
              <EditTaskForm
                action={actions.update}
                task={task}
                repositories={repositories}
              />
            </Section>

            <CriteriaList task={task} actions={actions} />

            <Section
              title="Sub-tasks"
              aside={
                open ? (
                  <Link
                    href={`/tasks/new?parent=${key}`}
                    className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium focus-visible:outline-2"
                  >
                    <Plus aria-hidden="true" className="size-[13px]" />
                    Add sub-task
                  </Link>
                ) : null
              }
            >
              {task.subtasks.length === 0 ? (
                <Empty>No sub-tasks.</Empty>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {task.subtasks.map((subtask) => (
                    <li key={subtask.key}>
                      <MentionLink task={subtask} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <JournalSection task={task} actions={actions} />
          </div>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-ink text-[13px] font-semibold">Agent</h2>
            <AgentLine task={task} />
          </div>

          <div className="border-hairline border-t pt-1.5">
            <TaskProperties task={task} />
          </div>

          <div className="border-hairline flex flex-col gap-3 border-t pt-4">
            <h2 className="text-ink text-[13px] font-semibold">Links</h2>
            {links.length === 0 ? (
              <Empty>Not linked to other tasks.</Empty>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {links.map(({ kind, mention, removable }) => (
                  <li
                    key={`${kind}-${mention.key}`}
                    className="flex items-center gap-2"
                  >
                    <span className="text-ink-muted w-[92px] shrink-0 text-[12px]">
                      {kind}
                    </span>
                    <div className="min-w-0 flex-1">
                      <MentionLink task={mention} />
                    </div>
                    {removable ? (
                      <ButtonForm
                        action={actions.link}
                        task={key}
                        label={`Remove ${kind} ${mention.key}`}
                        values={{ kind, target: mention.key, remove: "true" }}
                        tone="link"
                      >
                        Remove
                      </ButtonForm>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <InlineForm
              action={actions.link}
              task={key}
              label="Add a blocking task"
              name="target"
              placeholder="Blocked by, e.g. T-3"
              button="Link"
              hidden={{ kind: "blocked-by" }}
            />
          </div>

          <div className="border-hairline flex flex-col gap-3 border-t pt-4">
            <h2 className="text-ink text-[13px] font-semibold">
              Source and references
            </h2>
            {task.references.length === 0 ? (
              <Empty>No links to GitHub, Jira or elsewhere.</Empty>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {task.references.map((reference) => (
                  <li key={reference.url} className="flex items-start gap-2">
                    <a
                      href={reference.url}
                      rel="noreferrer noopener"
                      target="_blank"
                      className="hover:bg-surface-sunken -mx-1.5 flex min-w-0 flex-1 flex-col rounded-md px-1.5 py-1"
                    >
                      <span className="text-ink truncate text-[12.5px]">
                        {reference.title ?? reference.key}
                      </span>
                      <span className="text-ink-muted text-[11.5px]">
                        {reference.isSource
                          ? `${reference.system}, the source`
                          : reference.system}
                      </span>
                    </a>
                    <ButtonForm
                      action={actions.edit}
                      task={key}
                      label={`Remove link ${reference.key}`}
                      values={{ detach: reference.url }}
                      tone="link"
                    >
                      Remove
                    </ButtonForm>
                  </li>
                ))}
              </ul>
            )}
            <InlineForm
              action={actions.edit}
              task={key}
              label="Attach a link"
              name="attach"
              placeholder="https://…"
              button="Attach"
              extra={
                <label className="text-ink-soft flex h-[30px] items-center gap-1.5 text-[12px]">
                  <input
                    type="checkbox"
                    name="isSource"
                    className="accent-pr"
                  />
                  Source
                </label>
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
