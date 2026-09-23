import type { Result } from "@/shared/domain";

import type {
  IssueFilter,
  OpenIssues,
  OpenPullRequests,
  PullRequestChecks,
  RepositoryCounts,
} from "../queries/read-models";
import type { Watcher } from "./viewer";

/**
 * Failures a panel can render without taking the table down. A plain object
 * rather than an `Error`, because it travels inside a `Result` that a server
 * component hands to the client.
 */
export type InsightsUnavailable = {
  readonly code: "insights-unavailable";
  readonly message: string;
};

export function insightsUnavailable(message: string): InsightsUnavailable {
  return { code: "insights-unavailable", message };
}

/**
 * Everything the query side reads about the repositories a watcher follows,
 * keyed by the watched repository's id. Ticket 05 settled on a synced
 * snapshot, so the implementation reads what the last sync stored and never
 * calls GitHub; this port is what would keep a live read swappable in.
 *
 * A repository never synced has no counts and empty panels, rather than an
 * error: watching one is visible before its first sync lands.
 */
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
