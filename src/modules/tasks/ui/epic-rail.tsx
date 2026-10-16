import { Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import type { TaskListItem } from "@/modules/tasks/application/queries/read-models";

import { EpicProgress, TaskKindIcon } from "./task-kind";

export type RailScope = {
  readonly label: string;
  readonly count: number;
  readonly href: string;
  readonly current: boolean;
};

/**
 * The epics beside the list and the board: picking one scopes both to the
 * tasks under it. Three scopes come first (everything, the epics themselves,
 * the work that belongs to none), then each open epic with how far it has
 * got. At phone width the rail turns into a row that scrolls sideways.
 */
export function EpicRail({
  scopes,
  epics,
  epicHref,
  picked,
  newEpicHref,
}: {
  scopes: readonly RailScope[];
  /** Open epics, as the list query returns them. */
  epics: readonly TaskListItem[];
  epicHref: (key: string) => string;
  /** The epic in the URL, if one is picked. */
  picked: string;
  newEpicHref: string;
}) {
  return (
    <nav
      aria-label="Epics"
      className="flex [scrollbar-width:none] gap-1 overflow-x-auto max-md:-mx-4 max-md:px-4 md:w-[264px] md:shrink-0 md:flex-col md:gap-0.5 md:overflow-visible"
    >
      <h2 className="text-ink-muted mb-1.5 px-2 text-[12px] font-medium max-md:hidden">
        Scope
      </h2>
      {scopes.map((scope) => (
        <Link
          key={scope.label}
          href={scope.href}
          scroll={false}
          aria-current={scope.current ? "page" : undefined}
          className={`${ITEM} ${scope.current ? ITEM_ON : ITEM_OFF}`}
        >
          <span className="min-w-0 flex-1 truncate">{scope.label}</span>
          <span className="text-ink-faint font-mono text-[12px] font-normal">
            {scope.count}
          </span>
        </Link>
      ))}
      <div className="bg-hairline mx-2 my-2 h-px max-md:hidden" />
      <h2 className="text-ink-muted mb-1.5 px-2 text-[12px] font-medium max-md:hidden">
        Epics
      </h2>
      {epics.map((epic) => {
        const current = epic.key === picked;
        return (
          <Link
            key={epic.key}
            href={epicHref(epic.key)}
            scroll={false}
            aria-current={current ? "page" : undefined}
            className={`${ITEM} ${current ? ITEM_ON : ITEM_OFF}`}
          >
            <TaskKindIcon kind="epic" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate">{epic.title}</span>
              {epic.progress ? (
                <span className="max-md:hidden">
                  <EpicProgress progress={epic.progress} pips={10} />
                </span>
              ) : null}
            </span>
            <span className="text-ink-faint font-mono text-[12px] font-normal max-md:hidden">
              {epic.key}
            </span>
          </Link>
        );
      })}
      {epics.length === 0 ? (
        <p className="text-ink-muted px-2 py-1 text-[12px] max-md:hidden">
          No open epics. An epic gathers the tasks of a larger piece of work.
        </p>
      ) : null}
      <Link
        href={newEpicHref}
        scroll={false}
        className="border-hairline text-ink-muted hover:text-ink hover:border-ink-faint focus-visible:outline-pr mt-1.5 flex items-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-[12.5px] focus-visible:outline-2 max-md:hidden"
      >
        <Plus aria-hidden="true" className="size-3" />
        New epic
      </Link>
    </nav>
  );
}

const ITEM =
  "focus-visible:outline-pr flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] focus-visible:outline-2 max-md:border max-md:py-1.5";
const ITEM_ON =
  "bg-surface text-ink font-medium shadow-[inset_0_0_0_1px_var(--color-hairline)] max-md:border-ink";
const ITEM_OFF =
  "text-ink-soft hover:bg-surface-sunken hover:text-ink max-md:border-hairline";
