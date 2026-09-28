"use client";

import { CaretDown, Check, TreeStructure } from "@phosphor-icons/react/ssr";
import { useEffect, useId, useRef, useState } from "react";

import { FLOATING_PANEL, useFloatingPanel } from "./floating-panel";

export type ParentOption = {
  /** `T-12` */
  readonly key: string;
  readonly title: string;
};

/**
 * The task this one belongs under, like an epic in Jira, picked from the
 * open tasks or none. Searchable by key or title, since a task list only
 * grows. The pick goes to the server as the `parent` field, "" for none; the
 * domain still refuses a parent that would make the two wait on each other.
 */
export function ParentSelect({
  id,
  options,
  defaultValue = "",
  exclude,
}: {
  /** For the field's `<label>`. */
  id?: string;
  options: readonly ParentOption[];
  /** A key, or "" for a top-level task. */
  defaultValue?: string;
  /** The task being edited: it cannot be its own parent. */
  exclude?: string;
}) {
  const [picked, setPicked] = useState(defaultValue.trim().toUpperCase());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { anchor, panel } = useFloatingPanel(open);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const offered = options.filter((option) => option.key !== exclude);
  // A parent that is closed, or past the list's length, stays on offer
  // rather than being dropped on the next save.
  const all: readonly ParentOption[] =
    picked && !offered.some((option) => option.key === picked)
      ? [{ key: picked, title: "" }, ...offered]
      : offered;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = all.filter((option) => {
    const haystack = `${option.key} ${option.title}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const current = all.find((option) => option.key === picked);

  function close() {
    setOpen(false);
    setQuery("");
  }
  const pick = (key: string) => {
    setPicked(key);
    close();
    anchor.current?.focus();
  };

  return (
    <div ref={root} className="flex min-w-0 flex-col">
      <input type="hidden" name="parent" value={picked} />
      <button
        ref={anchor}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          // Close the list, not the dialog around it.
          event.preventDefault();
          close();
        }}
        className="border-hairline bg-surface focus-visible:outline-pr hover:border-ink-faint flex h-[34px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-left text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        <TreeStructure
          aria-hidden="true"
          className="text-ink-faint size-[15px] shrink-0"
        />
        {current ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="text-ink shrink-0 font-mono">{current.key}</span>
            <span className="text-ink-soft min-w-0 truncate">
              {current.title}
            </span>
          </span>
        ) : (
          <span className="text-ink-muted min-w-0 flex-1 truncate">
            No parent
          </span>
        )}
        <CaretDown
          aria-hidden="true"
          className="text-ink-faint size-3 shrink-0"
        />
      </button>

      {open ? (
        <div
          ref={panel}
          id={listId}
          role="dialog"
          aria-label="Parent task"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close();
            anchor.current?.focus();
          }}
          className={`${FLOATING_PANEL} border-hairline bg-surface text-ink flex w-96 max-w-[calc(100vw-16px)] flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]`}
        >
          <label htmlFor={`${listId}-search`} className="sr-only">
            Find a task
          </label>
          {/* Not a login field: the attributes keep password managers off it. */}
          <input
            ref={search}
            id={`${listId}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              // Enter picks: never submit the form around the list.
              event.preventDefault();
              if (shown[0]) pick(shown[0].key);
            }}
            placeholder="Find a task by key or title"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mb-1 h-[30px] rounded-lg border px-2.5 text-[12.5px] focus-visible:outline-2"
          />
          <ul className="m-0 flex max-h-[260px] list-none flex-col overflow-y-auto p-0">
            {words.length > 0 ? null : (
              <Option on={!picked} onPick={() => pick("")}>
                <span className="text-ink-soft min-w-0 flex-1 truncate">
                  No parent
                </span>
              </Option>
            )}
            {shown.map((option) => (
              <Option
                key={option.key}
                on={option.key === picked}
                onPick={() => pick(option.key)}
              >
                <span className="text-ink-muted w-12 shrink-0 font-mono">
                  {option.key}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.title}</span>
              </Option>
            ))}
          </ul>
          {shown.length === 0 ? (
            <p className="text-ink-muted px-2 py-1.5 text-[12px]">
              {all.length === 0
                ? "No other open tasks to put it under."
                : "No task matches."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Option({
  on,
  onPick,
  children,
}: {
  on: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={on}
        onClick={onPick}
        className="hover:bg-surface-sunken focus-visible:outline-pr flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] focus-visible:outline-2"
      >
        <span
          aria-hidden="true"
          className="grid size-3.5 shrink-0 place-items-center"
        >
          {on ? <Check weight="bold" className="size-3" /> : null}
        </span>
        {children}
      </button>
    </li>
  );
}
