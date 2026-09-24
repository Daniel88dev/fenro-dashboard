import { CaretRight } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

import type {
  OpenPullRequests,
  PullRequestSummary,
} from "@/modules/github-insights/application/queries/read-models";

import { Chip } from "./chip";
import { formatAbsolute, formatAge } from "./format";
import {
  GitHubNumberLink,
  MoreOnGitHub,
  OpenOnGitHub,
  Panel,
  PanelList,
  PanelSummary,
} from "./panel";
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
      summary={<PanelSummary>{data.summary}</PanelSummary>}
      action={
        <OpenOnGitHub
          href={`${repositoryUrl}/pulls`}
          what={`pull requests in ${owner}/${name}`}
        />
      }
      footer={
        hidden > 0 ? (
          <MoreOnGitHub href={`${repositoryUrl}/pulls`}>
            {`Show the other ${hidden} pull request${hidden === 1 ? "" : "s"} on GitHub`}
          </MoreOnGitHub>
        ) : null
      }
    >
      <PanelList>
        {views.map(({ summary, expanded, href, checksId, checks }) => (
          <li key={summary.number}>
            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start pl-2 md:items-center">
              <span className="pt-2 md:pt-0">
                <GitHubNumberLink
                  href={`${repositoryUrl}/pull/${summary.number}`}
                  number={summary.number}
                  kind="pull request"
                />
              </span>
              <ToggleButton
                label={`Checks for pull request ${summary.number}, ${summary.title}`}
                href={href}
                expanded={expanded}
                controls={checksId}
                className="hover:bg-surface-raised grid w-full grid-cols-[minmax(0,1fr)_20px] items-center gap-x-3 gap-y-1.5 py-2.5 pr-3.5 pl-1 text-left focus-visible:-outline-offset-2 md:grid-cols-[minmax(0,1fr)_auto_104px_20px]"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-ink truncate text-[13.5px]">
                    {summary.title}
                  </span>
                  <span className="text-ink-muted text-[12px]">
                    <span className="font-mono">{summary.author}</span> opened{" "}
                    <time
                      dateTime={summary.openedAt.toISOString()}
                      title={formatAbsolute(summary.openedAt)}
                    >
                      {formatAge(summary.openedAt, now)}
                    </time>{" "}
                    ago
                  </span>
                </span>
                <span className="col-start-1 row-start-2 flex items-center gap-2.5 md:contents">
                  <Chip tone={reviewTone(summary.reviewState)}>
                    {summary.reviewLabel}
                  </Chip>
                  <span
                    className={`text-[12px] md:text-right ${rollupClass(summary.checkRollup)}`}
                  >
                    {summary.checkSummary}
                  </span>
                </span>
                <CaretRight
                  aria-hidden="true"
                  className={`text-ink-faint col-start-2 row-start-1 size-3.5 transition-transform duration-200 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none md:col-start-4 ${expanded ? "rotate-90" : ""}`}
                />
              </ToggleButton>
            </div>

            {expanded ? checks : null}
          </li>
        ))}
      </PanelList>
    </Panel>
  );
}
