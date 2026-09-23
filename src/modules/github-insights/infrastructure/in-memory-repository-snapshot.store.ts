import type {
  RepositorySnapshot,
  RepositorySnapshotStore,
} from "@/modules/github-insights/application/ports/repository-snapshot";

/** Snapshots for the life of the process: the Postgres store's twin in tests. */
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
  ): Promise<ReadonlyMap<string, RepositorySnapshot>> {
    return Promise.resolve(
      new Map(
        repositoryIds.flatMap((id) => {
          const snapshot = this.#byId.get(id);
          return snapshot ? [[id, snapshot] as const] : [];
        }),
      ),
    );
  }
}
