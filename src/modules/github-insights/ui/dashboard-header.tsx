import Form from "next/form";

import type { DashboardTotals } from "@/modules/github-insights/application/queries/read-models";

import { SyncStatus } from "./sync-status";
import { AddRepositories, type AddRepositoriesState } from "./add-repositories";

function Total({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className: string;
}) {
  return (
    <span className="text-ink-muted text-[13px]">
      <span className={`font-mono text-[15px] font-medium ${className}`}>
        {value}
      </span>{" "}
      {label}
    </span>
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
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-ink text-[22px] font-semibold tracking-tight">
          Repositories
        </h1>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-ink-muted text-[13px]">
            {totals.watchedRepositories === 1
              ? "1 watched"
              : `${totals.watchedRepositories} watched`}
          </span>
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          <Total
            value={totals.openPullRequests}
            label="open pull requests"
            className="text-pr"
          />
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          <Total
            value={totals.openIssues}
            label="open issues"
            className="text-issue"
          />
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          <Total value={openTasks} label="tasks" className="text-ink" />
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <SyncStatus
          syncedAt={totals.syncedAt}
          neverSynced={totals.neverSynced}
          rateLimited={totals.rateLimited}
          watched={totals.watchedRepositories}
          now={now}
        />
        <Form action="/repositories" className="flex items-center">
          <label htmlFor="repository-filter" className="sr-only">
            Filter repositories
          </label>
          <input
            id="repository-filter"
            name="q"
            type="search"
            defaultValue={filter}
            placeholder="Filter"
            className="border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr h-[34px] w-[190px] rounded-[9px] border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
          />
        </Form>
        <AddRepositories
          source={repositoriesSource}
          action={addAction}
          accessSettingsUrl={accessSettingsUrl}
        />
      </div>
    </header>
  );
}
