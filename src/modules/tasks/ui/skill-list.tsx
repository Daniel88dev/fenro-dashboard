"use client";

import { MagnifyingGlass, Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import type {
  LabelItem,
  SkillItem,
} from "@/modules/tasks/application/queries/read-models";

import { LabelChips, LabelDot } from "./labels";
import { labelHref, NEW_SKILL, skillHref, SKILLS_PATH } from "./skill-views";

/** Not login fields: these keep password managers off them. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const ROW =
  "hover:bg-surface-raised focus-visible:outline-pr border-hairline-soft flex flex-col gap-1.5 border-b px-3.5 py-3 focus-visible:-outline-offset-2 focus-visible:outline-2";

/** Every word typed has to appear in one of the fields. */
function matches(query: string, ...fields: readonly string[]): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = fields.join(" ").toLowerCase();
  return words.every((word) => text.includes(word));
}

/**
 * The list half of a tab: a search over what is already on screen, a New
 * button, and the rows. The list can grow, so it is searched, never filtered
 * with pills.
 */
function ListPanel({
  label,
  query,
  onQuery,
  newHref,
  newLabel,
  create,
  head,
  children,
}: {
  label: string;
  query: string;
  onQuery: (query: string) => void;
  newHref?: string;
  newLabel?: string;
  /** Takes the New button's place: a form, for labels. */
  create?: ReactNode;
  head?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="border-hairline bg-surface min-w-0 overflow-hidden rounded-xl border lg:w-[360px] lg:shrink-0"
    >
      <div className="border-hairline relative flex gap-2 border-b p-3">
        <label className="border-hairline bg-surface focus-within:outline-pr flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-lg border px-[11px] focus-within:outline-2 focus-within:outline-offset-1">
          <MagnifyingGlass
            aria-hidden="true"
            className="text-ink-faint size-[15px] shrink-0"
          />
          <span className="sr-only">Search {label.toLowerCase()}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="text-ink placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            {...NOT_A_LOGIN}
          />
        </label>
        {newHref ? (
          <Link
            href={newHref}
            scroll={false}
            className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex h-[34px] items-center gap-1.5 rounded-lg border px-[11px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
          >
            <Plus aria-hidden="true" weight="bold" className="size-[14px]" />
            {newLabel}
          </Link>
        ) : null}
        {create}
      </div>
      {head}
      <ul className="m-0 flex max-h-[70dvh] list-none flex-col overflow-y-auto p-0">
        {children}
      </ul>
    </section>
  );
}

export function SkillList({
  skills,
  labels,
  selected,
}: {
  skills: readonly SkillItem[];
  labels: readonly LabelItem[];
  /** The name of the skill open in the editor. */
  selected: string | null;
}) {
  const [query, setQuery] = useState("");
  const shown = skills.filter((skill) =>
    matches(query, skill.name, skill.description),
  );

  return (
    <ListPanel
      label="Skills"
      query={query}
      onQuery={setQuery}
      newHref={skillHref(NEW_SKILL)}
      newLabel="New"
    >
      {shown.map((skill) => {
        const here = skill.name === selected;
        return (
          <li key={skill.id}>
            <Link
              href={skillHref(skill.name)}
              scroll={false}
              aria-current={here ? "true" : undefined}
              className={`${ROW} ${here ? "bg-surface-sunken" : ""}`}
            >
              <span className="flex items-baseline gap-2">
                <span className="text-ink min-w-0 flex-1 truncate font-mono text-[13px] font-medium">
                  {skill.name}
                </span>
                {skill.openTasks > 0 ? (
                  <span className="text-ink-faint shrink-0 font-mono text-[11.5px]">
                    {skill.openTasks} open
                  </span>
                ) : null}
              </span>
              <span className="text-ink-muted line-clamp-2 text-[12.5px]">
                {skill.description}
              </span>
              {skill.labels.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  <LabelChips names={skill.labels} catalogue={labels} />
                </span>
              ) : (
                <span className="text-ink-faint text-[12px]">
                  No labels, kept in the library
                </span>
              )}
            </Link>
          </li>
        );
      })}
      {shown.length === 0 ? (
        <li className="text-ink-muted px-3.5 py-5 text-[13px]">
          {skills.length === 0
            ? "No skills yet. Write the first one with New."
            : "No skill matches that search."}
        </li>
      ) : null}
    </ListPanel>
  );
}

export function LabelList({
  labels,
  selected,
  create,
}: {
  labels: readonly LabelItem[];
  /** The New label control. */
  create?: ReactNode;
  /** The name of the label open beside the list. */
  selected: string | null;
}) {
  const [query, setQuery] = useState("");
  const shown = labels.filter((label) => matches(query, label.name));

  return (
    <ListPanel
      label="Labels"
      query={query}
      onQuery={setQuery}
      create={create}
      head={
        <div
          aria-hidden="true"
          className="border-hairline-soft text-ink-faint flex border-b px-3.5 py-2 text-[11.5px]"
        >
          <span className="flex-1">Label</span>
          <span className="w-[76px] text-right">Open tasks</span>
          <span className="w-[52px] text-right">Skills</span>
        </div>
      }
    >
      {shown.map((label) => {
        const here = label.name === selected;
        return (
          <li key={label.name}>
            <Link
              href={labelHref(label.name)}
              scroll={false}
              aria-current={here ? "true" : undefined}
              className={`${ROW} flex-row items-center py-2.5 ${here ? "bg-surface-sunken" : ""}`}
            >
              <LabelDot colour={label.colour} />
              <span className="text-ink min-w-0 flex-1 truncate font-mono text-[13px]">
                {label.name}
              </span>
              <span className="text-ink w-[76px] text-right font-mono text-[12.5px]">
                {label.openTasks}
              </span>
              <span className="text-ink-muted w-[52px] text-right font-mono text-[12.5px]">
                {label.skills.length}
              </span>
            </Link>
          </li>
        );
      })}
      {shown.length === 0 ? (
        <li className="text-ink-muted px-3.5 py-5 text-[13px]">
          {labels.length === 0 ? (
            <>
              No labels yet. Add one to a task, or link one to a skill in{" "}
              <Link href={SKILLS_PATH} className="underline underline-offset-2">
                Skills
              </Link>
              .
            </>
          ) : (
            "No label matches that search."
          )}
        </li>
      ) : null}
    </ListPanel>
  );
}
