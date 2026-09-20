import type { OpenIssues } from "@/modules/github-insights/application/queries/read-models";

import { Chip } from "./chip";
import { formatAbsolute, formatAge } from "./format";
import { MoreOnGitHub, Panel } from "./panel";
import { labelTone } from "./tones";

export function IssuesPanel({
  id,
  owner,
  name,
  data,
  now,
}: {
  id: string;
  owner: string;
  name: string;
  data: OpenIssues;
  now: Date;
}) {
  const repositoryUrl = `https://github.com/${owner}/${name}`;
  const hidden = data.totalOpen - data.shown.length;

  return (
    <Panel
      id={id}
      title="Open issues"
      summary={data.summary}
      footer={
        hidden > 0 ? (
          <MoreOnGitHub href={`${repositoryUrl}/issues`}>
            {`Show the other ${hidden} issue${hidden === 1 ? "" : "s"} on GitHub`}
          </MoreOnGitHub>
        ) : null
      }
    >
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
