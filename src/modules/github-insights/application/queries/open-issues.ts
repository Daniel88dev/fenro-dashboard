import type {
  RepositoryInsightsReader,
  InsightsUnavailable,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import { RepositoryCoordinates } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, isErr, type Result } from "@/shared/domain";

import type { OpenIssues } from "./read-models";

export type OpenIssuesResult = Result<OpenIssues, InsightsUnavailable>;

export type OpenIssuesQuery = Query<
  "github-insights.open-issues",
  OpenIssuesResult
> & {
  readonly owner: string;
  readonly name: string;
};

export function openIssuesQuery(owner: string, name: string): OpenIssuesQuery {
  return { type: "github-insights.open-issues", owner, name };
}

export class OpenIssuesHandler implements QueryHandler<
  OpenIssuesQuery,
  OpenIssuesResult
> {
  constructor(private readonly insights: RepositoryInsightsReader) {}

  async handle(query: OpenIssuesQuery): Promise<OpenIssuesResult> {
    const coordinates = RepositoryCoordinates.create(query.owner, query.name);
    if (isErr(coordinates)) {
      return err({
        code: "insights-unavailable",
        message: coordinates.error.message,
      });
    }
    return this.insights.openIssues(coordinates.value);
  }
}
