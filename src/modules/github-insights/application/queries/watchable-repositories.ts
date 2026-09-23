import type {
  GitHubFailure,
  GitHubGateway,
  GitHubRepository,
} from "@/modules/github-insights/application/ports/github-gateway";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { map, type Result } from "@/shared/domain";

/** A repository the picker offers, and whether it is on the dashboard already. */
export type WatchableRepository = GitHubRepository & {
  readonly watched: boolean;
};

export type WatchableRepositoriesResult = Result<
  readonly WatchableRepository[],
  GitHubFailure
>;

export type WatchableRepositoriesQuery = Query<
  "github-insights.watchable-repositories",
  WatchableRepositoriesResult
> & {
  readonly watcherId: string;
};

export function watchableRepositoriesQuery(
  watcherId: string,
): WatchableRepositoriesQuery {
  return { type: "github-insights.watchable-repositories", watcherId };
}

/**
 * What the viewer could add to their dashboard: every repository GitHub lets
 * them see. It reads GitHub rather than the stored snapshot, because the
 * snapshot only holds what is watched already.
 */
export class WatchableRepositoriesHandler implements QueryHandler<
  WatchableRepositoriesQuery,
  WatchableRepositoriesResult
> {
  constructor(
    private readonly gitHub: GitHubGateway,
    private readonly repositories: WatchedRepositoryRepository,
  ) {}

  async handle(
    query: WatchableRepositoriesQuery,
  ): Promise<WatchableRepositoriesResult> {
    const [listed, watched] = await Promise.all([
      this.gitHub.listRepositories(),
      this.repositories.findAllFor(query.watcherId),
    ]);
    const watchedNames = new Set(
      watched.map((one) => one.coordinates.fullName.toLowerCase()),
    );

    return map(listed, (repositories) =>
      repositories.map((repository) => ({
        ...repository,
        watched: watchedNames.has(
          `${repository.owner}/${repository.name}`.toLowerCase(),
        ),
      })),
    );
  }
}
