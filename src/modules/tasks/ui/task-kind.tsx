import { Check, Lightning } from "@phosphor-icons/react/ssr";

import type { TaskKind } from "@/modules/tasks/domain";

const KIND_WORDS: Record<TaskKind, string> = { task: "Task", epic: "Epic" };

export function kindWord(kind: TaskKind): string {
  return KIND_WORDS[kind];
}

/**
 * The violet means "epic" and nothing else: teal and rust already mean things
 * here.
 */
export function TaskKindIcon({
  kind,
  size = "sm",
}: {
  kind: TaskKind;
  size?: "sm" | "lg";
}) {
  const box =
    size === "lg" ? "size-7 rounded-[7px]" : "size-[18px] rounded-[5px]";
  const glyph = size === "lg" ? "size-[17px]" : "size-3";
  return kind === "epic" ? (
    <span
      role="img"
      aria-label="Epic"
      title="Epic"
      className={`bg-epic text-on-epic grid shrink-0 place-items-center ${box}`}
    >
      <Lightning aria-hidden="true" weight="fill" className={glyph} />
    </span>
  ) : (
    <span
      role="img"
      aria-label="Task"
      title="Task"
      className={`bg-neutral-wash text-ink-muted grid shrink-0 place-items-center ${box}`}
    >
      <Check aria-hidden="true" weight="bold" className={glyph} />
    </span>
  );
}

export function EpicTag({ title }: { title: string }) {
  return (
    <span className="text-epic-strong inline-flex min-w-0 items-center gap-1">
      <Lightning aria-hidden="true" weight="fill" className="size-2.5" />
      <span className="sr-only">In epic </span>
      <span className="truncate">{title}</span>
    </span>
  );
}

/** The same fact in words beside the pips, so colour is never the only signal. */
export function EpicProgress({
  progress,
  pips = 12,
  stacked = false,
}: {
  progress: { readonly done: number; readonly total: number };
  pips?: number;
  stacked?: boolean;
}) {
  const { done, total } = progress;
  const shown = Math.min(total, pips);
  const filled = total > pips ? Math.round((done / total) * pips) : done;
  return (
    <span
      className={
        stacked
          ? "flex flex-col items-start gap-1"
          : "inline-flex items-center gap-2"
      }
    >
      {shown > 0 ? (
        <span aria-hidden="true" className="flex gap-0.5">
          {Array.from({ length: shown }, (_, index) => (
            <i
              key={index}
              className={`h-1 w-2.5 rounded-sm ${index < filled ? "bg-epic" : "bg-hairline"}`}
            />
          ))}
        </span>
      ) : null}
      <span className="text-epic-strong font-mono text-[12px] whitespace-nowrap">
        {total === 0 ? "no tasks yet" : `${done} of ${total} done`}
      </span>
    </span>
  );
}
