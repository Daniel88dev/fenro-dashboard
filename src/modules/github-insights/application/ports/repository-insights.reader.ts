import type { Result } from "@/shared/domain";

import type {
  IssueFilter,
  OpenIssues,
  OpenPullRequests,
  PullRequestChecks,
  RepositoryCounts,
} from "../queries/read-models";
import type { Watcher } from "./viewer";

// A plain object rather than an `Error`: it travels inside a `Result` that a
// server component hands to the client.
export type InsightsUnavailable = {
  readonly code: "insights-unavailable";
  readonly message: string;
};

export function insightsUnavailable(message: string): InsightsUnavailable {
  return { code: "insights-unavailable", message };
}

export interface RepositoryInsightsReader {
  countsFor(
    watcher: Watcher,
    repositoryIds: readonly string[],
  ): Promise<Result<RepositoryCounts[], InsightsUnavailable>>;

  openPullRequests(
    watcher: Watcher,
    repositoryId: string,
  ): Promise<Result<OpenPullRequests, InsightsUnavailable>>;

  pullRequestChecks(
    watcher: Watcher,
    repositoryId: string,
    number: number,
  ): Promise<Result<PullRequestChecks | null, InsightsUnavailable>>;

  openIssues(
    watcher: Watcher,
    repositoryId: string,
    filter: IssueFilter,
  ): Promise<Result<OpenIssues, InsightsUnavailable>>;
}
