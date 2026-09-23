import type {
  InsightsUnavailable,
  RepositoryInsightsReader,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { isErr, type Result } from "@/shared/domain";

import {
  NO_ISSUE_FILTER,
  type IssueFilter,
  type OpenIssues,
} from "./read-models";
import { findWatched } from "./watched-lookup";

export type OpenIssuesResult = Result<OpenIssues, InsightsUnavailable>;

export type OpenIssuesQuery = Query<
  "github-insights.open-issues",
  OpenIssuesResult
> & {
  readonly watcher: Watcher;
  readonly owner: string;
  readonly name: string;
  readonly filter: IssueFilter;
};

export function openIssuesQuery(
  watcher: Watcher,
  owner: string,
  name: string,
  filter: IssueFilter = NO_ISSUE_FILTER,
): OpenIssuesQuery {
  return { type: "github-insights.open-issues", watcher, owner, name, filter };
}

export class OpenIssuesHandler implements QueryHandler<
  OpenIssuesQuery,
  OpenIssuesResult
> {
  constructor(
    private readonly repositories: WatchedRepositoryRepository,
    private readonly insights: RepositoryInsightsReader,
  ) {}

  async handle(query: OpenIssuesQuery): Promise<OpenIssuesResult> {
    const watched = await findWatched(
      this.repositories,
      query.watcher,
      query.owner,
      query.name,
    );
    if (isErr(watched)) return watched;
    return this.insights.openIssues(
      query.watcher,
      watched.value.id.value,
      query.filter,
    );
  }
}
