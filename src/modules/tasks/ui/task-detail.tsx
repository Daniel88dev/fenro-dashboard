import Link from "next/link";
import type { ReactNode } from "react";

import { Chip } from "@/modules/github-insights/ui/chip";
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
  type TaskActions,
} from "./task-forms";
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

const JOURNAL_WORDS: Record<JournalItem["kind"], string> = {
  note: "Note",
  decision: "Decision",
  discovery: "Discovery",
  question: "Question",
  handoff: "Handoff",
};

/** Where a person can move a task from where it is. */
function statusMoves(status: TaskBrief["status"]) {
  if (status === "done" || status === "cancelled") {
    return [{ status: "todo", label: "Reopen" }] as const;
  }
  const moves = [
    { status: "todo", label: "Move to todo" },
    { status: "backlog", label: "Move to backlog" },
    { status: "in_review", label: "Send to review" },
    { status: "done", label: "Mark done" },
    { status: "cancelled", label: "Cancel task" },
  ] as const;
  return moves.filter((move) => move.status !== status);
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-hairline bg-surface flex flex-col gap-3 rounded-xl border px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-ink text-[13.5px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Mention({ task }: { task: TaskMention }) {
  return (
    <Link
      href={taskHref(task.key)}
      className="hover:bg-surface-sunken focus-visible:outline-pr flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 focus-visible:outline-2"
    >
      <span className="text-ink-faint shrink-0 font-mono text-[12px]">
        {task.key}
      </span>
      <span className="text-ink min-w-0 flex-1 truncate text-[13px]">
        {task.title}
      </span>
      <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip>
    </Link>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-ink-muted text-[12.5px]">{children}</p>;
}

function Entry({
  entry,
  emphasis,
}: {
  entry: JournalItem;
  emphasis?: boolean;
}) {
  return (
    <li
      className={`flex flex-col gap-1 rounded-lg px-3 py-2 ${emphasis ? "bg-pr-wash" : "bg-surface-raised"}`}
    >
      <span className="text-ink-muted text-[11.5px]">
        <span
          className={`font-medium ${emphasis ? "text-pr-strong" : "text-ink-soft"}`}
        >
          {JOURNAL_WORDS[entry.kind]}
        </span>
        {" · "}
        {entry.author}
        {entry.session ? ` · session ${entry.session}` : ""}
        {" · "}
        {when(entry.recordedAt)}
      </span>
      <p className="text-ink text-[13px] leading-relaxed whitespace-pre-wrap">
        {entry.text}
      </p>
    </li>
  );
}

/**
 * One task, as a person reads it: the brief an agent gets, laid out, with the
 * same changes an agent can make. Reading comes first; editing is a click in.
 */
export function TaskDetail({
  task,
  actions,
}: {
  task: TaskBrief;
  actions: TaskActions;
}) {
  const { key } = task;
  const open = task.status !== "done" && task.status !== "cancelled";
  const blockedByLinks = task.blockedBy.map((mention) => ({
    kind: "blocked-by",
    mention,
    removable: true,
  }));
  const related = [
    ...blockedByLinks,
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
  const handoff = task.latestHandoff;
  const earlier = task.recentJournal.filter(
    (entry) =>
      !handoff ||
      entry.kind !== "handoff" ||
      entry.recordedAt !== handoff.recordedAt,
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-ink-muted text-[12.5px]">
          <Link href="/tasks" className="hover:text-ink">
            Tasks
          </Link>
          {task.parent ? (
            <>
              {" / "}
              <Link href={taskHref(task.parent.key)} className="hover:text-ink">
                {task.parent.key} {task.parent.title}
              </Link>
            </>
          ) : null}
        </nav>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-ink-faint font-mono text-[15px]">{key}</span>
          <h1 className="text-ink text-[22px] font-semibold tracking-tight">
            {task.title}
          </h1>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip>
          <span className="text-ink-muted">{STATUS_WORDS[task.status]}</span>
          {task.priority !== "none" ? (
            <span className="text-ink-muted">· {task.priority} priority</span>
          ) : null}
          {task.repository ? (
            <span className="text-ink-muted font-mono">
              · {task.repository}
            </span>
          ) : null}
          {task.labels.map((label) => (
            <Chip key={label}>{label}</Chip>
          ))}
        </p>
        {task.hold ? (
          <p className="border-issue-wash bg-issue-wash text-issue-strong rounded-lg border px-3 py-2 text-[12.5px]">
            On hold since {when(task.hold.since)}: {task.hold.reason}
          </p>
        ) : null}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <Section title="Description">
            {task.description ? (
              <p className="text-ink text-[13px] leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            ) : (
              <Empty>No description yet.</Empty>
            )}
            <EditTaskForm action={actions.update} task={task} />
          </Section>

          <Section title="Acceptance criteria">
            {task.acceptanceCriteria.length === 0 ? (
              <Empty>
                None yet. Criteria are how an agent knows it is finished.
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {task.acceptanceCriteria.map((criterion) => (
                  <li key={criterion.number}>
                    <CriterionForm
                      action={actions.checkCriterion}
                      task={key}
                      {...criterion}
                    />
                  </li>
                ))}
              </ul>
            )}
            <InlineForm
              action={actions.edit}
              task={key}
              label="Add acceptance criteria"
              name="criteria"
              placeholder="One criterion per line"
              button="Add"
              multiline
            />
          </Section>

          <Section
            title="Sub-tasks"
            action={
              open ? (
                <Link
                  href={`/tasks/new?parent=${key}`}
                  className="text-ink-muted hover:text-ink text-[12.5px]"
                >
                  Add sub-task
                </Link>
              ) : null
            }
          >
            {task.subtasks.length === 0 ? (
              <Empty>No sub-tasks.</Empty>
            ) : (
              <ul className="flex flex-col">
                {task.subtasks.map((subtask) => (
                  <li key={subtask.key} className="flex">
                    <Mention task={subtask} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Journal">
            {task.latestHandoff ? (
              <ol aria-label="Latest handoff">
                <Entry entry={task.latestHandoff} emphasis />
              </ol>
            ) : null}
            {earlier.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-ink-soft text-[12px] font-medium">
                  {task.recentJournal.length < task.journalEntries
                    ? `Latest ${task.recentJournal.length} of ${task.journalEntries} entries`
                    : "Everything recorded, oldest first"}
                </h3>
                <ol className="flex flex-col gap-1.5">
                  {earlier.map((entry, index) => (
                    <Entry key={index} entry={entry} />
                  ))}
                </ol>
              </div>
            ) : null}
            {task.journalEntries === 0 ? (
              <Empty>Nothing recorded yet.</Empty>
            ) : null}
            <NoteForm action={actions.note} task={key} />
          </Section>
        </div>

        <aside className="flex flex-col gap-5">
          <Section title="Status">
            {task.session ? (
              <p className="text-ink-muted text-[12.5px]">
                {task.session.live
                  ? `${task.session.by} is working on it (session ${task.session.number}, since ${when(task.session.startedAt)}).`
                  : `Last worked by ${task.session.by} in session ${task.session.number}, ${when(task.session.lastSeenAt)}.`}
              </p>
            ) : (
              <p className="text-ink-muted text-[12.5px]">
                No agent has worked on it yet.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {statusMoves(task.status).map((move) => (
                <ButtonForm
                  key={move.status}
                  action={actions.changeStatus}
                  task={key}
                  label={move.label}
                  values={{ status: move.status }}
                >
                  {move.label}
                </ButtonForm>
              ))}
            </div>
            {open ? (
              task.hold ? (
                <ButtonForm
                  action={actions.changeStatus}
                  task={key}
                  label="Release hold"
                  values={{ hold: "" }}
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
                  button="Put on hold"
                />
              )
            ) : null}
          </Section>

          <Section title="Links">
            {related.length === 0 ? (
              <Empty>Not linked to other tasks.</Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {related.map(({ kind, mention, removable }) => (
                  <li
                    key={`${kind}-${mention.key}`}
                    className="flex items-center gap-1"
                  >
                    <span className="text-ink-faint w-[86px] shrink-0 text-[11.5px]">
                      {kind}
                    </span>
                    <Mention task={mention} />
                    {removable ? (
                      <ButtonForm
                        action={actions.link}
                        task={key}
                        label={`Remove ${kind} ${mention.key}`}
                        values={{ kind, target: mention.key, remove: "true" }}
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
          </Section>

          <Section title="Source and references">
            {task.references.length === 0 ? (
              <Empty>No links to GitHub, Jira or elsewhere.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {task.references.map((reference) => (
                  <li key={reference.url} className="flex items-start gap-2">
                    <a
                      href={reference.url}
                      rel="noreferrer noopener"
                      target="_blank"
                      className="hover:bg-surface-sunken flex min-w-0 flex-1 flex-col rounded-md px-1.5 py-1"
                    >
                      <span className="text-ink truncate text-[12.5px]">
                        {reference.title ?? reference.key}
                      </span>
                      <span className="text-ink-faint text-[11.5px]">
                        {reference.system}
                        {reference.isSource ? " · source" : ""}
                      </span>
                    </a>
                    <ButtonForm
                      action={actions.edit}
                      task={key}
                      label={`Remove link ${reference.key}`}
                      values={{ detach: reference.url }}
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
          </Section>
        </aside>
      </div>
    </div>
  );
}
