"use client";

import { Check, FileText, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/modules/github-insights/ui/command";
import { Spinner } from "@/modules/github-insights/ui/spinner";
import type {
  TaskSearch,
  TaskSearchHit,
} from "@/modules/tasks/application/queries/read-models";
import { searchWords } from "@/modules/tasks/application/queries/search-tasks";

import { StateChip } from "./state-chip";
import { TaskKindIcon } from "./task-kind";

export type PalettePage = {
  readonly label: string;
  readonly href: string;
  readonly icon: ReactNode;
};

const NOTHING_YET: TaskSearch = {
  recent: [],
  byNumber: [],
  tasks: [],
  epics: [],
  inDescriptions: [],
  moreInDescriptions: 0,
};

const UNAVAILABLE = "Search isn't available right now.";
const PANEL_WIDTH = 540;
const EDGE = 16;

const noSubscription = () => () => {};

function useModifierKey(): string {
  return useSyncExternalStore(
    noSubscription,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+"),
    () => "⌘",
  );
}

type SearchState = {
  readonly search: TaskSearch;
  readonly loading: boolean;
  readonly failure: string | null;
};

function useTaskSearch(
  open: boolean,
  query: string,
  descriptions: boolean,
): SearchState {
  const [state, setState] = useState<SearchState>({
    search: NOTHING_YET,
    loading: false,
    failure: null,
  });

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const text = query.trim();
    const timer = setTimeout(
      async () => {
        setState((current) => ({ ...current, loading: true }));
        const params = new URLSearchParams({ q: text });
        if (descriptions) params.set("descriptions", "1");
        try {
          const response = await fetch(`/api/tasks/search?${params}`, {
            signal: controller.signal,
          });
          const body = await response.json();
          setState((current) =>
            response.ok
              ? { search: body as TaskSearch, loading: false, failure: null }
              : {
                  ...current,
                  loading: false,
                  failure: body.error ?? UNAVAILABLE,
                },
          );
        } catch {
          if (controller.signal.aborted) return;
          setState((current) => ({
            ...current,
            loading: false,
            failure: UNAVAILABLE,
          }));
        }
      },
      text ? 120 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, descriptions]);

  return state;
}

export function SearchPalette({ pages }: { pages: readonly PalettePage[] }) {
  const router = useRouter();
  const mod = useModifierKey();
  const slot = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [x, setX] = useState(0);
  const [query, setQuery] = useState("");
  const [descriptions, setDescriptions] = useState(false);
  const { search, loading, failure } = useTaskSearch(open, query, descriptions);

  function show() {
    const rect = slot.current?.getBoundingClientRect();
    const viewport = window.innerWidth;
    const half = Math.min(PANEL_WIDTH, viewport - 2 * EDGE) / 2;
    const centre = rect ? rect.left + rect.width / 2 : viewport / 2;
    setX(Math.min(Math.max(centre, half + EDGE), viewport - half - EDGE));
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setQuery("");
  }

  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k")
        return;
      event.preventDefault();
      if (dialog.current?.open) dialog.current.close();
      else showRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      element.querySelector("input")?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  const toggleDescriptions = () => setDescriptions((on) => !on);

  function go(href: string) {
    dialog.current?.close();
    router.push(href);
  }

  const words = searchWords(query);
  const digits = /^(?:t-?|#)?(\d+)$/i.exec(query.trim())?.[1];
  const shownPages = pages.filter((page) =>
    words.every((word) => page.label.toLowerCase().includes(word)),
  );
  const nothing =
    search.recent.length +
      search.byNumber.length +
      search.tasks.length +
      search.epics.length +
      search.inDescriptions.length +
      search.moreInDescriptions +
      shownPages.length ===
    0;

  const hits = (group: string, list: readonly TaskSearchHit[]) =>
    list.map((hit) => (
      <HitItem
        key={hit.key}
        value={`${group} ${hit.key}`}
        hit={hit}
        words={words}
        digits={group === "number" ? digits : undefined}
        onSelect={() => go(`/tasks/${hit.key}`)}
      />
    ));

  return (
    <div
      ref={slot}
      className="flex min-w-0 justify-end sm:flex-1 sm:justify-center"
    >
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="border-bar-line bg-bar-active text-bar-ink lg:text-bar-ink-muted hover:text-bar-ink focus-visible:outline-bar-ink flex h-9 min-w-0 cursor-pointer items-center gap-[7px] rounded-full border px-3 text-[13px] focus-visible:outline-2 lg:h-[34px] lg:w-full lg:max-w-[360px] lg:gap-2 lg:rounded-lg lg:pr-2 lg:pl-[11px]"
      >
        <MagnifyingGlass aria-hidden="true" className="size-4 shrink-0" />
        <span className="lg:hidden">Search</span>
        <span className="hidden flex-1 truncate text-left lg:inline">
          Search tasks or jump to a page
        </span>
        <kbd className="border-bar-line hidden shrink-0 rounded border px-1.5 font-mono text-[11px] lg:inline">
          {mod}K
        </kbd>
      </button>

      <dialog
        ref={dialog}
        aria-label="Search tasks and pages"
        onClose={hide}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === dialog.current) dialog.current.close();
        }}
        style={{ "--palette-x": `${x}px` } as CSSProperties}
        className="border-hairline bg-surface text-ink fixed inset-x-0 top-auto bottom-0 m-0 h-[88dvh] max-h-none w-full max-w-none overflow-hidden rounded-t-[20px] border-t p-0 shadow-[0_24px_60px_rgba(22,22,26,0.22)] backdrop:bg-[rgba(22,22,18,0.42)] sm:top-[9px] sm:right-auto sm:bottom-auto sm:left-[var(--palette-x)] sm:h-auto sm:w-[540px] sm:max-w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:rounded-xl sm:border sm:backdrop:bg-[rgba(22,22,18,0.18)]"
      >
        {open ? (
          <Command
            shouldFilter={false}
            loop
            label="Search tasks and pages"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "/") {
                event.preventDefault();
                toggleDescriptions();
              }
            }}
            className="sm:max-h-[calc(100dvh-32px)]"
          >
            <span
              aria-hidden="true"
              className="bg-hairline mx-auto mt-2 mb-0.5 h-1 w-9 shrink-0 rounded-full sm:hidden"
            />
            <div className="border-hairline-soft flex items-center gap-2.5 border-b py-1.5 pr-3 pl-4 sm:py-px sm:pr-1.5 sm:pl-[11px]">
              <MagnifyingGlass
                aria-hidden="true"
                className="text-ink-muted size-[17px] shrink-0 sm:size-[15px]"
              />
              <CommandInput
                value={query}
                onValueChange={setQuery}
                autoFocus
                placeholder="Task number, name or page"
                className="h-11 text-[16px] sm:h-8 sm:text-[13px]"
              />
              {loading ? <Spinner /> : null}
              <DescriptionsToggle
                on={descriptions}
                onToggle={toggleDescriptions}
                className="hidden h-7 pr-1.5 pl-[9px] text-[12px] sm:inline-flex"
              >
                Descriptions
                <CommandShortcut>{mod}/</CommandShortcut>
              </DescriptionsToggle>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="text-pr-strong h-11 cursor-pointer px-1 text-[15px] sm:hidden"
              >
                Cancel
              </button>
            </div>
            <div className="px-3.5 pt-2.5 pb-1 sm:hidden">
              <DescriptionsToggle
                on={descriptions}
                onToggle={toggleDescriptions}
                className="inline-flex h-[34px] px-3 text-[13px]"
              >
                Search descriptions too
              </DescriptionsToggle>
            </div>
            <CommandList className="min-h-0 flex-1 sm:max-h-[min(470px,calc(100dvh-140px))]">
              {failure ? (
                <p
                  role="alert"
                  className="text-issue-strong px-3 py-7 text-center text-[13px]"
                >
                  {failure}
                </p>
              ) : null}
              {!failure && !loading && nothing ? (
                <CommandEmpty>
                  No tasks or pages match “{query.trim()}”.
                </CommandEmpty>
              ) : null}
              {search.recent.length > 0 ? (
                <CommandGroup heading="Recent">
                  {hits("recent", search.recent)}
                </CommandGroup>
              ) : null}
              {search.byNumber.length > 0 ? (
                <CommandGroup heading="Task number">
                  {hits("number", search.byNumber)}
                </CommandGroup>
              ) : null}
              {search.tasks.length > 0 ? (
                <CommandGroup heading="Tasks">
                  {hits("task", search.tasks)}
                </CommandGroup>
              ) : null}
              {search.epics.length > 0 ? (
                <CommandGroup heading="Epics">
                  {hits("epic", search.epics)}
                </CommandGroup>
              ) : null}
              {search.inDescriptions.length > 0 ? (
                <CommandGroup heading="In descriptions">
                  {hits("description", search.inDescriptions)}
                </CommandGroup>
              ) : null}
              {shownPages.length > 0 ? (
                <CommandGroup heading="Go to">
                  {shownPages.map((page) => (
                    <CommandItem
                      key={page.href}
                      value={`page ${page.href}`}
                      onSelect={() => go(page.href)}
                    >
                      <span className="text-ink-soft grid w-[18px] place-items-center [&_svg]:size-4">
                        {page.icon}
                      </span>
                      <span className="flex-1 truncate">
                        <Highlight text={page.label} words={words} />
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {search.moreInDescriptions > 0 && !descriptions ? (
                <CommandGroup>
                  <CommandItem
                    value="descriptions more"
                    onSelect={toggleDescriptions}
                    className="text-pr-strong"
                  >
                    <FileText aria-hidden="true" className="w-[18px]" />
                    <span className="flex-1 truncate">
                      {search.moreInDescriptions}{" "}
                      {search.moreInDescriptions === 1
                        ? "more match"
                        : "more matches"}{" "}
                      in descriptions
                    </span>
                    <CommandShortcut className="hidden sm:inline">
                      {mod}/
                    </CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
            <div className="border-hairline-soft bg-surface-raised text-ink-muted hidden items-center justify-end gap-3 border-t px-3 py-1.5 text-[11.5px] sm:flex">
              <span>
                <kbd className="font-mono">↑↓</kbd> move
              </span>
              <span>
                <kbd className="font-mono">↵</kbd> open
              </span>
              <span>
                <kbd className="font-mono">esc</kbd> close
              </span>
            </div>
          </Command>
        ) : null}
      </dialog>
    </div>
  );
}

function DescriptionsToggle({
  on,
  onToggle,
  className,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  className: string;
  children: ReactNode;
}) {
  const Icon = on ? Check : FileText;
  return (
    <button
      type="button"
      aria-pressed={on}
      title="Also search task descriptions"
      onClick={onToggle}
      className={`focus-visible:outline-pr shrink-0 cursor-pointer items-center gap-1.5 rounded-full border focus-visible:outline-2 ${
        on
          ? "border-pr bg-pr-wash text-pr-strong"
          : "border-hairline text-ink-soft hover:bg-surface-sunken"
      } ${className}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {children}
    </button>
  );
}

function HitItem({
  value,
  hit,
  words,
  digits,
  onSelect,
}: {
  value: string;
  hit: TaskSearchHit;
  words: readonly string[];
  digits?: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem value={value} onSelect={onSelect}>
      <TaskKindIcon kind={hit.kind} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-[7px]">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-ink-muted shrink-0 font-mono text-[12px]">
            {digits && hit.key.startsWith(`T-${digits}`) ? (
              <>
                T-<Mark>{digits}</Mark>
                {hit.key.slice(2 + digits.length)}
              </>
            ) : (
              hit.key
            )}
          </span>
          <span
            className={`truncate ${hit.state === "cancelled" ? "text-ink-muted line-through" : ""}`}
          >
            <Highlight text={hit.title} words={words} />
          </span>
        </span>
        {hit.excerpt ? (
          <span className="text-ink-muted line-clamp-2 text-[12px] leading-snug sm:line-clamp-1">
            <Highlight text={hit.excerpt} words={words} />
          </span>
        ) : null}
      </span>
      {hit.kind === "epic" && hit.progress ? (
        <span className="bg-epic-wash text-epic-strong shrink-0 rounded-md px-[7px] py-px text-[11px] font-medium whitespace-nowrap">
          {hit.progress.done} of {hit.progress.total} done
        </span>
      ) : (
        <StateChip state={hit.state} />
      )}
    </CommandItem>
  );
}

function Highlight({
  text,
  words,
}: {
  text: string;
  words: readonly string[];
}) {
  if (words.length === 0) return text;
  const pattern = new RegExp(
    `(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  return text
    .split(pattern)
    .map((part, position) =>
      position % 2 === 1 ? <Mark key={position}>{part}</Mark> : part,
    );
}

function Mark({ children }: { children: ReactNode }) {
  return (
    <mark className="bg-state-running-wash text-ink rounded-[3px]">
      {children}
    </mark>
  );
}
