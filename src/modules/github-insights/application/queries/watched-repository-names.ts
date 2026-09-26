import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";

export type WatchedRepositoryName = {
  /** `owner/name`, spelled as GitHub spells it. */
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

/**
 * The repositories a watcher can point a task at. Only names: unlike the
 * table's rows this needs no snapshot, so it never waits on the reader.
 * Ordered as the table is, pinned first and then alphabetically.
 */
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
