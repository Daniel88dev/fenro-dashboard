import type {
  GitHubFailure,
  GitHubGateway,
} from "@/modules/github-insights/application/ports/github-gateway";
import { RepositoryCoordinates } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, isErr, map, type Result } from "@/shared/domain";

/** A repository as GitHub spells it. */
export type FoundRepository = {
  readonly owner: string;
  readonly name: string;
};

export type LookUpRepositoryResult = Result<
  FoundRepository,
  | GitHubFailure
  | { readonly code: "invalid-coordinates"; readonly message: string }
>;

export type LookUpRepositoryQuery = Query<
  "github-insights.look-up-repository",
  LookUpRepositoryResult
> & {
  readonly owner: string;
  readonly name: string;
};

export function lookUpRepositoryQuery(
  owner: string,
  name: string,
): LookUpRepositoryQuery {
  return { type: "github-insights.look-up-repository", owner, name };
}

/**
 * Asks GitHub whether the viewer can see a repository, before anyone watches
 * it. The one query that reads GitHub rather than the stored snapshot, because
 * the answer decides whether there is anything to store.
 */
export class LookUpRepositoryHandler implements QueryHandler<
  LookUpRepositoryQuery,
  LookUpRepositoryResult
> {
  constructor(private readonly gitHub: GitHubGateway) {}

  async handle(query: LookUpRepositoryQuery): Promise<LookUpRepositoryResult> {
    const coordinates = RepositoryCoordinates.create(query.owner, query.name);
    if (isErr(coordinates)) return err(coordinates.error);

    return map(
      await this.gitHub.findRepository(coordinates.value),
      (found) => ({ owner: found.owner, name: found.name }),
    );
  }
}
