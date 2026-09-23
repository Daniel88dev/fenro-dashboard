"use client";

import {
  useActionState,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Chip } from "./chip";
import { Spinner } from "./sync-status";

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

/**
 * Picks repositories from the ones GitHub lets the viewer see, rather than
 * having them type `owner/name`. The list is read when the picker opens, not
 * with the page, so rendering the dashboard costs GitHub nothing.
 */
export function AddRepositories({
  source,
  action,
  accessSettingsUrl,
}: {
  /** Where the picker reads the viewer's repositories from. */
  source: string;
  action: (
    state: AddRepositoriesState,
    formData: FormData,
  ) => Promise<AddRepositoriesState>;
  /** GitHub's page for granting an organization's access, if known. */
  accessSettingsUrl: string | null;
}) {
  const panelId = useId();
  const searchId = useId();
  const [open, setOpen] = useState(false);
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
        className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr h-[34px] cursor-pointer rounded-[9px] border px-[13px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        Add repositories
      </button>

      {open ? (
        <form
          id={panelId}
          action={formAction}
          aria-label="Add repositories"
          className="border-hairline bg-surface absolute top-[40px] right-0 z-20 flex w-[min(520px,calc(100vw-32px))] flex-col gap-3 rounded-[12px] border p-3 shadow-lg"
        >
          <label htmlFor={searchId} className="sr-only">
            Search your repositories
          </label>
          {/* Not a login field: the attributes keep password managers off it. */}
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your repositories"
            autoComplete="off"
            autoFocus
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr h-[34px] rounded-[9px] border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
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
                className="border-hairline text-ink hover:bg-surface-sunken cursor-pointer rounded-[9px] border px-[11px] py-1 text-[12px] font-medium"
              >
                Try again
              </button>
            </div>
          ) : listing.repositories.length === 0 ? (
            <p className="text-ink-muted px-1 py-4 text-[12.5px]">
              GitHub lists no repositories you can see.
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
            {accessSettingsUrl ? (
              <a
                href={accessSettingsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-pr text-[12px] underline-offset-2 hover:underline"
              >
                Missing an organization? Grant access on GitHub
              </a>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="text-ink-muted hover:text-ink cursor-pointer px-2 text-[12.5px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={selected.size === 0 || pending}
                className="border-ink bg-ink text-ground hover:bg-ink-soft h-[32px] cursor-pointer rounded-[9px] border px-[13px] text-[12.5px] font-medium disabled:cursor-default disabled:opacity-60"
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
