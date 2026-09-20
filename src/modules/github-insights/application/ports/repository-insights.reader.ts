import type { RepositoryCoordinates } from "@/modules/github-insights/domain";
import type { Result } from "@/shared/domain";

import type {
  OpenIssues,
  OpenPullRequests,
  PullRequestChecks,
  RepositoryCounts,
} from "../queries/read-models";

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
 * Everything the query side reads about a repository it does not own. Whether
 * the implementation calls GitHub per request or serves a synced snapshot is
 * ticket 05's to decide; this port is what keeps that decision swappable.
 */
export interface RepositoryInsightsReader {
  countsFor(
    coordinates: readonly RepositoryCoordinates[],
  ): Promise<Result<RepositoryCounts[], InsightsUnavailable>>;

  openPullRequests(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<OpenPullRequests, InsightsUnavailable>>;

  pullRequestChecks(
    coordinates: RepositoryCoordinates,
    number: number,
  ): Promise<Result<PullRequestChecks | null, InsightsUnavailable>>;

  openIssues(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<OpenIssues, InsightsUnavailable>>;
}
