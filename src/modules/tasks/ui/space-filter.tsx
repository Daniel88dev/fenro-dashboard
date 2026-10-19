"use client";

import {
  CaretDown,
  Check,
  GearSix,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { SpacePrefix } from "./space-select";

export type SpaceFilterGroup = {
  readonly prefix: string;
  readonly name: string;
  readonly picked: boolean;
  readonly href: string;
};

export function SpaceFilter({
  groups,
  personalOnly,
  personalHref,
  allHref,
  manageHref,
}: {
  groups: readonly SpaceFilterGroup[];
  personalOnly: boolean;
  personalHref: string;
  allHref: string;
  manageHref: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const picked = groups.filter((group) => group.picked);
  const filtering = personalOnly || picked.length < groups.length;
  const label = personalOnly
    ? "Only mine"
    : !filtering
      ? "All spaces"
      : picked.length === 1
        ? `Personal + ${picked[0]!.prefix}`
        : `Personal + ${picked.length} groups`;
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Spaces: ${label}`}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className={`focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-lg border px-[11px] text-[12.5px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 ${
          filtering
            ? "border-ink text-ink bg-surface"
            : "border-hairline bg-surface text-ink-soft hover:text-ink hover:border-ink-faint"
        }`}
      >
        <UsersThree
          aria-hidden="true"
          className="text-ink-faint size-[15px] shrink-0"
        />
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
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-[rgba(22,22,18,0.42)] sm:hidden"
          />
          <div
            id={panelId}
            role="dialog"
            aria-label="Show tasks from"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              close();
            }}
            className="border-hairline bg-surface text-ink fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border p-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)] sm:absolute sm:inset-x-auto sm:top-full sm:bottom-auto sm:left-0 sm:z-30 sm:mt-1.5 sm:w-80 sm:rounded-xl sm:p-1.5 md:right-0 md:left-auto"
          >
            <p className="text-ink-muted px-2.5 pt-2 pb-1.5 text-[12px] font-medium">
              Show tasks from
            </p>
            <Choice
              href={personalHref}
              on={personalOnly}
              onPick={() => setOpen(false)}
            >
              Only my personal tasks
            </Choice>
            <Choice
              href={allHref}
              on={!personalOnly}
              onPick={() => setOpen(false)}
            >
              Personal and groups
            </Choice>
            <ul className="m-0 flex list-none flex-col gap-px p-0 pt-0.5 pb-1 pl-[26px]">
              {groups.map((group) => {
                const ticked = !personalOnly && group.picked;
                return (
                  <li key={group.prefix}>
                    <Link
                      href={group.href}
                      scroll={false}
                      role="checkbox"
                      aria-checked={ticked}
                      onClick={() => setOpen(false)}
                      className={`hover:bg-surface-sunken focus-visible:outline-pr flex min-h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] focus-visible:outline-2 ${personalOnly ? "text-ink-muted" : "text-ink"}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-4 shrink-0 place-items-center rounded border ${
                          ticked
                            ? "border-pr bg-pr text-on-pr"
                            : "border-hairline bg-surface"
                        }`}
                      >
                        {ticked ? (
                          <Check weight="bold" className="size-[11px]" />
                        ) : null}
                      </span>
                      <SpacePrefix prefix={group.prefix} />
                      <span className="min-w-0 flex-1 truncate">
                        {group.name}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="bg-hairline-soft mx-1 mt-0.5 mb-1 h-px" />
            <Link
              href={manageHref}
              onClick={() => setOpen(false)}
              className="text-ink-muted hover:text-ink hover:bg-surface-sunken focus-visible:outline-pr flex min-h-[34px] items-center gap-2 rounded-lg px-2.5 text-[12.5px] focus-visible:outline-2"
            >
              <GearSix aria-hidden="true" className="size-3.5" />
              Manage groups
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Choice({
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
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className="hover:bg-surface-sunken focus-visible:outline-pr flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] focus-visible:outline-2"
    >
      <span
        aria-hidden="true"
        className={`grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] ${on ? "border-pr" : "border-hairline"}`}
      >
        {on ? <span className="bg-pr size-2 rounded-full" /> : null}
      </span>
      {children}
    </Link>
  );
}
