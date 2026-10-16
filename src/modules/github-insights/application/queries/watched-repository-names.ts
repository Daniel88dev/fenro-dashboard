import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";

export type WatchedRepositoryName = {
  readonly fullName: string;
  readonly pinned: boolean;
};

export type WatchedRepositoryNamesQuery = Query<
  "github-insights.watched-repository-names",
  WatchedRepositoryName[]
> & {
  readonly watcher: Watcher;
};

export function watchedRepositoryNamesQuery(
  watcher: Watcher,
): WatchedRepositoryNamesQuery {
  return { type: "github-insights.watched-repository-names", watcher };
}

export class WatchedRepositoryNamesHandler implements QueryHandler<
  WatchedRepositoryNamesQuery,
  WatchedRepositoryName[]
> {
  constructor(private readonly repositories: WatchedRepositoryRepository) {}

  async handle(
    query: WatchedRepositoryNamesQuery,
  ): Promise<WatchedRepositoryName[]> {
    const watched = await this.repositories.findAllFor(query.watcher.id);
    return watched
      .map((repository) => ({
        fullName: repository.coordinates.fullName,
        pinned: repository.isPinned,
      }))
      .sort(
        (one, other) =>
          Number(other.pinned) - Number(one.pinned) ||
          one.fullName.localeCompare(other.fullName),
      );
  }
}
