import type {
  IssueFilter,
  OpenIssues,
} from "@/modules/github-insights/application/queries/read-models";

import { Chip } from "./chip";
import { FilterChip } from "./filter-chip";
import { formatAbsolute, formatAge } from "./format";
import {
  GitHubNumberLink,
  MoreOnGitHub,
  OpenOnGitHub,
  Panel,
  PanelList,
  PanelSummary,
} from "./panel";
import { labelTone } from "./tones";

export type IssueChipView = {
  readonly label: string;
  readonly href: string;
  readonly pressed: boolean;
};

function isFiltered(filter: IssueFilter): boolean {
  return (
    filter.assignedToMe || filter.needsTriage || filter.order !== "attention"
  );
}

/** The same narrowing as GitHub's own issue search, for the rest of the list. */
export function gitHubIssueSearchUrl(
  owner: string,
  name: string,
  filter: IssueFilter,
): string {
  const terms = ["is:issue", "is:open"];
  if (filter.assignedToMe) terms.push("assignee:@me");
  if (filter.needsTriage) terms.push("no:label");
  if (filter.order === "oldest") terms.push("sort:created-asc");
  return `https://github.com/${owner}/${name}/issues?q=${encodeURIComponent(terms.join(" "))}`;
}

function plural(count: number): string {
  return `${count} issue${count === 1 ? "" : "s"}`;
}

export function IssuesPanel({
  id,
  owner,
  name,
  data,
  filter,
  chips,
  now,
}: {
  id: string;
  owner: string;
  name: string;
  data: OpenIssues;
  filter: IssueFilter;
  chips: readonly IssueChipView[];
  now: Date;
}) {
  const filtered = isFiltered(filter);
  const searchUrl = gitHubIssueSearchUrl(owner, name, filter);
  // Unfiltered, GitHub's own total says how many are left. Filtered, only the
  // stored issues were looked at, so the count is exact only when the last
  // sync stored every open issue.
  const hidden = filtered
    ? data.matching - data.shown.length
    : data.totalOpen - data.shown.length;
  const partial = filtered && !data.complete;

  return (
    <Panel
      id={id}
      title="Open issues"
      summary={<PanelSummary>{data.summary}</PanelSummary>}
      action={
        <OpenOnGitHub
          href={`https://github.com/${owner}/${name}/issues`}
          what={`issues in ${owner}/${name}`}
        />
      }
      footer={
        partial ? (
          <span>
            {`Filtered from the ${data.stored} most recently updated of ${data.totalOpen} open issues. `}
            <MoreOnGitHub href={searchUrl}>
              See every match on GitHub
            </MoreOnGitHub>
          </span>
        ) : hidden > 0 ? (
          <MoreOnGitHub href={searchUrl}>
            {`Show the other ${plural(hidden)} on GitHub`}
          </MoreOnGitHub>
        ) : null
      }
    >
      {chips.length > 0 && data.totalOpen > 0 ? (
        <div
          role="group"
          aria-label={`Filter the open issues in ${owner}/${name}`}
          className="flex flex-wrap gap-1.5"
        >
          {chips.map((chip) => (
            <FilterChip key={chip.label} {...chip} />
          ))}
        </div>
      ) : null}

      {filtered && data.shown.length === 0 ? (
        <p className="text-ink-muted py-1 text-[12.5px]">
          {data.complete
            ? "No open issue matches these filters."
            : `None of the ${data.stored} most recently updated issues matches these filters.`}
        </p>
      ) : null}

      {data.shown.length > 0 ? (
        <PanelList>
          {data.shown.map((issue) => (
            <li
              key={issue.number}
              className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2 pr-3.5 pl-2 md:grid-cols-[64px_minmax(0,1fr)_auto_80px_72px]"
            >
              <GitHubNumberLink
                href={`https://github.com/${owner}/${name}/issues/${issue.number}`}
                number={issue.number}
                kind="issue"
              />
              <span className="text-ink truncate text-[13.5px]">
                {issue.title}
              </span>
              <span className="col-start-2 flex items-center gap-3 md:contents">
                {issue.label ? (
                  <Chip tone={labelTone(issue.label)}>{issue.label}</Chip>
                ) : (
                  <span className="hidden md:block" />
                )}
                <span className="text-ink-muted text-[12px] md:text-right">
                  open{" "}
                  <time
                    dateTime={issue.openedAt.toISOString()}
                    title={formatAbsolute(issue.openedAt)}
                  >
                    {formatAge(issue.openedAt, now)}
                  </time>
                </span>
                <span className="text-ink-muted font-mono text-[12px] md:text-right">
                  {issue.assignee ?? "nobody"}
                </span>
              </span>
            </li>
          ))}
        </PanelList>
      ) : null}
    </Panel>
  );
}
