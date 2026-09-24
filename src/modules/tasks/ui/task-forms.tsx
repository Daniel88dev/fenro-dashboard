"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

import { CaretRight, Check, PencilSimple } from "@phosphor-icons/react/ssr";

import { EMPTY_FORM_STATE, type TaskFormState } from "./task-form-state";

export type TaskAction = (
  state: TaskFormState,
  formData: FormData,
) => Promise<TaskFormState>;

/** Every server action the task screens use, handed down by the route. */
export type TaskActions = {
  readonly create: TaskAction;
  readonly update: TaskAction;
  readonly edit: TaskAction;
  readonly note: TaskAction;
  readonly checkCriterion: TaskAction;
  readonly changeStatus: TaskAction;
  readonly link: TaskAction;
};

/** Not login fields: these keep password managers off them. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const FIELD =
  "border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr rounded-lg border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1";
const PRIMARY =
  "border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-wait disabled:opacity-70";
const SECONDARY =
  "border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 disabled:cursor-wait disabled:opacity-70";
const QUIET =
  "border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr h-[30px] cursor-pointer rounded-lg border px-[10px] text-[12px] font-medium focus-visible:outline-2 disabled:cursor-wait disabled:opacity-70";
const MENU_ROW =
  "hover:bg-surface-sunken focus-visible:outline-pr flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] focus-visible:outline-2 disabled:cursor-wait disabled:opacity-70";
const LINK =
  "text-ink-muted hover:text-issue-strong focus-visible:outline-pr cursor-pointer rounded-md px-1.5 py-1 text-[12px] focus-visible:outline-2 disabled:cursor-wait";

export const PRIORITY_OPTIONS = [
  ["none", "No priority"],
  ["urgent", "Urgent"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
] as const;

/**
 * A form bound to one server action: shows the domain's refusal in words,
 * and clears itself after each save unless it edits something in place.
 */
function ActionForm({
  action,
  label,
  task,
  resetOnSave = true,
  className,
  children,
}: {
  action: TaskAction;
  label: string;
  task?: string;
  resetOnSave?: boolean;
  className?: string;
  children: (pending: boolean) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSave && state.saved > 0) form.current?.reset();
  }, [state.saved, resetOnSave]);

  return (
    <form
      ref={form}
      action={formAction}
      aria-label={label}
      className={className ?? "flex flex-col gap-2"}
    >
      {task ? <input type="hidden" name="task" value={task} /> : null}
      {children(pending)}
      {state.error ? (
        <p
          role="alert"
          className="border-issue-wash bg-issue-wash text-issue-strong rounded-lg border px-3 py-2 text-[12px]"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-[12.5px] font-medium">
        {label}
        {hint ? (
          <span className="text-ink-faint ml-2 font-normal">{hint}</span>
        ) : null}
      </label>
      {children(id)}
    </div>
  );
}

export type NewTaskDefaults = {
  readonly repository: string;
  readonly parent: string;
  readonly source: string;
  readonly title: string;
};

/** Priority as a row of segments rather than a select: all five fit. */
function PrioritySegments({
  defaultValue = "none",
}: {
  defaultValue?: string;
}) {
  // Lowest to highest, left to right, with "none" first.
  const options = [PRIORITY_OPTIONS[0], ...PRIORITY_OPTIONS.slice(1).reverse()];
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="text-ink mb-1.5 p-0 text-[12.5px] font-medium">
        Priority
      </legend>
      <div className="border-hairline bg-surface grid grid-cols-5 overflow-hidden rounded-lg border">
        {options.map(([value, label]) => (
          <label
            key={value}
            className="border-hairline text-ink-soft has-checked:bg-ink has-checked:text-ground has-focus-visible:outline-pr relative cursor-pointer border-l py-1.5 text-center text-[12px] first:border-l-0 has-checked:font-medium has-focus-visible:outline-2 has-focus-visible:-outline-offset-2"
          >
            <input
              type="radio"
              name="priority"
              value={value}
              defaultChecked={value === defaultValue}
              className="sr-only"
            />
            {value === "none" ? "None" : label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * A source link can be long: the field grows to a second line rather than
 * clipping, as Daniel asked, and Enter still submits instead of breaking it.
 */
function SourceField({
  id,
  defaultValue,
}: {
  id: string;
  defaultValue: string;
}) {
  return (
    <textarea
      id={id}
      name="source"
      rows={1}
      defaultValue={defaultValue}
      placeholder="https://github.com/…/pull/12"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      className={`${FIELD} field-sizing-content min-h-[34px] resize-none py-[7px] font-mono text-[12.5px] leading-[1.45] [overflow-wrap:anywhere]`}
      {...NOT_A_LOGIN}
    />
  );
}

/**
 * A task written by hand: what it is, how to know it is done, where from.
 * On its page the form has room for every field; in the dialog the rarer
 * ones fold away under one disclosure.
 */
export function NewTaskForm({
  action,
  defaults,
  variant = "page",
  cancel,
}: {
  action: TaskAction;
  defaults: NewTaskDefaults;
  variant?: "page" | "dialog";
  /** The way out: a link on the page, a close button in the dialog. */
  cancel?: ReactNode;
}) {
  const dialog = variant === "dialog";

  const title = (
    <Field label="Title">
      {(id) => (
        <input
          id={id}
          name="title"
          required
          maxLength={200}
          defaultValue={defaults.title}
          autoFocus
          className={`${FIELD} h-[38px] text-[14px]`}
          {...NOT_A_LOGIN}
        />
      )}
    </Field>
  );
  const description = (
    <Field label="Description" hint="Markdown">
      {(id) => (
        <textarea
          id={id}
          name="description"
          rows={dialog ? 4 : 6}
          placeholder="What should the agent know before it starts?"
          className={`${FIELD} field-sizing-content py-2 text-[13px] leading-relaxed ${dialog ? "min-h-[96px]" : "min-h-[150px]"}`}
          {...NOT_A_LOGIN}
        />
      )}
    </Field>
  );
  const criteria = (
    <Field
      label="Acceptance criteria"
      hint={
        dialog
          ? "One per line"
          : "One per line. How an agent knows it is finished."
      }
    >
      {(id) => (
        <textarea
          id={id}
          name="criteria"
          rows={3}
          className={`${FIELD} field-sizing-content py-2 text-[13px] leading-relaxed ${dialog ? "min-h-[72px]" : "min-h-[110px]"}`}
          {...NOT_A_LOGIN}
        />
      )}
    </Field>
  );
  const repository = (
    <Field label="Repository" hint="owner/name">
      {(id) => (
        <input
          id={id}
          name="repository"
          defaultValue={defaults.repository}
          className={`${FIELD} h-[34px] font-mono text-[12.5px]`}
          {...NOT_A_LOGIN}
        />
      )}
    </Field>
  );
  const rest = (
    <>
      <Field label="Sub-task of" hint="Task key">
        {(id) => (
          <input
            id={id}
            name="parent"
            defaultValue={defaults.parent}
            placeholder="e.g. T-3"
            className={`${FIELD} h-[34px] font-mono text-[12.5px]`}
            {...NOT_A_LOGIN}
          />
        )}
      </Field>
      <Field label="Blocked by" hint="Keys, comma separated">
        {(id) => (
          <input
            id={id}
            name="blockedBy"
            className={`${FIELD} h-[34px] font-mono text-[12.5px]`}
            {...NOT_A_LOGIN}
          />
        )}
      </Field>
      <Field label="Labels" hint="Comma separated">
        {(id) => (
          <input
            id={id}
            name="labels"
            className={`${FIELD} h-[34px]`}
            {...NOT_A_LOGIN}
          />
        )}
      </Field>
      <Field label="Source" hint="GitHub, Jira, Linear or any link">
        {(id) => <SourceField id={id} defaultValue={defaults.source} />}
      </Field>
    </>
  );

  return (
    <ActionForm
      action={action}
      label="New task"
      resetOnSave={false}
      className={
        dialog
          ? "flex flex-col [&>[role=alert]]:mx-5 [&>[role=alert]]:mb-4"
          : "flex flex-col gap-2"
      }
    >
      {(pending) => (
        <>
          {dialog ? <input type="hidden" name="from" value="dialog" /> : null}
          {dialog ? (
            <div className="flex flex-col gap-4 px-5 py-[18px] sm:px-[22px]">
              {title}
              {description}
              {criteria}
              <div className="grid gap-4 sm:grid-cols-2">
                {repository}
                <PrioritySegments />
              </div>
              <details
                className="group"
                open={Boolean(defaults.parent || defaults.source)}
              >
                <summary className="text-ink-muted hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1.5 text-[12.5px] [&::-webkit-details-marker]:hidden">
                  <CaretRight
                    aria-hidden="true"
                    className="size-3 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  />
                  Sub-task of, blocked by, labels, source
                </summary>
                <div className="grid gap-4 pt-4 sm:grid-cols-2">{rest}</div>
              </details>
            </div>
          ) : (
            <div className="grid items-start gap-x-9 gap-y-[18px] md:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex flex-col gap-[18px]">
                {title}
                {description}
                {criteria}
              </div>
              <div className="flex flex-col gap-[18px]">
                {repository}
                <PrioritySegments />
                {rest}
              </div>
            </div>
          )}
          <div
            className={
              dialog
                ? "border-hairline-soft bg-surface-raised flex flex-col gap-3 border-t px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-[22px]"
                : "border-hairline mt-2 flex flex-col gap-3 border-t pt-[18px] sm:flex-row sm:items-center sm:justify-between"
            }
          >
            <label className="text-ink-soft flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                name="status"
                value="backlog"
                className="accent-pr size-4"
              />
              Backlog, not ready for an agent yet
            </label>
            <div className="flex items-center justify-end gap-2">
              {cancel}
              <button type="submit" disabled={pending} className={PRIMARY}>
                {pending ? "Creating…" : "Create task"}
              </button>
            </div>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export type TaskDetails = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly priority: string;
  readonly labels: readonly string[];
  readonly repository: string | null;
};

/** Editing what the task says, behind a disclosure so reading comes first. */
export function EditTaskForm({
  action,
  task,
}: {
  action: TaskAction;
  task: TaskDetails;
}) {
  return (
    <details className="group">
      <summary className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr inline-flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium select-none focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
        <PencilSimple aria-hidden="true" className="size-[13px]" />
        Edit details
      </summary>
      <ActionForm
        action={action}
        label="Edit task"
        task={task.key}
        resetOnSave={false}
        className="flex flex-col gap-3 pt-3"
      >
        {(pending) => (
          <>
            <Field label="Title">
              {(id) => (
                <input
                  id={id}
                  name="title"
                  required
                  defaultValue={task.title}
                  className={`${FIELD} h-[34px]`}
                  {...NOT_A_LOGIN}
                />
              )}
            </Field>
            <Field label="Description" hint="Markdown">
              {(id) => (
                <textarea
                  id={id}
                  name="description"
                  rows={8}
                  defaultValue={task.description}
                  className={`${FIELD} py-2 font-mono text-[12.5px]`}
                  {...NOT_A_LOGIN}
                />
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Priority">
                {(id) => (
                  <select
                    id={id}
                    name="priority"
                    defaultValue={task.priority}
                    className={`${FIELD} h-[34px]`}
                  >
                    {PRIORITY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Labels">
                {(id) => (
                  <input
                    id={id}
                    name="labels"
                    defaultValue={task.labels.join(", ")}
                    className={`${FIELD} h-[34px]`}
                    {...NOT_A_LOGIN}
                  />
                )}
              </Field>
              <Field label="Repository">
                {(id) => (
                  <input
                    id={id}
                    name="repository"
                    defaultValue={task.repository ?? ""}
                    className={`${FIELD} h-[34px] font-mono text-[12.5px]`}
                    {...NOT_A_LOGIN}
                  />
                )}
              </Field>
            </div>
            <div>
              <button type="submit" disabled={pending} className={PRIMARY}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </ActionForm>
    </details>
  );
}

const NOTE_OPTIONS = [
  ["note", "Note"],
  ["decision", "Decision"],
  ["discovery", "Discovery"],
  ["question", "Question"],
] as const;

/** A person adds to the journal the same way an agent does. */
export function NoteForm({
  action,
  task,
}: {
  action: TaskAction;
  task: string;
}) {
  return (
    <ActionForm action={action} label="Add to the journal" task={task}>
      {(pending) => (
        <div className="border-hairline bg-surface focus-within:outline-pr flex flex-col gap-2 rounded-xl border p-2.5 focus-within:outline-2 focus-within:outline-offset-1">
          <label className="sr-only" htmlFor={`${task}-note`}>
            Journal entry
          </label>
          <textarea
            id={`${task}-note`}
            name="text"
            required
            rows={2}
            placeholder="A decision, a discovery, or an answer for the agent"
            className="text-ink placeholder:text-ink-faint field-sizing-content min-h-[44px] resize-none bg-transparent px-1 py-0.5 text-[13px] leading-relaxed outline-none"
            {...NOT_A_LOGIN}
          />
          <div className="flex items-center justify-between gap-2">
            <select
              name="kind"
              aria-label="Kind of entry"
              defaultValue="note"
              className={`${FIELD} h-[28px] px-2 text-[12px]`}
            >
              {NOTE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className={`${PRIMARY} h-[28px] px-2.5 text-[12px]`}
            >
              {pending ? "Adding…" : "Add to journal"}
            </button>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

/**
 * Tick or untick one criterion. The box is the submit button; evidence is
 * shown when an agent recorded it.
 */
export function CriterionForm({
  action,
  task,
  number,
  text,
  met,
  evidence,
}: {
  action: TaskAction;
  task: string;
  number: number;
  text: string;
  met: boolean;
  evidence: string | null;
}) {
  return (
    <ActionForm
      action={action}
      label={`Criterion ${number}`}
      task={task}
      resetOnSave={false}
      className="flex flex-col gap-1"
    >
      {(pending) => (
        <div className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-x-2.5 py-2">
          <input type="hidden" name="criterion" value={number} />
          <input type="hidden" name="met" value={met ? "false" : "true"} />
          <button
            type="submit"
            disabled={pending}
            role="checkbox"
            aria-checked={met}
            aria-label={`${met ? "Untick" : "Tick"} criterion ${number}`}
            className={`focus-visible:outline-pr mt-0.5 grid size-4 cursor-pointer place-items-center rounded-[5px] border-[1.5px] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 ${
              met
                ? "border-pr bg-pr text-on-pr"
                : "border-hairline bg-surface hover:border-ink-faint"
            }`}
          >
            {met ? (
              <Check aria-hidden="true" weight="bold" className="size-[11px]" />
            ) : null}
          </button>
          <span className="flex flex-col gap-0.5">
            <span
              className={`text-[13px] ${met ? "text-ink-soft" : "text-ink"}`}
            >
              {text}
            </span>
            {met && evidence ? (
              <span className="text-ink-muted text-[12px]">{evidence}</span>
            ) : null}
          </span>
        </div>
      )}
    </ActionForm>
  );
}

/** One field, one button: adding criteria, links, or blocking tasks. */
export function InlineForm({
  action,
  task,
  label,
  name,
  placeholder,
  button,
  hidden,
  extra,
  multiline = false,
}: {
  action: TaskAction;
  task: string;
  label: string;
  name: string;
  placeholder: string;
  button: string;
  hidden?: Readonly<Record<string, string>>;
  extra?: ReactNode;
  multiline?: boolean;
}) {
  return (
    <ActionForm action={action} label={label} task={task}>
      {(pending) => (
        <div className="flex flex-wrap items-start gap-2">
          {Object.entries(hidden ?? {}).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          {multiline ? (
            <textarea
              name={name}
              aria-label={label}
              required
              rows={2}
              placeholder={placeholder}
              className={`${FIELD} min-w-[220px] flex-1 py-1.5 text-[12.5px]`}
              {...NOT_A_LOGIN}
            />
          ) : (
            <input
              name={name}
              aria-label={label}
              required
              placeholder={placeholder}
              className={`${FIELD} h-[30px] min-w-[220px] flex-1 text-[12.5px]`}
              {...NOT_A_LOGIN}
            />
          )}
          {extra}
          <button type="submit" disabled={pending} className={QUIET}>
            {button}
          </button>
        </div>
      )}
    </ActionForm>
  );
}

const BUTTON_TONES = {
  primary: PRIMARY,
  secondary: SECONDARY,
  quiet: QUIET,
  menu: MENU_ROW,
  link: LINK,
} as const;

/** A single button that posts fixed values: remove a link, change status. */
export function ButtonForm({
  action,
  task,
  label,
  values,
  children,
  tone = "secondary",
}: {
  action: TaskAction;
  task: string;
  label: string;
  values: Readonly<Record<string, string>>;
  children: ReactNode;
  tone?: "quiet" | "primary" | "secondary" | "menu" | "link";
}) {
  return (
    <ActionForm
      action={action}
      label={label}
      task={task}
      resetOnSave={false}
      className={
        tone === "menu"
          ? "flex flex-col gap-1"
          : "flex flex-col items-start gap-1"
      }
    >
      {(pending) => (
        <>
          {Object.entries(values).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button
            type="submit"
            disabled={pending}
            aria-label={label}
            className={BUTTON_TONES[tone]}
          >
            {children}
          </button>
        </>
      )}
    </ActionForm>
  );
}
