"use client";

import {
  BookBookmark,
  CaretDown,
  Check,
  PushPin,
} from "@phosphor-icons/react/ssr";
import { useEffect, useId, useRef, useState } from "react";

import { FLOATING_PANEL, useFloatingPanel } from "./floating-panel";

export type RepositoryOption = {
  /** `owner/name` */
  readonly name: string;
  readonly pinned: boolean;
};

/**
 * Which repository a task is about, picked from the ones the person watches,
 * or none. A searchable list rather than free text, so a typo cannot point a
 * task at a repository nobody watches, and one button however many there
 * are. The pick goes to the server as the `repository` field, "" for none.
 */
export function RepositorySelect({
  id,
  options,
  defaultValue = "",
}: {
  /** For the field's `<label>`. */
  id?: string;
  /** Pinned first, as the repository table orders them. */
  options: readonly RepositoryOption[];
  /** `owner/name`, or "" for no repository. */
  defaultValue?: string;
}) {
  const [picked, setPicked] = useState(defaultValue);
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

  const same = (one: string, other: string) =>
    one.toLowerCase() === other.toLowerCase();
  // A task can already name a repository that is no longer watched, or
  // arrive with one in the URL: keep it on offer rather than drop it.
  const all: readonly RepositoryOption[] =
    picked && !options.some((option) => same(option.name, picked))
      ? [...options, { name: picked, pinned: false }]
      : options;
  const typed = query.trim().toLowerCase();
  const shown = all.filter((option) =>
    option.name.toLowerCase().includes(typed),
  );
  // Named as GitHub spells it, whatever case the URL used.
  const value = all.find((option) => same(option.name, picked))?.name ?? "";

  function close() {
    setOpen(false);
    setQuery("");
  }
  const pick = (name: string) => {
    setPicked(name);
    close();
    anchor.current?.focus();
  };

  return (
    <div ref={root} className="flex min-w-0 flex-col">
      <input type="hidden" name="repository" value={value} />
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
        <BookBookmark
          aria-hidden="true"
          className="text-ink-faint size-[15px] shrink-0"
        />
        <span
          className={`min-w-0 flex-1 truncate ${value ? "text-ink font-mono" : "text-ink-muted"}`}
        >
          {value || "No repository"}
        </span>
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
          aria-label="Repository"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close();
            anchor.current?.focus();
          }}
          className={`${FLOATING_PANEL} border-hairline bg-surface text-ink flex w-80 max-w-[calc(100vw-16px)] flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]`}
        >
          <label htmlFor={`${listId}-search`} className="sr-only">
            Find a repository
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
              if (shown[0]) pick(shown[0].name);
            }}
            placeholder="Find a repository"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mb-1 h-[30px] rounded-lg border px-2.5 text-[12.5px] focus-visible:outline-2"
          />
          <ul className="m-0 flex max-h-[240px] list-none flex-col overflow-y-auto p-0">
            {typed ? null : (
              <Option on={!value} onPick={() => pick("")}>
                <span className="text-ink-soft min-w-0 flex-1 truncate">
                  No repository
                </span>
              </Option>
            )}
            {shown.map((option) => (
              <Option
                key={option.name}
                on={same(option.name, value)}
                onPick={() => pick(option.name)}
              >
                <span className="min-w-0 flex-1 truncate font-mono">
                  {option.name}
                </span>
                {option.pinned ? (
                  <PushPin
                    aria-label="Pinned"
                    weight="fill"
                    className="text-ink-faint size-3 shrink-0"
                  />
                ) : null}
              </Option>
            ))}
          </ul>
          {shown.length === 0 ? (
            <p className="text-ink-muted px-2 py-1.5 text-[12px]">
              {all.length === 0
                ? "You watch no repositories yet. Add them on Repositories."
                : "No repository matches."}
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
