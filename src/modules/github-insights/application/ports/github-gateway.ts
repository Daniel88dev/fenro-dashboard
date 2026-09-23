import type { RepositoryCoordinates } from "@/modules/github-insights/domain";
import type { Result } from "@/shared/domain";

import type { RepositorySnapshot } from "./repository-snapshot";

export type GitHubFailureCode =
  | "github-unauthorized"
  | "github-rate-limited"
  | "github-not-found"
  | "github-unavailable";

/**
 * GitHub failing is expected — it is down often enough to be the reason this
 * app keeps its own copy — so every failure is a value with a sentence a
 * person can read.
 */
export type GitHubFailure = {
  readonly code: GitHubFailureCode;
  readonly message: string;
};

export function gitHubFailure(
  code: GitHubFailureCode,
  message: string,
): GitHubFailure {
  return { code, message };
}

/**
 * Everything this context asks GitHub. An implementation is bound to one
 * viewer's token by the composition root, so no command, query or handler
 * ever holds the token.
 */
export interface GitHubGateway {
  /**
   * The repository as GitHub spells it, if the viewer can see it. People type
   * names in any case; GitHub's spelling is what gets stored.
   */
  findRepository(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<RepositoryCoordinates, GitHubFailure>>;

  /** Open pull requests, reviews, checks and open issues, in one read. */
  fetchSnapshot(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<RepositorySnapshot, GitHubFailure>>;
}
