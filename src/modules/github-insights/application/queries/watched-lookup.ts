import {
  insightsUnavailable,
  type InsightsUnavailable,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import {
  RepositoryCoordinates,
  type WatchedRepository,
  type WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import { err, isErr, ok, type Result } from "@/shared/domain";

/**
 * A panel names its repository by `owner/name`, from the URL. It only reads
 * what this watcher watches, so another user's snapshot is never one guess of
 * a URL away.
 */
export async function findWatched(
  repositories: WatchedRepositoryRepository,
  watcher: Watcher,
  owner: string,
  name: string,
): Promise<Result<WatchedRepository, InsightsUnavailable>> {
  const coordinates = RepositoryCoordinates.create(owner, name);
  if (isErr(coordinates)) {
    return err(insightsUnavailable(coordinates.error.message));
  }
  const watched = await repositories.findByCoordinates(
    watcher.id,
    coordinates.value,
  );
  if (!watched) {
    return err(
      insightsUnavailable(
        `You are not watching ${coordinates.value.fullName}.`,
      ),
    );
  }
  return ok(watched);
}
