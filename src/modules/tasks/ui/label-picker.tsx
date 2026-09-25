"use client";

import { Check, Plus, Tag } from "@phosphor-icons/react/ssr";
import { useEffect, useId, useRef, useState } from "react";

import { normaliseLabelName, parseLabelName } from "@/modules/tasks/domain";

import { colourOf, LabelChip, LabelDot, type LabelOption } from "./labels";

/** Not a login field: these keep password managers off it. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

/**
 * Pick any number of labels: the chosen ones show as chips, and a button
 * opens the owner's labels to tick or untick, with a filter that also makes
 * a new label from whatever was typed. What is picked goes to the server as
 * one `labels` field per name, plus a `labelsField` marker so an empty pick
 * reads as "no labels" rather than "labels left alone".
 *
 * `onPick` runs after each change the person makes, so a picker that saves
 * straight away (on a task's page) can submit its form.
 */
export function LabelPicker({
  catalogue,
  defaultValue = [],
  onPick,
}: {
  catalogue: readonly LabelOption[];
  defaultValue?: readonly string[];
  onPick?: (form: HTMLFormElement | null) => void;
}) {
  const [picked, setPicked] = useState<readonly string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const changed = useRef(false);
  const listId = useId();

  useEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    onPick?.(root.current?.closest("form") ?? null);
  }, [picked, onPick]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const toggle = (name: string) => {
    changed.current = true;
    setPicked((current) =>
      current.includes(name)
        ? current.filter((other) => other !== name)
        : [...current, name],
    );
  };

  // Every label there is, plus names picked but not saved yet.
  const options: LabelOption[] = [
    ...catalogue,
    ...picked
      .filter((name) => !catalogue.some((label) => label.name === name))
      .map((name) => ({ name, colour: colourOf(catalogue, name) })),
  ];
  const typed = normaliseLabelName(query);
  const shown = options.filter((option) => option.name.includes(typed));
  const fresh = typed && !options.some((option) => option.name === typed);
  const valid = fresh ? parseLabelName(query) : null;

  const create = () => {
    if (!valid?.ok) return;
    toggle(valid.value);
    setQuery("");
  };

  return (
    <div ref={root} className="relative flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="labelsField" value="1" />
      {picked.map((name) => (
        <input key={name} type="hidden" name="labels" value={name} />
      ))}
      {picked.map((name) => (
        <LabelChip key={name} name={name} colour={colourOf(catalogue, name)} />
      ))}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={picked.length > 0 ? "Edit labels" : "Add labels"}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="border-hairline text-ink-soft hover:bg-surface-sunken hover:text-ink focus-visible:outline-pr inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-md border border-dashed px-1.5 text-[11px] font-medium focus-visible:outline-2"
      >
        {picked.length > 0 ? (
          <Plus aria-hidden="true" className="size-3" />
        ) : (
          <>
            <Tag aria-hidden="true" className="size-3" />
            Add labels
          </>
        )}
      </button>

      {open ? (
        <div
          id={listId}
          role="dialog"
          aria-label="Labels"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setOpen(false);
            root.current?.querySelector<HTMLButtonElement>("button")?.focus();
          }}
          className="border-hairline bg-surface text-ink absolute top-full left-0 z-30 mt-1.5 flex w-64 max-w-[calc(100vw-32px)] flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]"
        >
          <label htmlFor={`${listId}-search`} className="sr-only">
            Find or create a label
          </label>
          <input
            ref={search}
            id={`${listId}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              // Enter picks: never submit the form around the picker.
              event.preventDefault();
              if (fresh) create();
              else if (shown[0]) toggle(shown[0].name);
            }}
            placeholder="Find or create a label"
            className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mb-1 h-[30px] rounded-lg border px-2.5 text-[12.5px] focus-visible:outline-2"
            {...NOT_A_LOGIN}
          />
          <ul className="m-0 flex max-h-[240px] list-none flex-col overflow-y-auto p-0">
            {shown.map((option) => {
              const on = picked.includes(option.name);
              return (
                <li key={option.name}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(option.name)}
                    className="hover:bg-surface-sunken focus-visible:outline-pr flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] focus-visible:outline-2"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-3.5 shrink-0 place-items-center rounded-[4px] border ${on ? "border-ink bg-ink text-ground" : "border-hairline"}`}
                    >
                      {on ? <Check weight="bold" className="size-2.5" /> : null}
                    </span>
                    <LabelDot colour={option.colour} />
                    <span className="min-w-0 flex-1 truncate">
                      {option.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {fresh ? (
            valid?.ok ? (
              <button
                type="button"
                onClick={create}
                className="hover:bg-surface-sunken focus-visible:outline-pr text-ink flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] focus-visible:outline-2"
              >
                <Plus aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  Create <span className="font-medium">{valid.value}</span>
                </span>
              </button>
            ) : (
              <p className="text-ink-muted px-2 py-1.5 text-[12px]">
                Letters, digits and . _ : / - only, up to 40.
              </p>
            )
          ) : shown.length === 0 ? (
            <p className="text-ink-muted px-2 py-1.5 text-[12px]">
              No labels yet. Type a name to create one.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
