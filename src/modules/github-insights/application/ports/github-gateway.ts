import type { RepositoryCoordinates } from "@/modules/github-insights/domain";
import type { Result } from "@/shared/domain";

import type { RepositorySnapshot } from "./repository-snapshot";

export type GitHubFailureCode =
  | "github-unauthorized"
  | "github-rate-limited"
  | "github-forbidden"
  | "github-not-found"
  | "github-unavailable";

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

export type GitHubRepository = {
  readonly owner: string;
  readonly name: string;
  readonly isPrivate: boolean;
  readonly description: string | null;
  readonly pushedAt: Date | null;
};

export interface GitHubGateway {
  listRepositories(): Promise<
    Result<readonly GitHubRepository[], GitHubFailure>
  >;

  fetchSnapshot(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<RepositorySnapshot, GitHubFailure>>;
}
