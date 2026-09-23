import type {
  InsightsUnavailable,
  RepositoryInsightsReader,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { isErr, type Result } from "@/shared/domain";

import type { OpenPullRequests } from "./read-models";
import { findWatched } from "./watched-lookup";

export type OpenPullRequestsResult = Result<
  OpenPullRequests,
  InsightsUnavailable
>;

export type OpenPullRequestsQuery = Query<
  "github-insights.open-pull-requests",
  OpenPullRequestsResult
> & {
  readonly watcher: Watcher;
  readonly owner: string;
  readonly name: string;
};

export function openPullRequestsQuery(
  watcher: Watcher,
  owner: string,
  name: string,
): OpenPullRequestsQuery {
  return { type: "github-insights.open-pull-requests", watcher, owner, name };
}

export class OpenPullRequestsHandler implements QueryHandler<
  OpenPullRequestsQuery,
  OpenPullRequestsResult
> {
  constructor(
    private readonly repositories: WatchedRepositoryRepository,
    private readonly insights: RepositoryInsightsReader,
  ) {}

  async handle(query: OpenPullRequestsQuery): Promise<OpenPullRequestsResult> {
    const watched = await findWatched(
      this.repositories,
      query.watcher,
      query.owner,
      query.name,
    );
    if (isErr(watched)) return watched;
    return this.insights.openPullRequests(
      query.watcher,
      watched.value.id.value,
    );
  }
}
