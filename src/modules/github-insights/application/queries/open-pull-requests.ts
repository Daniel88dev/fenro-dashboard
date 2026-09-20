import type {
  RepositoryInsightsReader,
  InsightsUnavailable,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import { RepositoryCoordinates } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, isErr, type Result } from "@/shared/domain";

import type { OpenPullRequests } from "./read-models";

export type OpenPullRequestsResult = Result<
  OpenPullRequests,
  InsightsUnavailable
>;

export type OpenPullRequestsQuery = Query<
  "github-insights.open-pull-requests",
  OpenPullRequestsResult
> & {
  readonly owner: string;
  readonly name: string;
};

export function openPullRequestsQuery(
  owner: string,
  name: string,
): OpenPullRequestsQuery {
  return { type: "github-insights.open-pull-requests", owner, name };
}

export class OpenPullRequestsHandler implements QueryHandler<
  OpenPullRequestsQuery,
  OpenPullRequestsResult
> {
  constructor(private readonly insights: RepositoryInsightsReader) {}

  async handle(query: OpenPullRequestsQuery): Promise<OpenPullRequestsResult> {
    const coordinates = RepositoryCoordinates.create(query.owner, query.name);
    if (isErr(coordinates)) {
      return err({
        code: "insights-unavailable",
        message: coordinates.error.message,
      });
    }
    return this.insights.openPullRequests(coordinates.value);
  }
}
