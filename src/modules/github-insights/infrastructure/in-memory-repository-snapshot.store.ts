import {
  ALL_PARTS,
  type RepositorySnapshot,
  type RepositorySnapshotStore,
  type SnapshotCounts,
  type SnapshotParts,
} from "@/modules/github-insights/application/ports/repository-snapshot";

export class InMemoryRepositorySnapshotStore implements RepositorySnapshotStore {
  readonly #byId = new Map<string, RepositorySnapshot>();

  constructor(seed: Record<string, RepositorySnapshot> = {}) {
    for (const [id, snapshot] of Object.entries(seed)) {
      this.#byId.set(id, snapshot);
    }
  }

  replace(repositoryId: string, snapshot: RepositorySnapshot): Promise<void> {
    this.#byId.set(repositoryId, snapshot);
    return Promise.resolve();
  }

  load(
    repositoryIds: readonly string[],
    parts: SnapshotParts = ALL_PARTS,
  ): Promise<ReadonlyMap<string, RepositorySnapshot>> {
    return Promise.resolve(
      new Map(
        repositoryIds.flatMap((id) => {
          const snapshot = this.#byId.get(id);
          if (!snapshot) return [];
          return [
            [
              id,
              {
                ...snapshot,
                pullRequests: parts.pullRequests ? snapshot.pullRequests : [],
                issues: parts.issues ? snapshot.issues : [],
              },
            ] as const,
          ];
        }),
      ),
    );
  }

  loadCounts(
    repositoryIds: readonly string[],
  ): Promise<ReadonlyMap<string, SnapshotCounts>> {
    return this.load(repositoryIds);
  }
}
