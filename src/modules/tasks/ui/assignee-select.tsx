"use client";

import { CaretDown, Check, LockSimple } from "@phosphor-icons/react/ssr";
import { useEffect, useId, useRef, useState } from "react";

import type { SpaceMember } from "@/modules/tasks/domain";

import { Avatar } from "./assignee";
import { FLOATING_PANEL, useFloatingPanel } from "./floating-panel";

/** Not a login field: these keep password managers off it. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

export function LockedAssignee({ login }: { login: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="bg-surface-sunken text-ink flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px]">
        <Avatar login={login} size="lg" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
          {login}
        </span>
        <LockSimple
          aria-label="Fixed"
          className="text-ink-faint size-[13px] shrink-0"
        />
      </div>
      <p className="text-ink-muted text-[12px]">
        Personal tasks are always yours.
      </p>
    </div>
  );
}

/**
 * Submits as `assignee`: a member's login, or empty for unassigned.
 */
export function AssigneeSelect({
  id,
  members,
  you,
  groupName,
  defaultValue = null,
  onPick,
  offerMe = false,
}: {
  id?: string;
  members: readonly SpaceMember[];
  you: string;
  groupName: string;
  defaultValue?: string | null;
  onPick?: (form: HTMLFormElement | null) => void;
  offerMe?: boolean;
}) {
  const [value, setValue] = useState<string | null>(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const changed = useRef(false);
  const listId = useId();
  const { anchor, panel } = useFloatingPanel(open);

  useEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    onPick?.(root.current?.closest("form") ?? null);
  }, [value, onPick]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const sameLogin = (a: string | null, b: string | null) =>
    (a?.toLowerCase() ?? null) === (b?.toLowerCase() ?? null);
  const sorted = [
    ...members.filter((member) => sameLogin(member.login, you)),
    ...members
      .filter((member) => !sameLogin(member.login, you))
      .sort((a, b) => a.login.localeCompare(b.login)),
  ];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const options: (string | null)[] = [
    null,
    ...sorted.map((member) => member.login),
  ].filter((login) =>
    words.every((word) => (login ?? "unassigned").toLowerCase().includes(word)),
  );
  const current =
    members.find((member) => sameLogin(member.login, value))?.login ?? null;

  function close() {
    setOpen(false);
    setQuery("");
  }
  const pick = (login: string | null) => {
    if (!sameLogin(login, current)) changed.current = true;
    setValue(login);
    close();
    anchor.current?.focus();
  };

  return (
    <div ref={root} className="flex min-w-0 flex-col gap-1.5">
      <input type="hidden" name="assignee" value={current ?? ""} />
      <button
        ref={anchor}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={
          current
            ? `Assignee: ${current}. Change`
            : "Unassigned. Assign someone"
        }
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          close();
        }}
        className="border-hairline bg-surface text-ink hover:border-ink-faint focus-visible:outline-pr flex h-10 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-[10px] border px-2.5 text-left text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        <Avatar login={current} size="lg" />
        <span
          className={`min-w-0 flex-1 truncate ${current ? "font-mono text-[12.5px]" : "text-ink-muted"}`}
        >
          {current ?? "Unassigned"}
        </span>
        <CaretDown
          aria-hidden="true"
          className="text-ink-faint size-3 shrink-0"
        />
      </button>
      {offerMe &&
      !sameLogin(current, you) &&
      members.some((member) => sameLogin(member.login, you)) ? (
        <button
          type="button"
          onClick={() => pick(you)}
          className="text-pr focus-visible:outline-pr w-fit cursor-pointer rounded text-[12.5px] underline underline-offset-[3px] focus-visible:outline-2"
        >
          Assign to me
        </button>
      ) : null}

      {open ? (
        <div
          ref={panel}
          id={listId}
          role="dialog"
          aria-label="Assign to"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close();
            anchor.current?.focus();
          }}
          className={`${FLOATING_PANEL} border-hairline bg-surface text-ink flex w-[300px] max-w-[calc(100vw-16px)] flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]`}
        >
          <label htmlFor={`${listId}-search`} className="sr-only">
            Search members
          </label>
          <input
            ref={search}
            id={`${listId}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (options.length > 0) pick(options[0]!);
            }}
            placeholder={`Search ${groupName} members`}
            {...NOT_A_LOGIN}
            className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mb-1 h-[30px] rounded-lg border px-2.5 text-[12.5px] focus-visible:outline-2"
          />
          <ul className="m-0 flex max-h-[280px] list-none flex-col overflow-y-auto p-0">
            {options.map((login) => {
              const picked = sameLogin(login, current);
              return (
                <li key={login ?? ""}>
                  <button
                    type="button"
                    aria-pressed={picked}
                    onClick={() => pick(login)}
                    className={`hover:bg-surface-sunken focus-visible:outline-pr flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-[13px] focus-visible:outline-2 ${picked ? "bg-surface-raised" : ""}`}
                  >
                    <Avatar login={login} />
                    <span
                      className={`min-w-0 flex-1 truncate ${login ? "font-mono text-[12.5px]" : "text-ink-muted"}`}
                    >
                      {login ?? "Unassigned"}
                    </span>
                    {login && sameLogin(login, you) ? (
                      <span className="text-ink-muted text-[12px]">you</span>
                    ) : null}
                    <span
                      aria-hidden="true"
                      className="text-pr grid size-3.5 shrink-0 place-items-center"
                    >
                      {picked ? (
                        <Check weight="bold" className="size-3" />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {options.length === 0 ? (
            <p className="text-ink-muted px-2 py-1.5 text-[12px]">
              No member matches.
            </p>
          ) : null}
          <p className="border-hairline-soft text-ink-muted mt-1 border-t px-2 pt-2 pb-1 text-[12px]">
            Only members of {groupName} can be assigned.
          </p>
        </div>
      ) : null}
    </div>
  );
}
