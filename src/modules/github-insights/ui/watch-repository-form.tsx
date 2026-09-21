"use client";

import { useActionState } from "react";

export type WatchFormState = {
  readonly error: string | null;
};

export const EMPTY_WATCH_STATE: WatchFormState = { error: null };

export function WatchRepositoryForm({
  action,
}: {
  action: (
    state: WatchFormState,
    formData: FormData,
  ) => Promise<WatchFormState>;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    EMPTY_WATCH_STATE,
  );

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="watch-repository" className="sr-only">
          Repository to watch, as owner/name
        </label>
        <input
          id="watch-repository"
          name="repository"
          type="text"
          required
          placeholder="owner/name"
          aria-describedby={state.error ? "watch-repository-error" : undefined}
          aria-invalid={state.error ? true : undefined}
          className="border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr h-[34px] w-[190px] rounded-[9px] border px-3 font-mono text-[13px] placeholder:font-sans focus-visible:outline-2 focus-visible:outline-offset-1"
        />
        {state.error ? (
          <p
            id="watch-repository-error"
            role="alert"
            className="text-issue-strong max-w-[260px] text-[11.5px]"
          >
            {state.error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="border-ink bg-ink text-ground hover:bg-ink-soft h-[34px] cursor-pointer rounded-[9px] border px-[13px] text-[12.5px] font-medium disabled:opacity-60"
      >
        Watch a repository
      </button>
    </form>
  );
}
