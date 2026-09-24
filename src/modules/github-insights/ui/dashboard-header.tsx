import { Clock, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import Form from "next/form";

import type { DashboardTotals } from "@/modules/github-insights/application/queries/read-models";

import { AddRepositories, type AddRepositoriesState } from "./add-repositories";
import { formatAbsolute, formatRelativeTime } from "./format";
import { SyncStatus } from "./sync-status";

/** One labelled number; the labels replace the old dotted totals line. */
function Stat({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className: string;
}) {
  return (
    <div className="border-hairline flex flex-col gap-0.5 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0">
      <dt className="text-ink-muted text-[12px]">{label}</dt>
      <dd
        className={`order-first font-mono text-[22px] leading-tight ${className}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function DashboardHeader({
  totals,
  openTasks,
  filter,
  now,
  addAction,
  repositoriesSource,
  accessSettingsUrl,
}: {
  totals: DashboardTotals;
  openTasks: number;
  filter: string;
  now: Date;
  addAction: (
    state: AddRepositoriesState,
    formData: FormData,
  ) => Promise<AddRepositoriesState>;
  repositoriesSource: string;
  accessSettingsUrl: string | null;
}) {
  const add = (
    <AddRepositories
      source={repositoriesSource}
      action={addAction}
      accessSettingsUrl={accessSettingsUrl}
    />
  );

  // With nothing watched, the empty state carries the one action; the stats,
  // the sync line and the filter would only describe nothing.
  if (totals.watchedRepositories === 0) {
    return (
      <header>
        <h1 className="text-ink text-[24px] leading-tight font-semibold tracking-tight">
          Repositories
        </h1>
      </header>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3.5">
          <h1 className="text-ink text-[24px] leading-tight font-semibold tracking-tight">
            Repositories
          </h1>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:gap-0">
            <Stat
              value={totals.openPullRequests}
              label="open pull requests"
              className="text-pr"
            />
            <Stat
              value={totals.openIssues}
              label="open issues"
              className="text-issue"
            />
            <Stat value={openTasks} label="tasks" className="text-ink" />
            <Stat
              value={totals.watchedRepositories}
              label={
                totals.watchedRepositories === 1
                  ? "repository watched"
                  : "repositories watched"
              }
              className="text-ink-soft"
            />
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SyncStatus
            syncedAt={totals.syncedAt}
            neverSynced={totals.neverSynced}
            watched={totals.watchedRepositories}
            now={now}
          />
          <Form
            action="/repositories"
            className="border-hairline bg-surface focus-within:outline-pr order-first flex h-[34px] w-full min-w-0 items-center gap-2 rounded-lg border px-[11px] focus-within:outline-2 focus-within:outline-offset-1 sm:order-none sm:w-[200px]"
          >
            <MagnifyingGlass
              aria-hidden="true"
              className="text-ink-faint size-[15px] shrink-0"
            />
            <label htmlFor="repository-filter" className="sr-only">
              Filter repositories
            </label>
            <input
              id="repository-filter"
              name="q"
              type="search"
              defaultValue={filter}
              placeholder="Filter repositories"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              className="text-ink placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </Form>
          {add}
        </div>
      </header>

      {totals.rateLimited ? (
        <RateLimitBanner syncedAt={totals.syncedAt} now={now} />
      ) : null}
    </>
  );
}

/**
 * Said once, above the table, instead of squeezed into the header: the
 * numbers below are still the last ones GitHub gave.
 */
export function RateLimitBanner({
  syncedAt,
  now,
}: {
  syncedAt: Date | null;
  now: Date;
}) {
  return (
    <p
      role="status"
      className="bg-issue-wash text-issue-strong flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[12.5px] sm:items-center"
    >
      <Clock aria-hidden="true" className="mt-px size-4 shrink-0 sm:mt-0" />
      <span>
        <strong className="font-semibold">
          GitHub&apos;s rate limit is used up.
        </strong>{" "}
        {syncedAt === null ? (
          "Nothing has synced yet."
        ) : (
          <>
            These numbers are from{" "}
            <time
              dateTime={syncedAt.toISOString()}
              title={formatAbsolute(syncedAt)}
            >
              {formatRelativeTime(syncedAt, now)}
            </time>
            .
          </>
        )}{" "}
        Fenro waits 15 minutes before it tries again.
      </span>
    </p>
  );
}
