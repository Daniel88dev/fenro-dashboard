"use client";

import { ClockCounterClockwise } from "@phosphor-icons/react/ssr";
import { useActionState, useId, useState, type ReactNode } from "react";

import { formatRelativeTime } from "@/modules/github-insights/ui/format";
import type { SkillDetail } from "@/modules/tasks/application/queries/read-models";
import {
  MAX_SKILL_DESCRIPTION,
  MAX_SKILL_INSTRUCTIONS,
  MAX_SKILL_NAME,
} from "@/modules/tasks/domain";

import { LabelPicker } from "./label-picker";
import type { LabelOption } from "./labels";
import { Markdown } from "./markdown";
import { SkillHistory } from "./skill-history";
import { changedBy, type SkillActions } from "./skill-views";
import { ButtonForm } from "./task-forms";
import { EMPTY_FORM_STATE } from "./task-form-state";

/** Not login fields: these keep password managers off them. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const FIELD =
  "border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr w-full rounded-lg border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1";
const PRIMARY =
  "border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border px-[11px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-50";
const SECONDARY =
  "border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border px-[11px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 disabled:cursor-default disabled:opacity-50";

/**
 * The editor beside the skill list: name, labels, when to use it, and the
 * Markdown instructions with a preview rendered the way a task description
 * is. A new skill is the same form with nothing filled in.
 *
 * The editor is keyed by skill and revision by its parent, so a save (or an
 * agent's edit arriving on refresh) starts it again from what is stored.
 */
export function SkillEditor({
  skill,
  catalogue,
  actions,
  now,
}: {
  /** Null for a new skill. */
  skill: SkillDetail | null;
  catalogue: readonly LabelOption[];
  actions: SkillActions;
  now: Date;
}) {
  const [state, formAction, pending] = useActionState(
    actions.save,
    EMPTY_FORM_STATE,
  );
  const [instructions, setInstructions] = useState(skill?.instructions ?? "");
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState(true);
  const [generation, setGeneration] = useState(0);
  const id = useId();

  const discard = () => {
    setInstructions(skill?.instructions ?? "");
    setDirty(false);
    setGeneration((value) => value + 1);
  };

  return (
    <section
      aria-label={skill ? `Skill ${skill.name}` : "New skill"}
      className="border-hairline bg-surface min-w-0 rounded-xl border"
    >
      <div className="border-hairline flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        {skill ? (
          <>
            <span className="text-ink-faint font-mono text-[12px]">
              rev {skill.revision}
            </span>
            <span className="text-ink-muted text-[12px]">
              Edited {formatRelativeTime(new Date(skill.updatedAt), now)} by{" "}
              <span className="font-mono">
                {changedBy(skill.updatedBy, skill.updatedByKind)}
              </span>
            </span>
          </>
        ) : (
          <h2 className="text-ink text-[13px] font-semibold">New skill</h2>
        )}
        {dirty ? (
          <span className="bg-neutral-wash text-running rounded-md px-2 py-0.5 text-[11.5px] font-medium">
            Unsaved changes
          </span>
        ) : null}
        <span className="flex-1" />
        {skill ? (
          <button
            type="button"
            aria-pressed={history}
            onClick={() => setHistory((was) => !was)}
            className={`${SECONDARY} ${history ? "" : "border-transparent bg-transparent"}`}
          >
            <ClockCounterClockwise aria-hidden="true" className="size-[15px]" />
            History
          </button>
        ) : null}
        <button
          type="button"
          onClick={discard}
          disabled={!dirty || pending}
          className={SECONDARY}
        >
          Discard
        </button>
        <button
          type="submit"
          form={`${id}-form`}
          disabled={(!dirty && skill !== null) || pending}
          className={PRIMARY}
        >
          {pending ? "Saving…" : skill ? "Save" : "Create skill"}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row">
        <form
          key={generation}
          id={`${id}-form`}
          action={formAction}
          aria-label={skill ? "Edit skill" : "New skill"}
          onInput={() => setDirty(true)}
          className="flex min-w-0 flex-1 flex-col gap-4 p-4"
        >
          {skill ? (
            <>
              <input type="hidden" name="skill" value={skill.id} />
              <input type="hidden" name="revision" value={skill.revision} />
            </>
          ) : null}
          <input type="hidden" name="instructions" value={instructions} />
          {state.error ? (
            <p
              role="alert"
              className="border-issue-wash bg-issue-wash text-issue-strong rounded-lg border px-3 py-2 text-[12px]"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-4 sm:flex-row">
            <Field
              id={`${id}-name`}
              label="Name"
              hint="Lower case, digits and hyphens"
            >
              <input
                id={`${id}-name`}
                name="name"
                required
                maxLength={MAX_SKILL_NAME}
                defaultValue={skill?.name ?? ""}
                placeholder="frontend-conventions"
                className={`${FIELD} h-[34px] font-mono`}
                {...NOT_A_LOGIN}
              />
            </Field>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-ink text-[12.5px] font-medium">Labels</span>
              <div className="flex min-h-[34px] items-center">
                <LabelPicker
                  catalogue={catalogue}
                  defaultValue={skill?.labels ?? []}
                  onPick={() => setDirty(true)}
                />
              </div>
            </div>
          </div>

          <Field
            id={`${id}-description`}
            label="When to use it"
            hint="Agents read this first, so start with “Use when…”"
          >
            <textarea
              id={`${id}-description`}
              name="description"
              required
              rows={2}
              maxLength={MAX_SKILL_DESCRIPTION}
              defaultValue={skill?.description ?? ""}
              placeholder="Use when building or changing UI in this repository."
              className={`${FIELD} field-sizing-content min-h-[60px] resize-y py-2 leading-relaxed`}
              {...NOT_A_LOGIN}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${id}-instructions`}
                className="text-ink text-[12.5px] font-medium"
              >
                Instructions
              </label>
              <div
                role="group"
                aria-label="Instructions view"
                className="bg-neutral-wash inline-flex gap-0.5 rounded-lg p-0.5"
              >
                {(
                  [
                    [false, "Write"],
                    [true, "Preview"],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    key={text}
                    type="button"
                    aria-pressed={preview === value}
                    onClick={() => setPreview(value)}
                    className={`focus-visible:outline-pr h-[26px] cursor-pointer rounded-md px-2.5 text-[12px] focus-visible:outline-2 ${
                      preview === value
                        ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline)]"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id={`${id}-instructions`}
              hidden={preview}
              rows={16}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder={
                "## Colours\n- Use the theme tokens. Never a dark: class."
              }
              className={`${FIELD} resize-y py-2.5 font-mono text-[12.5px] leading-relaxed`}
              {...NOT_A_LOGIN}
            />
            {preview ? (
              <div className="border-hairline bg-surface-raised min-h-[260px] rounded-lg border px-4 py-3">
                {instructions.trim() ? (
                  <Markdown className="text-ink text-[13.5px] leading-relaxed">
                    {instructions}
                  </Markdown>
                ) : (
                  <p className="text-ink-muted text-[13px]">
                    Nothing to preview yet.
                  </p>
                )}
              </div>
            ) : null}
            <div className="text-ink-faint flex justify-between gap-3 text-[11.5px]">
              <span>Markdown, rendered the same way as task descriptions</span>
              <span
                className={`font-mono ${instructions.length > MAX_SKILL_INSTRUCTIONS ? "text-issue-strong" : ""}`}
              >
                {instructions.length.toLocaleString("en")} /{" "}
                {MAX_SKILL_INSTRUCTIONS.toLocaleString("en")}
              </span>
            </div>
          </div>

          {skill ? (
            <p className="border-hairline-soft text-ink-muted border-t pt-3 text-[12.5px]">
              {skill.labels.length === 0
                ? "Not linked to a label, so no task gets it yet."
                : `Applies to ${skill.openTasks === 1 ? "1 open task" : `${skill.openTasks} open tasks`} through ${skill.labels.join(", ")}.`}
            </p>
          ) : null}
        </form>

        {skill && history ? (
          <SkillHistory skill={skill} restore={actions.restore} now={now} />
        ) : null}
      </div>

      {skill ? <DeleteSkill skill={skill} remove={actions.remove} /> : null}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-[12.5px] font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <span className="text-ink-faint text-[11.5px]">{hint}</span>
      ) : null}
    </div>
  );
}

/**
 * Deleting is a person's call, never an agent's: it takes the revisions with
 * it, so it asks once first. Tasks keep their labels.
 */
function DeleteSkill({
  skill,
  remove,
}: {
  skill: SkillDetail;
  remove: SkillActions["remove"];
}) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="border-hairline flex flex-wrap items-center gap-2 border-t px-4 py-3">
      {asking ? (
        <>
          <span className="text-ink text-[12.5px]">
            Delete <span className="font-mono">{skill.name}</span> and its
            history? Tasks keep their labels.
          </span>
          <ButtonForm
            action={remove}
            task=""
            label={`Delete ${skill.name}`}
            values={{ skill: skill.id }}
            tone="quiet"
          >
            Delete skill
          </ButtonForm>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="text-ink-muted hover:text-ink focus-visible:outline-pr h-[30px] cursor-pointer rounded-lg px-2 text-[12px] focus-visible:outline-2"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="text-ink-muted hover:text-issue-strong focus-visible:outline-pr h-[28px] cursor-pointer rounded-md px-1.5 text-[12px] focus-visible:outline-2"
        >
          Delete skill
        </button>
      )}
    </div>
  );
}
