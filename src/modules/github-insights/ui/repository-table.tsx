import { WarningCircle } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

import { CountToggle } from "./count-toggle";
import { formatAbsolute, formatRelativeTime } from "./format";
import { RowMenu } from "./row-menu";
import { RowSyncIndicator, SyncProgressBar } from "./sync-status";

export type ColumnToggle = {
  readonly count: number;
  readonly hint: string;
  readonly label: string;
  readonly href: string;
  readonly expanded: boolean;
  readonly panelId: string;
};

export type RepositoryRowView = {
  readonly id: string;
  readonly owner: string;
  readonly name: string;
  readonly lastActivityAt: Date | null;
  /** Why the latest sync failed, while the counts are from an older one. */
  readonly syncFailure: string | null;
  /** The header already explains the rate limit; the row only points at it. */
  readonly rateLimited: boolean;
  readonly pullRequests: ColumnToggle;
  readonly issues: ColumnToggle;
  readonly tasks: ColumnToggle;
  /** The panels this row currently has open, already rendered. */
  readonly panels: readonly {
    readonly key: string;
    readonly node: ReactNode;
  }[];
};

/*
 * One grid, two arrangements. On a phone the name and the menu share the first
 * line and the three counts sit under it; from md up it is the table the
 * prototype drew. Areas rather than two copies of the row keep one element per
 * thing, so focus and tests see each count once.
 */
const GRID =
  "grid grid-cols-3 items-center gap-x-2 px-3.5 [grid-template-areas:'name_name_menu'_'prs_issues_tasks'] md:grid-cols-[minmax(0,1fr)_148px_148px_148px_112px_40px] md:pr-4 md:pl-5 md:[grid-template-areas:'name_prs_issues_tasks_activity_menu']";

export function RepositoryTable({
  rows,
  now,
  unwatchAction,
  emptyAction,
  filteredOut = false,
}: {
  rows: readonly RepositoryRowView[];
  now: Date;
  unwatchAction?: (formData: FormData) => Promise<void>;
  /** The Add repositories control, shown when nothing is watched yet. */
  emptyAction?: ReactNode;
  /** Rows are watched, but the filter hides every one of them. */
  filteredOut?: boolean;
}) {
  if (rows.length === 0 && filteredOut) {
    return (
      <p className="border-hairline bg-surface text-ink-muted rounded-xl border px-5 py-8 text-center text-[13px]">
        No watched repository matches this filter.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="border-hairline bg-surface flex flex-col gap-3 rounded-xl border px-6 py-10 md:px-12 md:py-14">
        <h2 className="text-ink text-[20px] font-semibold tracking-tight">
          Pick the repositories you want to follow
        </h2>
        <p className="text-ink-muted max-w-[440px] text-[13.5px] leading-relaxed">
          Fenro counts their open pull requests and issues, keeps a snapshot so
          the page loads fast, and lines up the tasks your agents run against
          each one.
        </p>
        {emptyAction ? <div className="mt-2 flex">{emptyAction}</div> : null}
      </section>
    );
  }

  return (
    <div className="border-hairline bg-surface relative rounded-xl border">
      <SyncProgressBar />
      <div
        className={`${GRID} border-hairline bg-surface-raised text-ink-muted hidden h-10 rounded-t-xl border-b text-[12px] font-medium md:grid`}
      >
        <span className="[grid-area:name]">Repository</span>
        <span className="[grid-area:prs]">Pull requests</span>
        <span className="[grid-area:issues]">Issues</span>
        <span className="[grid-area:tasks]">Tasks</span>
        <span className="[grid-area:activity]">Last activity</span>
      </div>

      <ul className="m-0 list-none p-0">
        {rows.map((row) => (
          <li
            key={row.id}
            className="group/row border-hairline border-b last:border-b-0"
          >
            <div
              className={`${GRID} gap-y-1.5 pt-3 pb-2.5 md:min-h-16 md:py-1.5`}
            >
              <div className="flex min-w-0 flex-col gap-0.5 [grid-area:name]">
                <span className="flex items-center gap-2">
                  <span className="text-ink truncate font-mono text-[14.5px] font-medium">
                    {row.name}
                  </span>
                  <RowSyncIndicator
                    repositoryId={row.id}
                    fullName={`${row.owner}/${row.name}`}
                  />
                </span>
                <span className="text-ink-muted truncate text-[12px]">
                  {row.owner}
                </span>
                {row.syncFailure ? (
                  <span
                    className="text-issue-strong flex items-center gap-1.5 text-[12px]"
                    title={row.syncFailure}
                  >
                    <WarningCircle
                      aria-hidden="true"
                      className="size-[13px] shrink-0"
                    />
                    <span className="truncate">
                      {row.rateLimited
                        ? "Not refreshed: rate limit used up"
                        : `Last sync failed: ${row.syncFailure}`}
                    </span>
                  </span>
                ) : null}
              </div>

              <div className="[grid-area:prs]">
                <CountToggle {...row.pullRequests} tone="pr" />
              </div>
              <div className="[grid-area:issues]">
                <CountToggle {...row.issues} tone="issue" />
              </div>
              <div className="[grid-area:tasks]">
                <CountToggle {...row.tasks} tone="neutral" />
              </div>

              <span className="text-ink-muted hidden text-[12.5px] [grid-area:activity] md:block">
                {row.lastActivityAt ? (
                  <time
                    dateTime={row.lastActivityAt.toISOString()}
                    title={formatAbsolute(row.lastActivityAt)}
                  >
                    {formatRelativeTime(row.lastActivityAt, now)}
                  </time>
                ) : (
                  "never"
                )}
              </span>

              <div className="justify-self-end [grid-area:menu]">
                <RowMenu
                  owner={row.owner}
                  name={row.name}
                  unwatchAction={unwatchAction}
                />
              </div>
            </div>

            {row.panels.map((panel) => (
              // The table cannot clip its corners (the row menus must spill
              // out of it), so the last row's last panel rounds its own.
              <div
                key={panel.key}
                className="group-last/row:last:overflow-hidden group-last/row:last:rounded-b-xl"
              >
                {panel.node}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
