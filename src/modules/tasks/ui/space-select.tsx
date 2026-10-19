"use client";

import { CaretDown, Check } from "@phosphor-icons/react/ssr";
import { useEffect, useId, useRef, useState } from "react";

import { FLOATING_PANEL, useFloatingPanel } from "./floating-panel";
import type { LabelOption } from "./labels";

export type SpaceOption = {
  readonly prefix: string;
  readonly name: string;
  readonly kind: "personal" | "group";
  /** Who sees tasks here, as in "Only you" or "4 members". */
  readonly who: string;
  /** The key the next task here gets, as in HAL-134. */
  readonly next: string;
  readonly labels: readonly LabelOption[];
};

export function SpacePrefix({ prefix }: { prefix: string }) {
  return (
    <span className="bg-surface-sunken text-ink-soft min-w-[30px] shrink-0 rounded px-[5px] py-px text-center font-mono text-[11px] font-semibold">
      {prefix}
    </span>
  );
}

export function SpaceSelect({
  id,
  options,
  value,
  onChange,
}: {
  id?: string;
  options: readonly SpaceOption[];
  value: string;
  onChange: (prefix: string) => void;
}) {
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

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = options.filter((option) => {
    const haystack = `${option.prefix} ${option.name}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const current =
    options.find((option) => option.prefix === value) ?? options[0];

  function close() {
    setOpen(false);
    setQuery("");
  }
  const pick = (prefix: string) => {
    onChange(prefix);
    close();
    anchor.current?.focus();
  };

  return (
    <div ref={root} className="flex min-w-0">
      <input type="hidden" name="space" value={current?.prefix ?? ""} />
      <button
        ref={anchor}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Space: ${current?.name ?? ""}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          close();
        }}
        className="border-hairline bg-surface-raised text-ink focus-visible:outline-pr hover:border-ink-faint flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[14px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        {current ? <SpacePrefix prefix={current.prefix} /> : null}
        <span className="min-w-0 truncate">{current?.name}</span>
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
          aria-label="Where the task lives"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close();
            anchor.current?.focus();
          }}
          className={`${FLOATING_PANEL} border-hairline bg-surface text-ink flex w-[340px] max-w-[calc(100vw-16px)] flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]`}
        >
          <label htmlFor={`${listId}-search`} className="sr-only">
            Find a space
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
              if (shown[0]) pick(shown[0].prefix);
            }}
            placeholder="Find a space"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mb-1 h-[30px] rounded-lg border px-2.5 text-[12.5px] focus-visible:outline-2"
          />
          <ul className="m-0 flex max-h-[280px] list-none flex-col overflow-y-auto p-0">
            {shown.map((option) => (
              <li key={option.prefix}>
                <button
                  type="button"
                  aria-pressed={option.prefix === current?.prefix}
                  onClick={() => pick(option.prefix)}
                  className="hover:bg-surface-sunken focus-visible:outline-pr flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-left text-[13px] focus-visible:outline-2"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-3.5 shrink-0 place-items-center"
                  >
                    {option.prefix === current?.prefix ? (
                      <Check weight="bold" className="size-3" />
                    ) : null}
                  </span>
                  <SpacePrefix prefix={option.prefix} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.name}</span>
                    <span className="text-ink-muted text-[11.5px]">
                      {option.who}
                    </span>
                  </span>
                  <span className="text-ink-faint font-mono text-[12px]">
                    {option.next}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 ? (
            <p className="text-ink-muted px-2 py-1.5 text-[12px]">
              No space matches.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
