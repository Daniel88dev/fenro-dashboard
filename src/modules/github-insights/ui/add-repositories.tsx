"use client";

import {
  useActionState,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Plus } from "@phosphor-icons/react/ssr";

import { Chip } from "./chip";
import { Spinner } from "./spinner";

export type AddRepositoriesState = {
  readonly error: string | null;
  readonly added: number;
};

export const EMPTY_ADD_STATE: AddRepositoriesState = { error: null, added: 0 };

/** One repository the picker offers, as the list endpoint sends it. */
export type PickableRepository = {
  readonly owner: string;
  readonly name: string;
  readonly isPrivate: boolean;
  readonly description: string | null;
  readonly watched: boolean;
};

/** What the list endpoint answers: the repositories, or why there are none. */
export type PickerListing =
  | { readonly repositories: readonly PickableRepository[] }
  | { readonly error: string };

type Listing =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly error: string }
  | {
      readonly status: "loaded";
      readonly repositories: readonly PickableRepository[];
    };

const fullNameOf = (repository: PickableRepository) =>
  `${repository.owner}/${repository.name}`;

async function fetchListing(source: string): Promise<Listing> {
  try {
    const response = await fetch(source, { cache: "no-store" });
    const body = (await response.json()) as PickerListing;
    return "error" in body
      ? { status: "failed", error: body.error }
      : { status: "loaded", repositories: body.repositories };
  } catch {
    return {
      status: "failed",
      error: "Could not reach the dashboard. Try again.",
    };
  }
}

type AddAction = (
  state: AddRepositoriesState,
  formData: FormData,
) => Promise<AddRepositoriesState>;

/** Not login fields: these keep password managers off a text input. */
const NOT_A_CREDENTIAL = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const INPUT =
  "border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr h-[34px] rounded-lg border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1";

const PRIMARY_BUTTON =
  "border-ink bg-ink text-ground hover:bg-ink-soft h-[32px] cursor-pointer rounded-lg border px-[13px] text-[12.5px] font-medium disabled:cursor-default disabled:opacity-60";

const QUIET_BUTTON =
  "text-ink-muted hover:text-ink cursor-pointer px-2 text-[12.5px]";

/**
 * Picks repositories from the ones GitHub lets the viewer see, which are only
 * those the GitHub App is installed on, rather than
 * having them type `owner/name`. The list is read when the picker opens, not
 * with the page, so rendering the dashboard costs GitHub nothing.
 *
 * An organization may not let the app read its repositories at all, so the
 * picker also takes one typed in by hand. That one is never synced: it is
 * there to carry tasks.
 */
export function AddRepositories({
  source,
  action,
  manualAction,
  installUrl,
}: {
  /** Where the picker reads the viewer's repositories from. */
  source: string;
  action: AddAction;
  /** Adds a repository typed in by hand; without it, only picking is offered. */
  manualAction?: AddAction;
  /** GitHub's page for installing the app on more repositories, if known. */
  installUrl: string | null;
}) {
  const panelId = useId();
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "manual">("pick");
  const [listing, setListing] = useState<Listing>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // A successful add closes the picker; the page re-renders with the new rows,
  // which then sync on their own.
  const [state, formAction, pending] = useActionState(
    async (previous: AddRepositoriesState, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.error === null && next.added > 0) setOpen(false);
      return next;
    },
    EMPTY_ADD_STATE,
  );
  const toggleRef = useRef<HTMLButtonElement>(null);

  const load = () => {
    setListing({ status: "loading" });
    void fetchListing(source).then(setListing);
  };

  const show = () => {
    setOpen(true);
    setMode("pick");
    setSearch("");
    setSelected(new Set());
    load();
  };

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  const needle = search.trim().toLowerCase();
  const matches = (repository: PickableRepository) =>
    !needle || fullNameOf(repository).toLowerCase().includes(needle);

  const toggle = (fullName: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });

  return (
    <div className="relative" onKeyDown={onKeyDown}>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={open ? close : show}
        className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        <Plus aria-hidden="true" weight="bold" className="size-[15px]" />
        Add repositories
      </button>

      {open && mode === "manual" && manualAction ? (
        <AddManually
          id={panelId}
          action={manualAction}
          onAdded={() => setOpen(false)}
          onBack={() => setMode("pick")}
          onCancel={close}
        />
      ) : open ? (
        <form
          id={panelId}
          action={formAction}
          aria-label="Add repositories"
          className="border-hairline bg-surface absolute top-[40px] right-0 z-20 flex w-[min(520px,calc(100vw-32px))] flex-col gap-3 rounded-xl border p-3 shadow-lg"
        >
          <label htmlFor={searchId} className="sr-only">
            Search your repositories
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your repositories"
            autoFocus
            {...NOT_A_CREDENTIAL}
            className={INPUT}
          />

          {listing.status === "loading" ? (
            <p
              role="status"
              className="text-ink-muted flex items-center gap-1.5 px-1 py-4 text-[12.5px]"
            >
              <Spinner />
              Loading your repositories from GitHub…
            </p>
          ) : listing.status === "failed" ? (
            <div role="alert" className="flex flex-col items-start gap-2 px-1">
              <p className="text-issue-strong text-[12.5px]">{listing.error}</p>
              <button
                type="button"
                onClick={load}
                className="border-hairline text-ink hover:bg-surface-sunken cursor-pointer rounded-lg border px-[11px] py-1 text-[12px] font-medium"
              >
                Try again
              </button>
            </div>
          ) : listing.repositories.length === 0 ? (
            <p className="text-ink-muted px-1 py-4 text-[12.5px]">
              {installUrl
                ? "The app is not installed on any of your repositories yet."
                : "GitHub lists no repositories you can see."}
            </p>
          ) : (
            <ul className="divide-hairline-soft max-h-[320px] divide-y overflow-y-auto">
              {listing.repositories.map((repository) => {
                const fullName = fullNameOf(repository);
                // Filtered out rather than unmounted, so a ticked repository
                // is still sent after the search changes.
                return (
                  <li
                    key={fullName}
                    hidden={!matches(repository)}
                    className="py-1.5"
                  >
                    <label className="hover:bg-surface-sunken flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 has-disabled:cursor-default">
                      <input
                        type="checkbox"
                        name="repository"
                        value={fullName}
                        checked={repository.watched || selected.has(fullName)}
                        disabled={repository.watched}
                        onChange={() => toggle(fullName)}
                        className="accent-pr mt-0.5"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <span className="text-ink truncate font-mono text-[12.5px]">
                            {fullName}
                          </span>
                          {repository.isPrivate ? <Chip>Private</Chip> : null}
                          {repository.watched ? (
                            <Chip tone="healthy">Watching</Chip>
                          ) : null}
                        </span>
                        {repository.description ? (
                          <span className="text-ink-faint truncate text-[11.5px]">
                            {repository.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {state.error ? (
            <p role="alert" className="text-issue-strong text-[12px]">
              {state.error}
            </p>
          ) : null}

          <div className="border-hairline-soft flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex flex-col items-start gap-1">
              {installUrl ? (
                <a
                  href={installUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-pr text-[12px] underline-offset-2 hover:underline"
                >
                  Missing a repository? Install the app on it
                </a>
              ) : null}
              {manualAction ? (
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className="text-pr cursor-pointer text-[12px] underline-offset-2 hover:underline"
                >
                  Can&apos;t connect it? Add a repository manually
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={close} className={QUIET_BUTTON}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={selected.size === 0 || pending}
                className={PRIMARY_BUTTON}
              >
                {selected.size === 1
                  ? "Add 1 repository"
                  : `Add ${selected.size} repositories`}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Owner and name typed in by hand. Nothing is asked of GitHub, so nothing
 * checks the repository exists: the name only has to be one GitHub could have.
 */
function AddManually({
  id,
  action,
  onAdded,
  onBack,
  onCancel,
}: {
  id: string;
  action: AddAction;
  onAdded: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const ownerId = useId();
  const nameId = useId();
  const noteId = useId();
  const [state, formAction, pending] = useActionState(
    async (previous: AddRepositoriesState, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.error === null && next.added > 0) onAdded();
      return next;
    },
    EMPTY_ADD_STATE,
  );

  return (
    <form
      id={id}
      action={formAction}
      aria-label="Add a repository manually"
      aria-describedby={noteId}
      className="border-hairline bg-surface absolute top-[40px] right-0 z-20 flex w-[min(520px,calc(100vw-32px))] flex-col gap-3 rounded-xl border p-3 shadow-lg"
    >
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-ink text-[13.5px] font-semibold">
          Add a repository manually
        </h2>
        <p id={noteId} className="text-ink-muted text-[12px] leading-relaxed">
          For a repository Fenro can&apos;t read from GitHub. It shows up in
          your list and can have tasks, but Fenro won&apos;t fetch its pull
          requests or issues.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={ownerId} className="text-ink-soft text-[12px]">
            Owner
          </label>
          <input
            id={ownerId}
            name="owner"
            required
            autoFocus
            placeholder="acme"
            spellCheck={false}
            {...NOT_A_CREDENTIAL}
            className={`${INPUT} font-mono`}
          />
        </div>
        <span
          aria-hidden="true"
          className="text-ink-faint hidden pb-2 font-mono text-[13px] sm:block"
        >
          /
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={nameId} className="text-ink-soft text-[12px]">
            Repository
          </label>
          <input
            id={nameId}
            name="name"
            required
            placeholder="billing-service"
            spellCheck={false}
            {...NOT_A_CREDENTIAL}
            className={`${INPUT} font-mono`}
          />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-issue-strong px-1 text-[12px]">
          {state.error}
        </p>
      ) : null}

      <div className="border-hairline-soft flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <button
          type="button"
          onClick={onBack}
          className="text-pr cursor-pointer text-[12px] underline-offset-2 hover:underline"
        >
          Back to your GitHub repositories
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className={QUIET_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            Add repository
          </button>
        </div>
      </div>
    </form>
  );
}
