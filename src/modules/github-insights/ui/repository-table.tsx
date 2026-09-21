import type { ReactNode } from "react";

import { CountToggle } from "./count-toggle";
import { formatAbsolute, formatRelativeTime } from "./format";

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
  readonly pullRequests: ColumnToggle;
  readonly issues: ColumnToggle;
  readonly tasks: ColumnToggle;
  /** The panels this row currently has open, already rendered. */
  readonly panels: readonly {
    readonly key: string;
    readonly node: ReactNode;
  }[];
};

const GRID =
  "grid grid-cols-[minmax(0,1fr)_150px_150px_150px_132px] items-center gap-x-3 px-[18px]";

export function RepositoryTable({
  rows,
  now,
  unwatchAction,
}: {
  rows: readonly RepositoryRowView[];
  now: Date;
  unwatchAction?: (formData: FormData) => Promise<void>;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-hairline bg-surface overflow-hidden rounded-xl border">
        <p className="text-ink-muted px-[18px] py-10 text-center text-[13px]">
          Nothing watched yet. Add a repository as{" "}
          <span className="font-mono">owner/name</span> to see what is open in
          it.
        </p>
      </div>
    );
  }

  return (
    <div className="border-hairline bg-surface overflow-hidden rounded-xl border">
      <div
        className={`${GRID} border-hairline bg-surface-raised text-ink-muted border-b py-[11px] text-[11px] font-medium tracking-wide uppercase`}
      >
        <span>Repository</span>
        <span>Open PRs</span>
        <span>Issues</span>
        <span>Tasks</span>
        <span>Last activity</span>
      </div>

      <ul className="m-0 list-none p-0">
        {rows.map((row) => (
          <li key={row.id} className="border-hairline border-b last:border-b-0">
            <div className={`${GRID} py-[9px]`}>
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-ink truncate font-mono text-[14.5px]">
                    {row.name}
                  </span>
                  <span className="text-ink-muted truncate text-[11.5px]">
                    {row.owner}
                  </span>
                </div>
                {unwatchAction ? (
                  <form action={unwatchAction} className="ml-auto pr-3">
                    <input type="hidden" name="owner" value={row.owner} />
                    <input type="hidden" name="name" value={row.name} />
                    <button
                      type="submit"
                      className="text-ink-faint hover:bg-surface-sunken hover:text-issue-strong focus-visible:outline-pr cursor-pointer rounded-md px-2 py-1 text-[11.5px] focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Unwatch
                      <span className="sr-only">{` ${row.owner}/${row.name}`}</span>
                    </button>
                  </form>
                ) : null}
              </div>

              <CountToggle {...row.pullRequests} countClass="text-pr" />
              <CountToggle {...row.issues} countClass="text-issue" />
              <CountToggle {...row.tasks} countClass="text-ink" />

              <span className="text-ink-muted text-[12px]">
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
            </div>

            {row.panels.map((panel) => (
              <div key={panel.key}>{panel.node}</div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
