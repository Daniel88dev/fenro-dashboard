"use client";

import { Check, LinkSimple, Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  LabelItem,
  SkillItem,
} from "@/modules/tasks/application/queries/read-models";
import { LABEL_COLOURS } from "@/modules/tasks/domain";

import { FLOATING_PANEL, useFloatingPanel } from "./floating-panel";
import { labelFill } from "./labels";
import { skillHref, type SkillActions } from "./skill-views";
import { ButtonForm, type TaskAction } from "./task-forms";
import { EMPTY_FORM_STATE, type TaskFormState } from "./task-form-state";

/** Not login fields: these keep password managers off them. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const FIELD =
  "border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr h-[34px] rounded-lg border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1";
const SECONDARY =
  "border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-[12px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 disabled:cursor-wait disabled:opacity-70";

const COLOUR_NAMES: Record<(typeof LABEL_COLOURS)[number], string> = {
  gray: "Grey",
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
};

function Problem({ error }: { error: string | null }) {
  return error ? (
    <p
      role="alert"
      className="border-issue-wash bg-issue-wash text-issue-strong rounded-lg border px-3 py-2 text-[12px]"
    >
      {error}
    </p>
  ) : null;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * One label beside the list: rename it, recolour it, and the skills it
 * brings, linked and unlinked from here as well as from a skill's editor.
 */
export function LabelEditor({
  label,
  skills,
  actions,
}: {
  label: LabelItem;
  skills: readonly SkillItem[];
  actions: SkillActions;
}) {
  const id = useId();
  const [renamed, renameAction, renaming] = useActionState(
    actions.renameLabel,
    EMPTY_FORM_STATE,
  );
  const [recoloured, recolourAction, recolouring] = useActionState(
    actions.recolourLabel,
    EMPTY_FORM_STATE,
  );
  const linked = skills.filter((skill) => label.skills.includes(skill.name));
  const linkable = skills.filter((skill) => !label.skills.includes(skill.name));

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="border-hairline bg-surface flex min-w-0 flex-1 flex-col gap-6 rounded-xl border p-4 sm:p-5"
    >
      <h2 id={`${id}-heading`} className="sr-only">
        Label {label.name}
      </h2>

      <form
        action={renameAction}
        aria-label="Rename"
        className="flex flex-col gap-1.5"
      >
        <input type="hidden" name="label" value={label.name} />
        <label
          htmlFor={`${id}-name`}
          className="text-ink text-[12.5px] font-medium"
        >
          Name
        </label>
        <div className="flex gap-2">
          <input
            key={label.name}
            id={`${id}-name`}
            name="name"
            required
            defaultValue={label.name}
            className={`${FIELD} min-w-0 flex-1 font-mono`}
            {...NOT_A_LOGIN}
          />
          <button type="submit" disabled={renaming} className={SECONDARY}>
            Rename
          </button>
        </div>
        <span className="text-ink-faint text-[11.5px]">
          Renaming changes it on {plural(label.tasks, "task", "tasks")} and{" "}
          {plural(label.skills.length, "skill", "skills")} at once.
        </span>
        <Problem error={renamed.error} />
      </form>

      <form
        action={recolourAction}
        aria-label="Colour"
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="label" value={label.name} />
        <span className="text-ink text-[12.5px] font-medium">Colour</span>
        <div className="flex flex-wrap gap-2.5">
          {LABEL_COLOURS.map((colour) => {
            const on = colour === label.colour;
            return (
              <button
                key={colour}
                type="submit"
                name="colour"
                value={colour}
                disabled={recolouring}
                aria-pressed={on}
                aria-label={COLOUR_NAMES[colour]}
                title={COLOUR_NAMES[colour]}
                className={`focus-visible:outline-pr grid size-7 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait ${labelFill(colour)} ${
                  on ? "ring-surface outline-ink ring-2 outline-2" : ""
                }`}
              >
                {on ? (
                  <Check
                    aria-hidden="true"
                    weight="bold"
                    className="text-surface size-3.5"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <Problem error={recoloured.error} />
      </form>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-ink text-[13px] font-semibold">Linked skills</h3>
          <SkillPicker
            label={label.name}
            skills={linkable}
            link={actions.link}
          />
        </div>
        <ul className="border-hairline m-0 flex list-none flex-col overflow-hidden rounded-xl border p-0">
          {linked.map((skill) => (
            <li
              key={skill.id}
              className="border-hairline-soft flex items-start gap-3 border-b px-3.5 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  href={skillHref(skill.name)}
                  className="text-pr font-mono text-[13px] font-medium hover:underline"
                >
                  {skill.name}
                </Link>
                <span className="text-ink-muted text-[12.5px]">
                  {skill.description}
                </span>
              </div>
              <ButtonForm
                action={actions.unlink}
                task=""
                label={`Unlink ${skill.name}`}
                values={{ skill: skill.id, label: label.name }}
                tone="link"
              >
                Unlink
              </ButtonForm>
            </li>
          ))}
          {linked.length === 0 ? (
            <li className="text-ink-muted px-3.5 py-3 text-[13px]">
              No skills yet. Tasks with this label start without extra
              instructions.
            </li>
          ) : null}
        </ul>
      </div>

      <p className="text-ink-muted text-[12.5px]">
        {plural(label.openTasks, "open task carries", "open tasks carry")}{" "}
        <span className="font-mono">{label.name}</span>.{" "}
        <Link
          href={`/tasks?labels=${encodeURIComponent(label.name)}`}
          className="text-pr hover:underline"
        >
          Open in Tasks
        </Link>
      </p>
    </section>
  );
}

/**
 * Link a skill to a label: a searchable list of the skills not linked yet,
 * since skills are a list that grows.
 */
function SkillPicker({
  label,
  skills,
  link,
}: {
  label: string;
  skills: readonly SkillItem[];
  link: TaskAction;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, formAction, pending] = useActionState(
    async (previous: TaskFormState, formData: FormData) => {
      const next = await link(previous, formData);
      // Linked: the list closes, and the skill shows under Linked skills.
      if (!next.error) setOpen(false);
      return next;
    },
    EMPTY_FORM_STATE,
  );
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { anchor, panel } = useFloatingPanel(open, "end");

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = skills.filter((skill) => {
    const text = `${skill.name} ${skill.description}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });

  return (
    <div ref={root} className="relative flex flex-col items-end gap-1">
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setQuery("");
          setOpen((was) => !was);
        }}
        className="border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border px-[10px] text-[12px] font-medium focus-visible:outline-2"
      >
        <LinkSimple aria-hidden="true" className="size-[14px]" />
        Link a skill
      </button>
      <Problem error={state.error} />
      {open ? (
        <div
          ref={panel}
          id={listId}
          role="dialog"
          aria-label="Link a skill"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setOpen(false);
            anchor.current?.focus();
          }}
          className={`${FLOATING_PANEL} border-hairline bg-surface text-ink flex w-80 max-w-[calc(100vw-32px)] flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]`}
        >
          <label htmlFor={`${listId}-search`} className="sr-only">
            Find a skill
          </label>
          <input
            ref={search}
            id={`${listId}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a skill"
            className="border-hairline bg-surface-raised text-ink placeholder:text-ink-faint focus-visible:outline-pr mb-1 h-[30px] rounded-lg border px-2.5 text-[12.5px] focus-visible:outline-2"
            {...NOT_A_LOGIN}
          />
          <form action={formAction}>
            <input type="hidden" name="label" value={label} />
            <ul className="m-0 flex max-h-[280px] list-none flex-col overflow-y-auto p-0">
              {shown.map((skill) => (
                <li key={skill.id}>
                  <button
                    type="submit"
                    name="skill"
                    value={skill.id}
                    disabled={pending}
                    className="hover:bg-surface-sunken focus-visible:outline-pr flex w-full cursor-pointer flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 disabled:cursor-wait"
                  >
                    <span className="text-ink font-mono text-[12.5px]">
                      {skill.name}
                    </span>
                    <span className="text-ink-muted line-clamp-2 text-[11.5px]">
                      {skill.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </form>
          {shown.length === 0 ? (
            <p className="text-ink-muted px-2 py-1.5 text-[12px]">
              {skills.length === 0
                ? "Every skill is already linked to this label."
                : "No skill matches that search."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * New label: a button that opens a one-field form in its place. Labels are
 * also made from a task's label picker and a skill's; this is for making one
 * before anything carries it.
 */
export function NewLabelForm({ create }: { create: TaskAction }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(create, EMPTY_FORM_STATE);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" weight="bold" className="size-[14px]" />
        New
      </Button>
    );
  }
  return (
    <form
      action={formAction}
      aria-label="New label"
      className="absolute inset-x-3 top-3 z-10 flex flex-col gap-1.5"
    >
      <div className="flex gap-2">
        <input
          ref={input}
          name="name"
          required
          aria-label="New label name"
          placeholder="frontend"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className={`${FIELD} min-w-0 flex-1 font-mono`}
          {...NOT_A_LOGIN}
        />
        <button type="submit" disabled={pending} className={SECONDARY}>
          Create
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-muted hover:text-ink focus-visible:outline-pr h-[34px] cursor-pointer rounded-lg px-2 text-[12.5px] focus-visible:outline-2"
        >
          Cancel
        </button>
      </div>
      <Problem error={state.error} />
    </form>
  );
}

function Button({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-[11px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
    >
      {children}
    </button>
  );
}
