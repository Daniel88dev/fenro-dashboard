import type {
  RepositoryInsightsReader,
  InsightsUnavailable,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import { RepositoryCoordinates } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, isErr, type Result } from "@/shared/domain";

import type { PullRequestChecks } from "./read-models";

export type PullRequestChecksResult = Result<
  PullRequestChecks | null,
  InsightsUnavailable
>;

export type PullRequestChecksQuery = Query<
  "github-insights.pull-request-checks",
  PullRequestChecksResult
> & {
  readonly owner: string;
  readonly name: string;
  readonly number: number;
};

export function pullRequestChecksQuery(
  owner: string,
  name: string,
  number: number,
): PullRequestChecksQuery {
  return { type: "github-insights.pull-request-checks", owner, name, number };
}

export class PullRequestChecksHandler implements QueryHandler<
  PullRequestChecksQuery,
  PullRequestChecksResult
> {
  constructor(private readonly insights: RepositoryInsightsReader) {}

  async handle(
    query: PullRequestChecksQuery,
  ): Promise<PullRequestChecksResult> {
    const coordinates = RepositoryCoordinates.create(query.owner, query.name);
    if (isErr(coordinates)) {
      return err({
        code: "insights-unavailable",
        message: coordinates.error.message,
      });
    }
    return this.insights.pullRequestChecks(coordinates.value, query.number);
  }
}
