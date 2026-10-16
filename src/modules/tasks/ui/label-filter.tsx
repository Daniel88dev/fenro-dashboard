"use client";

import { CaretDown, Check, Tag } from "@phosphor-icons/react/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { LabelColour } from "@/modules/tasks/domain";

import { labelFill } from "./labels";

export type LabelFilterOption = {
  readonly name: string;
  readonly colour: LabelColour;
  readonly openTasks: number;
  readonly picked: boolean;
  /** The list with this label ticked or unticked, the rest kept. */
  readonly href: string;
};

/**
 * Labels as a dropdown rather than a row of pills: a person's labels only
 * grow, so the control stays one button and the list can be searched. Several
 * can be ticked; the list shows tasks carrying any of them. Each tick is a
 * link, so the pick lives in the URL beside the rest of the filter, and the
 * panel stays open to tick another.
 */
export function LabelFilter({
  options,
  clearHref,
}: {
  options: readonly LabelFilterOption[];
  /** The list with no label picked. */
  clearHref: string;
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
  const go = (href: string) => router.push(href, { scroll: false });
  const typed = query.trim().toLowerCase();
  const shown = options.filter((option) => option.name.includes(typed));
  const picked = options.filter((option) => option.picked);
  const summary =
    picked.length === 0
      ? "Any"
      : picked.length === 1
        ? picked[0]!.name
        : `${picked.length} picked`;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Labels: ${picked.length ? picked.map((option) => option.name).join(", ") : "any"}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className={`focus-visible:outline-pr inline-flex h-[34px] max-w-full cursor-pointer items-center gap-2 rounded-lg border px-[11px] text-[12.5px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 ${
          picked.length
            ? "border-ink text-ink bg-surface"
            : "border-hairline bg-surface text-ink-soft hover:text-ink hover:border-ink-faint"
        }`}
      >
        <Tag
          aria-hidden="true"
          className="text-ink-faint size-[15px] shrink-0"
        />
        <span className="text-ink-faint">Labels</span>
        {picked.length ? (
          <span aria-hidden="true" className="flex">
            {picked.slice(0, 4).map((option) => (
              <i
                key={option.name}
                className={`border-surface -ml-[3px] size-2 rounded-full border-[1.5px] first:ml-0 ${labelFill(option.colour)}`}
              />
            ))}
          </span>
        ) : null}
        <span className="truncate">{summary}</span>
        <CaretDown
          aria-hidden="true"
          className="text-ink-faint size-3 shrink-0"
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="dialog"
          aria-label="Filter by label"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            close();
            root.current?.querySelector<HTMLButtonElement>("button")?.focus();
          }}
          className="border-hairline bg-surface text-ink absolute top-full left-0 z-30 mt-1.5 flex w-72 max-w-[calc(100vw-32px)] flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]"
        >
          <label htmlFor={`${listId}-search`} className="sr-only">
            Find a label
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
              if (shown[0]) go(shown[0].href);
            }}
            placeholder="Find a label"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mb-1 h-[30px] rounded-lg border px-2.5 text-[12.5px] focus-visible:outline-2"
          />
          <ul className="m-0 flex max-h-[280px] list-none flex-col overflow-y-auto p-0">
            {shown.map((option) => (
              <li key={option.name}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={option.picked}
                  onClick={() => go(option.href)}
                  className="hover:bg-surface-sunken focus-visible:outline-pr flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] focus-visible:outline-2"
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-3.5 shrink-0 place-items-center rounded-[4px] border-[1.5px] ${
                      option.picked
                        ? "border-ink bg-ink text-ground"
                        : "border-ink-faint"
                    }`}
                  >
                    {option.picked ? (
                      <Check weight="bold" className="size-2.5" />
                    ) : null}
                  </span>
                  <i
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${labelFill(option.colour)}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  <span className="text-ink-faint shrink-0 font-mono text-[12px]">
                    {option.openTasks}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 ? (
            <p className="text-ink-muted px-2 py-1.5 text-[12px]">
              {options.length === 0
                ? "No labels yet. Add them on a task."
                : "No label matches."}
            </p>
          ) : null}
          <div className="border-hairline-soft text-ink-muted mt-1 flex items-center justify-between border-t px-1.5 pt-1.5 text-[12px]">
            <span>Tasks with any of these</span>
            {picked.length ? (
              <button
                type="button"
                onClick={() => {
                  close();
                  go(clearHref);
                }}
                className="hover:text-ink cursor-pointer underline underline-offset-2"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
