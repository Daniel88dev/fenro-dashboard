import type {
  InsightsUnavailable,
  RepositoryInsightsReader,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { isErr, ok, type Result } from "@/shared/domain";

import type { RepositoryRow } from "./read-models";

export type RepositoryRowsResult = Result<RepositoryRow[], InsightsUnavailable>;

export type RepositoryRowsQuery = Query<
  "github-insights.repository-rows",
  RepositoryRowsResult
> & {
  readonly watcher: Watcher;
};

export function repositoryRowsQuery(watcher: Watcher): RepositoryRowsQuery {
  return { type: "github-insights.repository-rows", watcher };
}

/**
 * The write side owns which repositories are watched and how fresh their copy
 * is; the reader owns what is happening inside them. A repository nobody has
 * synced yet still gets a row, with zeroes, so watching one is visible
 * immediately.
 */
export async function loadRepositoryRows(
  repositories: WatchedRepositoryRepository,
  insights: RepositoryInsightsReader,
  watcher: Watcher,
  now: Date,
): Promise<RepositoryRowsResult> {
  const watched = await repositories.findAllFor(watcher.id);
  const counts = await insights.countsFor(
    watcher,
    watched.map((repository) => repository.id.value),
  );
  if (isErr(counts)) return counts;

  const byId = new Map(
    counts.value.map((count) => [count.repositoryId, count]),
  );

  return ok(
    watched
      .map((repository) => {
        const { owner, name } = repository.coordinates;
        const count = byId.get(repository.id.value);
        const { sync } = repository;
        return {
          id: repository.id.value,
          owner,
          name,
          openPullRequests: count?.openPullRequests ?? 0,
          openIssues: count?.openIssues ?? 0,
          pullRequestHint:
            count?.pullRequestHint ??
            (sync.lastSyncedAt ? "nothing open" : "not synced yet"),
          issueHint:
            count?.issueHint ??
            (sync.lastSyncedAt ? "nothing open" : "not synced yet"),
          lastActivityAt: count?.lastActivityAt ?? null,
          syncedAt: sync.lastSyncedAt,
          syncFailure: sync.lastFailure,
          rateLimited: sync.isRateLimited,
          needsSync: sync.isDueAutomatically(now),
        };
      })
      .sort((one, other) =>
        `${one.owner}/${one.name}`.localeCompare(
          `${other.owner}/${other.name}`,
        ),
      ),
  );
}

export class RepositoryRowsHandler implements QueryHandler<
  RepositoryRowsQuery,
  RepositoryRowsResult
> {
  constructor(
    private readonly repositories: WatchedRepositoryRepository,
    private readonly insights: RepositoryInsightsReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  handle(query: RepositoryRowsQuery): Promise<RepositoryRowsResult> {
    return loadRepositoryRows(
      this.repositories,
      this.insights,
      query.watcher,
      this.clock(),
    );
  }
}
