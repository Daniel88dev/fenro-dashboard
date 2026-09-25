"use client";

import { BookBookmark, CaretDown, Check } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export type RepositoryFilterOption = {
  /** `owner/name` */
  readonly name: string;
  readonly openTasks: number;
  /** The list filtered to this repository, the rest of the filter kept. */
  readonly href: string;
};

/**
 * One repository at a time, picked from a list that can be searched, so the
 * control stays one button however many repositories the tasks name. The
 * pick is a link: it lives in the URL like the view, labels and search.
 */
export function RepositoryFilter({
  options,
  picked,
  allHref,
}: {
  /** Busiest first. */
  options: readonly RepositoryFilterOption[];
  /** The repository in the URL, or "" for all of them. */
  picked: string;
  /** The list with no repository picked. */
  allHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const typed = query.trim().toLowerCase();
  const shown = options.filter((option) =>
    option.name.toLowerCase().includes(typed),
  );
  const isPicked = (name: string) =>
    name.toLowerCase() === picked.toLowerCase();
  // Named as the tasks spell it, whatever case the URL used.
  const label = picked
    ? (options.find((option) => isPicked(option.name))?.name ?? picked)
    : "All repositories";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Repository: ${label}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className={`focus-visible:outline-pr inline-flex h-[34px] max-w-full cursor-pointer items-center gap-2 rounded-lg border px-[11px] text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-1 md:max-w-[280px] ${
          picked
            ? "border-ink text-ink bg-surface"
            : "border-hairline bg-surface text-ink-soft hover:text-ink hover:border-ink-faint"
        }`}
      >
        <BookBookmark
          aria-hidden="true"
          className="text-ink-faint size-[15px] shrink-0"
        />
        <span className={`truncate ${picked ? "font-mono" : ""}`}>{label}</span>
        <CaretDown
          aria-hidden="true"
          className="text-ink-faint size-3 shrink-0"
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="dialog"
          aria-label="Filter by repository"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            close();
            root.current?.querySelector<HTMLButtonElement>("button")?.focus();
          }}
          className="border-hairline bg-surface text-ink absolute top-full left-0 z-30 mt-1.5 flex w-80 max-w-[calc(100vw-32px)] flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)] md:right-0 md:left-auto"
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
              event.preventDefault();
              if (!shown[0]) return;
              close();
              router.push(shown[0].href, { scroll: false });
            }}
            placeholder="Find a repository"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mb-1 h-[30px] rounded-lg border px-2.5 text-[12.5px] focus-visible:outline-2"
          />
          <ul className="m-0 flex max-h-[280px] list-none flex-col overflow-y-auto p-0">
            {typed ? null : (
              <li>
                <Option href={allHref} on={!picked} onPick={close}>
                  <span className="min-w-0 flex-1 truncate">
                    All repositories
                  </span>
                </Option>
              </li>
            )}
            {shown.map((option) => (
              <li key={option.name}>
                <Option
                  href={option.href}
                  on={isPicked(option.name)}
                  onPick={close}
                >
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {option.name}
                  </span>
                  <span className="text-ink-faint shrink-0 font-mono text-[12px]">
                    {option.openTasks}
                  </span>
                </Option>
              </li>
            ))}
          </ul>
          {shown.length === 0 ? (
            <p className="text-ink-muted px-2 py-1.5 text-[12px]">
              {options.length === 0
                ? "No task names a repository yet."
                : "No repository matches."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Option({
  href,
  on,
  onPick,
  children,
}: {
  href: string;
  on: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      onClick={onPick}
      className="hover:bg-surface-sunken focus-visible:outline-pr flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] focus-visible:outline-2"
    >
      <span
        aria-hidden="true"
        className="grid size-3.5 shrink-0 place-items-center"
      >
        {on ? <Check weight="bold" className="size-3" /> : null}
      </span>
      {children}
    </Link>
  );
}
