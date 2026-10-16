import {
  gitHubFailure,
  type GitHubFailure,
  type GitHubGateway,
  type GitHubRepository,
} from "@/modules/github-insights/application/ports/github-gateway";
import type { RepositorySnapshot } from "@/modules/github-insights/application/ports/repository-snapshot";
import type { RepositoryCoordinates } from "@/modules/github-insights/domain";
import { err, ok, type Result } from "@/shared/domain";

export class FakeGitHubGateway implements GitHubGateway {
  readonly calls: string[] = [];
  failure: GitHubFailure | null = null;

  constructor(
    private readonly snapshots: Record<string, RepositorySnapshot> = {},
  ) {}

  set(fullName: string, snapshot: RepositorySnapshot): void {
    this.snapshots[fullName] = snapshot;
  }

  listRepositories(): Promise<
    Result<readonly GitHubRepository[], GitHubFailure>
  > {
    this.calls.push("list");
    if (this.failure) return Promise.resolve(err(this.failure));
    return Promise.resolve(
      ok(
        Object.keys(this.snapshots).map((fullName) => {
          const [owner = "", name = ""] = fullName.split("/");
          return {
            owner,
            name,
            isPrivate: false,
            description: null,
            pushedAt: null,
          };
        }),
      ),
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
