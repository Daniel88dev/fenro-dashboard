import type {
  InsightsUnavailable,
  RepositoryInsightsReader,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { isErr, type Result } from "@/shared/domain";

import type { PullRequestChecks } from "./read-models";
import { findWatched } from "./watched-lookup";

export type PullRequestChecksResult = Result<
  PullRequestChecks | null,
  InsightsUnavailable
>;

export type PullRequestChecksQuery = Query<
  "github-insights.pull-request-checks",
  PullRequestChecksResult
> & {
  readonly watcher: Watcher;
  readonly owner: string;
  readonly name: string;
  readonly number: number;
};

export function pullRequestChecksQuery(
  watcher: Watcher,
  owner: string,
  name: string,
  number: number,
): PullRequestChecksQuery {
  return {
    type: "github-insights.pull-request-checks",
    watcher,
    owner,
    name,
    number,
  };
}

export class PullRequestChecksHandler implements QueryHandler<
  PullRequestChecksQuery,
  PullRequestChecksResult
> {
  constructor(
    private readonly repositories: WatchedRepositoryRepository,
    private readonly insights: RepositoryInsightsReader,
  ) {}

  async handle(
    query: PullRequestChecksQuery,
  ): Promise<PullRequestChecksResult> {
    const watched = await findWatched(
      this.repositories,
      query.watcher,
      query.owner,
      query.name,
    );
    if (isErr(watched)) return watched;
    return this.insights.pullRequestChecks(
      query.watcher,
      watched.value.id.value,
      query.number,
    );
  }
}
