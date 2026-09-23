import type {
  IssueFilter,
  OpenIssues,
} from "@/modules/github-insights/application/queries/read-models";

import { Chip } from "./chip";
import { FilterChip } from "./filter-chip";
import { formatAbsolute, formatAge } from "./format";
import { MoreOnGitHub, Panel } from "./panel";
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
      summary={data.summary}
      footer={
        partial ? (
          <span className="text-ink-muted">
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
          className="flex flex-wrap gap-1.5 pb-1"
        >
          {chips.map((chip) => (
            <FilterChip key={chip.label} {...chip} />
          ))}
        </div>
      ) : null}

      {filtered && data.shown.length === 0 ? (
        <p className="text-ink-muted px-0.5 py-2 text-[12px]">
          {data.complete
            ? "No open issue matches these filters."
            : `None of the ${data.stored} most recently updated issues matches these filters.`}
        </p>
      ) : null}

      {data.shown.map((issue) => (
        <div
          key={issue.number}
          className="border-hairline bg-surface flex items-center gap-3 rounded-[9px] border px-[13px] py-2.5"
        >
          <span className="text-ink-faint w-[54px] shrink-0 font-mono text-[12.5px]">
            #{issue.number}
          </span>
          <span className="text-ink min-w-0 flex-1 truncate text-[13px]">
            {issue.title}
          </span>
          {issue.label ? (
            <Chip tone={labelTone(issue.label)}>{issue.label}</Chip>
          ) : null}
          <span className="text-ink-muted w-[68px] shrink-0 text-right text-[11.5px]">
            open{" "}
            <time
              dateTime={issue.openedAt.toISOString()}
              title={formatAbsolute(issue.openedAt)}
            >
              {formatAge(issue.openedAt, now)}
            </time>
          </span>
          <span className="text-ink-faint w-[72px] shrink-0 text-right text-[11.5px]">
            {issue.assignee ?? "nobody"}
          </span>
        </div>
      ))}
    </Panel>
  );
}
