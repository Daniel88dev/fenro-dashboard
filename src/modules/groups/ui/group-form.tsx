"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";

import { EMPTY_GROUP_FORM, type GroupAction } from "./group-form-state";

/** Not login fields: these keep password managers off them. */
export const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

export const FIELD =
  "border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr rounded-lg border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1";
const BUTTON =
  "focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60";
export const PRIMARY = `${BUTTON} border-ink bg-ink text-ground hover:bg-ink-soft`;
export const SECONDARY = `${BUTTON} border-hairline bg-surface text-ink hover:bg-surface-sunken`;
export const DANGER = `${BUTTON} border-hairline bg-surface text-issue-strong hover:bg-issue-wash`;

export function GroupForm({
  action,
  label,
  fields,
  className,
  resetOnSave = false,
  children,
}: {
  action: GroupAction;
  label: string;
  fields: Record<string, string>;
  className?: string;
  resetOnSave?: boolean;
  children: (pending: boolean) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_GROUP_FORM);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSave && state.saved > 0) form.current?.reset();
  }, [state.saved, resetOnSave]);

  return (
    <form
      ref={form}
      action={formAction}
      aria-label={label}
      className={className}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children(pending)}
      {state.error ? (
        <p
          role="alert"
          className="border-issue-wash bg-issue-wash text-issue-strong basis-full rounded-lg border px-3 py-2 text-[12px]"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
