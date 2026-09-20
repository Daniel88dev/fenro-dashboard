import type {
  RepositoryCoordinates,
  WatchedRepository,
  WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import type { UniqueId } from "@/shared/domain";

/**
 * Holds watched repositories for the life of the process. Real persistence is
 * ticket 07's to choose; until then this keeps the write side honest without
 * committing the app to a store.
 */
export class InMemoryWatchedRepositoryRepository implements WatchedRepositoryRepository {
  readonly #byId = new Map<string, WatchedRepository>();

  constructor(seed: readonly WatchedRepository[] = []) {
    for (const repository of seed)
      this.#byId.set(repository.id.value, repository);
  }

  findById(id: UniqueId): Promise<WatchedRepository | undefined> {
    return Promise.resolve(this.#byId.get(id.value));
  }

  findByCoordinates(
    coordinates: RepositoryCoordinates,
  ): Promise<WatchedRepository | undefined> {
    return Promise.resolve(
      [...this.#byId.values()].find((repository) =>
        repository.coordinates.equals(coordinates),
      ),
    );
  }

  findAll(): Promise<WatchedRepository[]> {
    return Promise.resolve([...this.#byId.values()]);
  }

  save(repository: WatchedRepository): Promise<void> {
    this.#byId.set(repository.id.value, repository);
    // The events an aggregate recorded are drained here rather than published:
    // nothing subscribes yet, and leaving them on the aggregate would leak them
    // into the next save.
    repository.pullDomainEvents();
    return Promise.resolve();
  }

  remove(id: UniqueId): Promise<void> {
    this.#byId.delete(id.value);
    return Promise.resolve();
  }
}
