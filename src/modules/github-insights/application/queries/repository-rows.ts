import type {
  RepositoryInsightsReader,
  InsightsUnavailable,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { isErr, ok, type Result } from "@/shared/domain";

import type { RepositoryRow } from "./read-models";

export type RepositoryRowsResult = Result<RepositoryRow[], InsightsUnavailable>;

export type RepositoryRowsQuery = Query<
  "github-insights.repository-rows",
  RepositoryRowsResult
>;

export function repositoryRowsQuery(): RepositoryRowsQuery {
  return { type: "github-insights.repository-rows" };
}

/**
 * The write side owns which repositories are watched; the reader owns what is
 * happening inside them. A repository nobody has counts for yet still gets a
 * row, with zeroes, so watching one is visible immediately.
 */
export async function loadRepositoryRows(
  repositories: WatchedRepositoryRepository,
  insights: RepositoryInsightsReader,
): Promise<RepositoryRowsResult> {
  const watched = await repositories.findAll();
  const counts = await insights.countsFor(
    watched.map((repository) => repository.coordinates),
  );
  if (isErr(counts)) return counts;

  const byFullName = new Map(
    counts.value.map((count) => [`${count.owner}/${count.name}`, count]),
  );

  return ok(
    watched.map((repository) => {
      const { owner, name, fullName } = repository.coordinates;
      const count = byFullName.get(fullName);
      return {
        id: repository.id.value,
        owner,
        name,
        openPullRequests: count?.openPullRequests ?? 0,
        openIssues: count?.openIssues ?? 0,
        pullRequestHint: count?.pullRequestHint ?? "nothing open",
        issueHint: count?.issueHint ?? "nothing open",
        lastActivityAt: count?.lastActivityAt ?? null,
      };
    }),
  );
}

export class RepositoryRowsHandler implements QueryHandler<
  RepositoryRowsQuery,
  RepositoryRowsResult
> {
  constructor(
    private readonly repositories: WatchedRepositoryRepository,
    private readonly insights: RepositoryInsightsReader,
  ) {}

  handle(): Promise<RepositoryRowsResult> {
    return loadRepositoryRows(this.repositories, this.insights);
  }
}
