"use client";

import { CaretDown, Check, User } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Avatar } from "./assignee";

export type AssigneeFilterOption = {
  /** Null for "Unassigned". */
  readonly login: string | null;
  readonly label: string;
  /** Prefixes of the groups shared with this person, as in "HAL MOR". */
  readonly groups?: string;
  readonly picked: boolean;
  readonly href: string;
};

/** Not a login field: these keep password managers off it. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

export function AssigneeFilter({
  me,
  unassigned,
  people,
  clearHref,
}: {
  me: AssigneeFilterOption;
  unassigned: AssigneeFilterOption;
  people: readonly AssigneeFilterOption[];
  clearHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    // On a phone, focusing would raise the keyboard over the bottom sheet.
    if (window.matchMedia?.("(min-width: 640px)").matches) {
      search.current?.focus();
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  const picked = [me, unassigned, ...people].filter((option) => option.picked);
  const only = picked.length === 1 ? picked[0]! : null;
  const label =
    picked.length === 0
      ? "Assignee"
      : only
        ? only.label
        : `Assignee: ${picked.length}`;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = people.filter((person) =>
    words.every((word) => person.label.toLowerCase().includes(word)),
  );

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Assignee filter: ${picked.length === 0 ? "anyone" : label}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className={`focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border px-[11px] text-[12.5px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 ${
          picked.length > 0
            ? "border-ink text-ink bg-surface font-medium"
            : "border-hairline bg-surface text-ink-soft hover:text-ink hover:border-ink-faint"
        }`}
      >
        {only && only.login ? (
          <Avatar login={only.login} size="sm" />
        ) : (
          <User
            aria-hidden="true"
            className="text-ink-faint size-[15px] shrink-0"
          />
        )}
        {label}
        <CaretDown
          aria-hidden="true"
          className="text-ink-faint size-3 shrink-0"
        />
      </button>

      {open ? (
        <>
          <div
            aria-hidden="true"
            onClick={close}
            className="fixed inset-0 z-40 bg-[rgba(22,22,18,0.42)] sm:hidden"
          />
          <div
            id={panelId}
            role="dialog"
            aria-label="Filter by assignee"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              close();
              button.current?.focus();
            }}
            className="border-hairline bg-surface text-ink fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border p-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)] sm:absolute sm:inset-x-auto sm:top-full sm:bottom-auto sm:left-0 sm:z-30 sm:mt-1.5 sm:max-h-none sm:w-[300px] sm:rounded-xl sm:p-1.5"
          >
            <p className="text-ink px-2.5 pt-2 pb-2 text-[15px] font-semibold sm:hidden">
              Assignee
            </p>
            <label htmlFor={`${panelId}-search`} className="sr-only">
              Search people
            </label>
            <input
              ref={search}
              id={`${panelId}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              {...NOT_A_LOGIN}
              className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mx-0.5 mb-1.5 h-11 rounded-lg border px-2.5 text-[15px] focus-visible:outline-2 sm:h-[30px] sm:text-[12.5px]"
            />
            <div className="flex min-h-0 flex-col overflow-y-auto">
              <Choice option={me} onPick={close} />
              <Choice option={unassigned} onPick={close} />
              {people.length > 0 ? (
                <>
                  <div className="bg-hairline-soft mx-1 my-1 h-px" />
                  <p className="text-ink-muted px-2.5 pt-1 pb-1 text-[12px] font-medium">
                    People in your groups
                  </p>
                  {shown.map((person) => (
                    <Choice key={person.label} option={person} onPick={close} />
                  ))}
                  {shown.length === 0 ? (
                    <p className="text-ink-muted px-2.5 py-1.5 text-[12.5px]">
                      No one in your groups matches.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            {picked.length > 0 ? (
              <>
                <div className="bg-hairline-soft mx-1 mt-1 mb-1 h-px" />
                <Link
                  href={clearHref}
                  scroll={false}
                  onClick={close}
                  className="text-ink-muted hover:text-ink hover:bg-surface-sunken focus-visible:outline-pr flex min-h-[34px] items-center rounded-lg px-2.5 text-[12.5px] focus-visible:outline-2"
                >
                  Clear the assignee filter
                </Link>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Choice({
  option,
  onPick,
}: {
  option: AssigneeFilterOption;
  onPick: () => void;
}) {
  return (
    <Link
      href={option.href}
      scroll={false}
      role="checkbox"
      aria-checked={option.picked}
      onClick={onPick}
      className="hover:bg-surface-sunken focus-visible:outline-pr flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-[14px] focus-visible:outline-2 sm:min-h-9 sm:text-[13px]"
    >
      <span
        aria-hidden="true"
        className={`grid size-4 shrink-0 place-items-center rounded border ${
          option.picked
            ? "border-pr bg-pr text-on-pr"
            : "border-hairline bg-surface"
        }`}
      >
        {option.picked ? <Check weight="bold" className="size-[11px]" /> : null}
      </span>
      <Avatar login={option.login} />
      <span
        className={`min-w-0 flex-1 truncate ${option.groups !== undefined ? "font-mono text-[12.5px]" : ""}`}
      >
        {option.label}
      </span>
      {option.groups ? (
        <span className="bg-surface-sunken text-ink-soft rounded px-[5px] py-px font-mono text-[11px] font-semibold">
          {option.groups}
        </span>
      ) : null}
    </Link>
  );
}
