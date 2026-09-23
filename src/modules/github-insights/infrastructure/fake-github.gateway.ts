import {
  gitHubFailure,
  type GitHubFailure,
  type GitHubGateway,
} from "@/modules/github-insights/application/ports/github-gateway";
import type { RepositorySnapshot } from "@/modules/github-insights/application/ports/repository-snapshot";
import type { RepositoryCoordinates } from "@/modules/github-insights/domain";
import { err, ok, type Result } from "@/shared/domain";

/**
 * GitHub for tests: answers from a map of snapshots keyed `owner/name`, or
 * with the failure a test sets, and counts every call so a test can prove a
 * sync did not happen.
 */
export class FakeGitHubGateway implements GitHubGateway {
  readonly calls: string[] = [];
  failure: GitHubFailure | null = null;

  constructor(
    private readonly snapshots: Record<string, RepositorySnapshot> = {},
  ) {}

  set(fullName: string, snapshot: RepositorySnapshot): void {
    this.snapshots[fullName] = snapshot;
  }

  findRepository(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<RepositoryCoordinates, GitHubFailure>> {
    this.calls.push(`find ${coordinates.fullName}`);
    if (this.failure) return Promise.resolve(err(this.failure));
    return Promise.resolve(
      this.#known(coordinates)
        ? ok(coordinates)
        : err(this.#notFound(coordinates)),
    );
  }

  fetchSnapshot(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<RepositorySnapshot, GitHubFailure>> {
    this.calls.push(`snapshot ${coordinates.fullName}`);
    if (this.failure) return Promise.resolve(err(this.failure));
    const snapshot = this.#known(coordinates);
    return Promise.resolve(
      snapshot ? ok(snapshot) : err(this.#notFound(coordinates)),
    );
  }

  #known(coordinates: RepositoryCoordinates): RepositorySnapshot | undefined {
    return this.snapshots[coordinates.fullName];
  }

  #notFound(coordinates: RepositoryCoordinates): GitHubFailure {
    return gitHubFailure(
      "github-not-found",
      `GitHub has no repository ${coordinates.fullName} that you can see.`,
    );
  }
}
