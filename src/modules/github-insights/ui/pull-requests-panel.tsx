import type { ReactNode } from "react";

import type {
  OpenPullRequests,
  PullRequestSummary,
} from "@/modules/github-insights/application/queries/read-models";

import { Chip } from "./chip";
import { formatAbsolute, formatAge } from "./format";
import { MoreOnGitHub, Panel } from "./panel";
import { ToggleButton } from "./toggle-button";
import { reviewTone, rollupClass } from "./tones";

export type PullRequestView = {
  readonly summary: PullRequestSummary;
  readonly expanded: boolean;
  readonly href: string;
  readonly checksId: string;
  /**
   * The checks view, rendered by the caller behind its own loading and error
   * states, so an open pull request streams in without holding up the panel.
   */
  readonly checks: ReactNode;
};

export function PullRequestsPanel({
  id,
  owner,
  name,
  data,
  views,
  now,
}: {
  id: string;
  owner: string;
  name: string;
  data: OpenPullRequests;
  views: readonly PullRequestView[];
  now: Date;
}) {
  const repositoryUrl = `https://github.com/${owner}/${name}`;
  const hidden = data.totalOpen - data.shown.length;

  return (
    <Panel
      id={id}
      title="Open pull requests"
      summary={data.summary}
      footer={
        hidden > 0 ? (
          <MoreOnGitHub href={`${repositoryUrl}/pulls`}>
            {`Show the other ${hidden} pull request${hidden === 1 ? "" : "s"} on GitHub`}
          </MoreOnGitHub>
        ) : null
      }
    >
      {views.map(({ summary, expanded, href, checksId, checks }) => (
        <div
          key={summary.number}
          className="border-hairline bg-surface rounded-[9px] border"
        >
          <ToggleButton
            label={`Checks for pull request ${summary.number}, ${summary.title}`}
            href={href}
            expanded={expanded}
            controls={checksId}
            className="hover:bg-surface-raised flex w-full items-center gap-3 px-[13px] py-2.5 text-left"
          >
            <span className="text-ink-faint w-[54px] shrink-0 font-mono text-[12.5px]">
              #{summary.number}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-ink truncate text-[13px]">
                {summary.title}
              </span>
              <span className="text-ink-muted text-[11.5px]">
                {summary.author} ·{" "}
                <time
                  dateTime={summary.openedAt.toISOString()}
                  title={formatAbsolute(summary.openedAt)}
                >
                  {formatAge(summary.openedAt, now)}
                </time>
              </span>
            </span>
            <Chip tone={reviewTone(summary.reviewState)}>
              {summary.reviewLabel}
            </Chip>
            <span
              className={`w-[72px] shrink-0 text-right text-[11.5px] ${rollupClass(summary.checkRollup)}`}
            >
              {summary.checkSummary}
            </span>
          </ToggleButton>

          {expanded ? checks : null}
        </div>
      ))}
    </Panel>
  );
}
