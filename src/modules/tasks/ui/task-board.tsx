"use client";

import { DotsThree, Check, Warning, X } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  type DragEvent,
} from "react";

import { Chip } from "@/modules/github-insights/ui/chip";
import type {
  BoardColumn,
  TaskListItem,
} from "@/modules/tasks/application/queries/read-models";
import type { TaskStatus } from "@/modules/tasks/domain";

import { colourOf, LabelDot, type LabelOption } from "./labels";
import { EpicProgress, EpicTag, TaskKindIcon } from "./task-kind";
import { STATE_TONES, taskHref } from "./task-state";

export type MoveTask = (
  task: string,
  status: TaskStatus,
) => Promise<{ readonly error: string | null }>;

export const COLUMN_WORDS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_WORDS: Record<TaskListItem["priority"], string | null> = {
  none: null,
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** States worth a chip on a card: the column already says the rest. */
const CHIP_STATES = new Set(["blocked", "waiting", "paused"]);

type Move = { readonly key: string; readonly to: TaskStatus };

function moved(columns: readonly BoardColumn[], move: Move): BoardColumn[] {
  const card = columns
    .flatMap((column) => column.tasks)
    .find((task) => task.key === move.key);
  if (!card) return [...columns];
  return columns.map((column) => {
    if (column.status === move.to) {
      return {
        ...column,
        total: column.total + 1,
        tasks: [{ ...card, status: move.to }, ...column.tasks],
      };
    }
    if (column.tasks.some((task) => task.key === move.key)) {
      return {
        ...column,
        total: column.total - 1,
        tasks: column.tasks.filter((task) => task.key !== move.key),
      };
    }
    return column;
  });
}

export function TaskBoard({
  columns,
  labels,
  move,
}: {
  columns: readonly BoardColumn[];
  labels: readonly LabelOption[];
  move: MoveTask;
}) {
  const [shown, moveOptimistically] = useOptimistic(columns, moved);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const moveTo = (key: string, to: TaskStatus) => {
    const from = shown
      .flatMap((column) => column.tasks)
      .find((task) => task.key === key)?.status;
    setDragging(null);
    setOver(null);
    if (!from || from === to) return;
    setNotice(null);
    startTransition(async () => {
      moveOptimistically({ key, to });
      const outcome = await move(key, to);
      if (outcome.error) setNotice(outcome.error);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {notice ? (
        <div
          role="alert"
          className="bg-issue-wash text-issue-strong flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] leading-[1.45]"
        >
          <Warning aria-hidden="true" className="mt-px size-[15px] shrink-0" />
          <p className="m-0 flex-1">{notice}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
            className="focus-visible:outline-pr cursor-pointer rounded-md p-0.5 focus-visible:outline-2"
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </div>
      ) : null}
      <div className="-mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[84%] grid-flow-col gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:snap-none sm:auto-cols-[minmax(220px,1fr)] sm:px-0">
        {shown.map((column) => (
          <section
            key={column.status}
            aria-label={COLUMN_WORDS[column.status]}
            onDragOver={(event) => {
              if (!dragging) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (over !== column.status) setOver(column.status);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setOver(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const key = event.dataTransfer.getData("text/plain") || dragging;
              if (key) moveTo(key, column.status);
            }}
            className={`flex min-h-[420px] snap-start flex-col gap-2 rounded-xl p-2 outline-2 -outline-offset-2 motion-safe:transition-colors ${
              over === column.status && dragging
                ? "bg-surface-raised outline-ink-faint outline-dashed"
                : "bg-surface-sunken outline-transparent"
            }`}
          >
            <h2 className="flex items-baseline gap-2 px-1.5 pt-1 pb-0.5">
              <span className="text-ink text-[13px] font-semibold">
                {COLUMN_WORDS[column.status]}
              </span>
              <span className="text-ink-faint font-mono text-[12px]">
                {column.total}
              </span>
            </h2>
            {column.tasks.length === 0 ? (
              <p className="border-hairline text-ink-faint rounded-lg border border-dashed px-2.5 py-3.5 text-center text-[12px]">
                Drop a task here
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {column.tasks.map((task) => (
                  <li key={task.key}>
                    <BoardCard
                      task={task}
                      labels={labels}
                      dragging={dragging === task.key}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", task.key);
                        setDragging(task.key);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onMove={(to) => moveTo(task.key, to)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {column.total > column.tasks.length ? (
              <p className="text-ink-muted px-1.5 text-[12px]">
                {`and ${column.total - column.tasks.length} more; narrow the board to see them`}
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

const MOVE_TARGETS: readonly TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
];

function BoardCard({
  task,
  labels,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  task: TaskListItem;
  labels: readonly LabelOption[];
  dragging: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onMove: (to: TaskStatus) => void;
}) {
  const priority = PRIORITY_WORDS[task.priority];
  const epic = task.kind === "epic";
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label={`${epic ? "Epic" : "Task"} ${task.key}: ${task.title}`}
      className={`bg-surface relative flex cursor-grab flex-col gap-2 rounded-lg border px-3 py-2.5 active:cursor-grabbing motion-safe:transition-[box-shadow,opacity] motion-safe:hover:shadow-[0_6px_16px_-10px_rgba(20,18,10,0.35)] ${
        epic ? "border-epic-line" : "border-hairline"
      } ${dragging ? "opacity-45" : ""}`}
    >
      <div className="flex items-center gap-2">
        <TaskKindIcon kind={task.kind} />
        <span className="text-ink-faint font-mono text-[12px]">{task.key}</span>
        {priority ? (
          <span className="text-ink-muted ml-auto text-[12px]">{priority}</span>
        ) : null}
        <MoveMenu
          task={task}
          className={priority ? "" : "ml-auto"}
          onMove={onMove}
        />
      </div>
      <Link
        href={taskHref(task.key)}
        scroll={false}
        draggable={false}
        className="text-ink focus-visible:outline-pr rounded-sm text-[13.5px] leading-[1.35] hover:underline hover:underline-offset-2 focus-visible:outline-2"
      >
        {task.title}
      </Link>
      <CardFacts task={task} labels={labels} />
    </article>
  );
}

function CardFacts({
  task,
  labels,
}: {
  task: TaskListItem;
  labels: readonly LabelOption[];
}) {
  const chip = CHIP_STATES.has(task.state);
  if (
    !task.progress &&
    !task.epic &&
    task.labels.length === 0 &&
    !task.workedOnBy &&
    !chip
  ) {
    return null;
  }
  return (
    <div className="text-ink-muted flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px]">
      {task.progress ? <EpicProgress progress={task.progress} /> : null}
      {task.epic ? <EpicTag title={task.epic.title} /> : null}
      {task.labels.map((name) => (
        <span key={name} className="inline-flex items-center gap-1.5">
          <LabelDot colour={colourOf(labels, name)} />
          {name}
        </span>
      ))}
      {task.workedOnBy ? (
        <span className="text-ink-soft inline-flex items-center gap-1.5 font-mono">
          <span
            aria-hidden="true"
            className="bg-pr ring-pr-wash size-[7px] shrink-0 rounded-full ring-[3px]"
          />
          {task.workedOnBy}
        </span>
      ) : null}
      {chip ? <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip> : null}
    </div>
  );
}

/** The way to move a card on touch screens and from the keyboard. */
function MoveMenu({
  task,
  className,
  onMove,
}: {
  task: TaskListItem;
  className: string;
  onMove: (to: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>("[role=menuitemradio]")
      ?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={root} className={`relative -mr-1.5 ${className}`}>
      <button
        type="button"
        aria-label={`Move ${task.key}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        className="text-ink-faint hover:bg-surface-sunken hover:text-ink focus-visible:outline-pr grid size-6 cursor-pointer place-items-center rounded-md focus-visible:outline-2"
      >
        <DotsThree aria-hidden="true" weight="bold" className="size-4" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`Move ${task.key} to`}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setOpen(false);
            root.current?.querySelector<HTMLButtonElement>("button")?.focus();
          }}
          className="border-hairline bg-surface absolute top-full right-0 z-30 mt-1 flex w-48 flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]"
        >
          <p className="text-ink-muted m-0 px-2 pt-0.5 pb-1 text-[12px]">
            Move to
          </p>
          {MOVE_TARGETS.map((status) => (
            <button
              key={status}
              type="button"
              role="menuitemradio"
              aria-checked={status === task.status}
              onClick={() => {
                setOpen(false);
                onMove(status);
              }}
              className="text-ink hover:bg-surface-sunken focus-visible:outline-pr flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] focus-visible:outline-2"
            >
              <span
                aria-hidden="true"
                className="grid size-3.5 shrink-0 place-items-center"
              >
                {status === task.status ? (
                  <Check weight="bold" className="size-3" />
                ) : null}
              </span>
              {COLUMN_WORDS[status]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
