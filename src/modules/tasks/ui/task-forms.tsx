"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

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
  "border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr rounded-[9px] border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1";
const PRIMARY =
  "border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr h-[32px] cursor-pointer rounded-[9px] border px-[12px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-wait disabled:opacity-70";
const QUIET =
  "border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr h-[30px] cursor-pointer rounded-[8px] border px-[10px] text-[12px] font-medium focus-visible:outline-2 disabled:cursor-wait disabled:opacity-70";

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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-ink-soft text-[12px]">
        {label}
        {hint ? <span className="text-ink-faint"> · {hint}</span> : null}
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

/** A task written by hand: what it is, how to know it is done, where from. */
export function NewTaskForm({
  action,
  defaults,
}: {
  action: TaskAction;
  defaults: NewTaskDefaults;
}) {
  return (
    <ActionForm action={action} label="New task" resetOnSave={false}>
      {(pending) => (
        <div className="flex flex-col gap-4">
          <Field label="Title">
            {(id) => (
              <input
                id={id}
                name="title"
                required
                maxLength={200}
                defaultValue={defaults.title}
                autoFocus
                className={`${FIELD} h-[36px]`}
                {...NOT_A_LOGIN}
              />
            )}
          </Field>
          <Field
            label="Description"
            hint="Markdown, what an agent needs to know"
          >
            {(id) => (
              <textarea
                id={id}
                name="description"
                rows={6}
                className={`${FIELD} py-2 font-mono text-[12.5px]`}
                {...NOT_A_LOGIN}
              />
            )}
          </Field>
          <Field label="Acceptance criteria" hint="one per line">
            {(id) => (
              <textarea
                id={id}
                name="criteria"
                rows={3}
                className={`${FIELD} py-2`}
                {...NOT_A_LOGIN}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Source" hint="GitHub, Jira, Linear or any link">
              {(id) => (
                <input
                  id={id}
                  name="source"
                  type="url"
                  defaultValue={defaults.source}
                  className={`${FIELD} h-[34px] text-[12.5px]`}
                  {...NOT_A_LOGIN}
                />
              )}
            </Field>
            <Field label="Sub-task of" hint="e.g. T-3">
              {(id) => (
                <input
                  id={id}
                  name="parent"
                  defaultValue={defaults.parent}
                  className={`${FIELD} h-[34px] font-mono text-[12.5px]`}
                  {...NOT_A_LOGIN}
                />
              )}
            </Field>
            <Field label="Blocked by" hint="keys, comma separated">
              {(id) => (
                <input
                  id={id}
                  name="blockedBy"
                  className={`${FIELD} h-[34px] font-mono text-[12.5px]`}
                  {...NOT_A_LOGIN}
                />
              )}
            </Field>
            <Field label="Priority">
              {(id) => (
                <select
                  id={id}
                  name="priority"
                  defaultValue="none"
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
            <Field label="Labels" hint="comma separated">
              {(id) => (
                <input
                  id={id}
                  name="labels"
                  className={`${FIELD} h-[34px]`}
                  {...NOT_A_LOGIN}
                />
              )}
            </Field>
          </div>
          <label className="text-ink-soft flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              name="status"
              value="backlog"
              className="accent-pr"
            />
            Keep it in the backlog, so agents do not pick it up yet
          </label>
          <div>
            <button type="submit" disabled={pending} className={PRIMARY}>
              {pending ? "Creating…" : "Create task"}
            </button>
          </div>
        </div>
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
      <summary className="text-ink-muted hover:text-ink cursor-pointer text-[12.5px] select-none">
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
        <>
          <label className="sr-only" htmlFor={`${task}-note`}>
            Journal entry
          </label>
          <textarea
            id={`${task}-note`}
            name="text"
            required
            rows={3}
            placeholder="A decision, a discovery, or an answer for the agent"
            className={`${FIELD} py-2`}
            {...NOT_A_LOGIN}
          />
          <div className="flex items-center gap-2">
            <select
              name="kind"
              aria-label="Kind of entry"
              defaultValue="note"
              className={`${FIELD} h-[30px] text-[12px]`}
            >
              {NOTE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="submit" disabled={pending} className={QUIET}>
              {pending ? "Adding…" : "Add to journal"}
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Tick or untick one criterion; ticking asks for the evidence. */
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
        <div className="flex flex-wrap items-start gap-2">
          <input type="hidden" name="criterion" value={number} />
          <input type="hidden" name="met" value={met ? "false" : "true"} />
          <span
            aria-hidden
            className={`mt-0.5 font-mono text-[12.5px] ${met ? "text-pr-strong" : "text-ink-faint"}`}
          >
            {met ? "[x]" : "[ ]"}
          </span>
          <span className="flex min-w-[200px] flex-1 flex-col gap-0.5">
            <span className="text-ink text-[13px]">{text}</span>
            {met && evidence ? (
              <span className="text-ink-muted text-[12px]">{evidence}</span>
            ) : null}
          </span>
          {met ? null : (
            <input
              name="evidence"
              aria-label={`Evidence for criterion ${number}`}
              placeholder="Evidence (optional)"
              className={`${FIELD} h-[30px] w-[200px] text-[12px]`}
              {...NOT_A_LOGIN}
            />
          )}
          <button
            type="submit"
            disabled={pending}
            className={QUIET}
            aria-label={`${met ? "Untick" : "Tick"} criterion ${number}`}
          >
            {met ? "Untick" : "Tick"}
          </button>
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

/** A single button that posts fixed values: remove a link, change status. */
export function ButtonForm({
  action,
  task,
  label,
  values,
  children,
  tone = "quiet",
}: {
  action: TaskAction;
  task: string;
  label: string;
  values: Readonly<Record<string, string>>;
  children: ReactNode;
  tone?: "quiet" | "primary";
}) {
  return (
    <ActionForm
      action={action}
      label={label}
      task={task}
      resetOnSave={false}
      className="flex flex-col items-start gap-1"
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
            className={tone === "primary" ? PRIMARY : QUIET}
          >
            {children}
          </button>
        </>
      )}
    </ActionForm>
  );
}
