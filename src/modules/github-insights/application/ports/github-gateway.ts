import type { RepositoryCoordinates } from "@/modules/github-insights/domain";
import type { Result } from "@/shared/domain";

import type { RepositorySnapshot } from "./repository-snapshot";

export type GitHubFailureCode =
  | "github-unauthorized"
  | "github-rate-limited"
  | "github-forbidden"
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

/** A repository the viewer can see, as the picker offers it. */
export type GitHubRepository = {
  readonly owner: string;
  readonly name: string;
  readonly isPrivate: boolean;
  readonly description: string | null;
  readonly pushedAt: Date | null;
};

/**
 * Everything this context asks GitHub. An implementation is bound to one
 * viewer's token by the composition root, so no command, query or handler
 * ever holds the token.
 */
export interface GitHubGateway {
  /**
   * The repositories the viewer owns, collaborates on or can see through an
   * organization, spelled as GitHub spells them. Archived ones are left out.
   */
  listRepositories(): Promise<
    Result<readonly GitHubRepository[], GitHubFailure>
  >;

  /** Open pull requests, reviews, checks and open issues, in one read. */
  fetchSnapshot(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<RepositorySnapshot, GitHubFailure>>;
}
