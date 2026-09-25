import {
  concurrentModification,
  RepositoryCoordinates,
  SyncState,
  WatchedRepository,
  type ConcurrentModification,
  type SyncFailureKind,
  type WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import { err, ok, UniqueId, unwrap, type Result } from "@/shared/domain";

type Row = {
  readonly id: string;
  readonly watcherId: string;
  readonly owner: string;
  readonly name: string;
  readonly watchedAt: Date;
  readonly pinnedAt: Date | null;
  readonly lastSyncedAt: Date | null;
  readonly lastAttemptedAt: Date | null;
  readonly lastFailure: string | null;
  readonly lastFailureKind: SyncFailureKind | null;
  readonly startedAt: Date | null;
  readonly version: number;
};

/**
 * The Postgres adapter's twin for tests. It keeps rows rather than the
 * aggregates themselves, and checks versions on save the same way, so a test
 * that races two syncs sees what production would.
 */
export class InMemoryWatchedRepositoryRepository implements WatchedRepositoryRepository {
  readonly #rows = new Map<string, Row>();
  readonly #loadedVersions = new WeakMap<WatchedRepository, number>();

  constructor(seed: readonly WatchedRepository[] = []) {
    for (const repository of seed) {
      repository.pullDomainEvents();
      this.#rows.set(repository.id.value, toRow(repository, 1));
    }
  }

  findById(id: UniqueId): Promise<WatchedRepository | undefined> {
    const row = this.#rows.get(id.value);
    return Promise.resolve(row ? this.#restore(row) : undefined);
  }

  findByCoordinates(
    watcherId: string,
    coordinates: RepositoryCoordinates,
  ): Promise<WatchedRepository | undefined> {
    const row = [...this.#rows.values()].find(
      (one) =>
        one.watcherId === watcherId &&
        one.owner.toLowerCase() === coordinates.owner.toLowerCase() &&
        one.name.toLowerCase() === coordinates.name.toLowerCase(),
    );
    return Promise.resolve(row ? this.#restore(row) : undefined);
  }

  findAllFor(watcherId: string): Promise<WatchedRepository[]> {
    return Promise.resolve(
      [...this.#rows.values()]
        .filter((row) => row.watcherId === watcherId)
        .map((row) => this.#restore(row)),
    );
  }

  save(
    repository: WatchedRepository,
  ): Promise<Result<void, ConcurrentModification>> {
    const loaded = this.#loadedVersions.get(repository);
    const stored = this.#rows.get(repository.id.value);

    if (loaded === undefined) {
      const duplicate = [...this.#rows.values()].some(
        (row) =>
          row.watcherId === repository.watcherId &&
          row.owner.toLowerCase() ===
            repository.coordinates.owner.toLowerCase() &&
          row.name.toLowerCase() === repository.coordinates.name.toLowerCase(),
      );
      if (stored || duplicate) {
        return Promise.resolve(err(concurrentModification("Already watched.")));
      }
    } else if (stored?.version !== loaded) {
      return Promise.resolve(
        err(concurrentModification("Saved by someone else since loading.")),
      );
    }

    const version = (loaded ?? 0) + 1;
    this.#rows.set(repository.id.value, toRow(repository, version));
    this.#loadedVersions.set(repository, version);
    // Drained rather than published: nothing subscribes yet, and leaving them
    // on the aggregate would leak them into the next save.
    repository.pullDomainEvents();
    return Promise.resolve(ok(undefined));
  }

  remove(id: UniqueId): Promise<void> {
    this.#rows.delete(id.value);
    return Promise.resolve();
  }

  #restore(row: Row): WatchedRepository {
    const repository = WatchedRepository.restore(
      UniqueId.create(row.id),
      {
        watcherId: row.watcherId,
        coordinates: unwrap(RepositoryCoordinates.create(row.owner, row.name)),
        watchedAt: row.watchedAt,
      },
      SyncState.restore({
        lastSyncedAt: row.lastSyncedAt,
        lastAttemptedAt: row.lastAttemptedAt,
        lastFailure: row.lastFailure,
        lastFailureKind: row.lastFailureKind,
        startedAt: row.startedAt,
      }),

      row.pinnedAt,
    );
    this.#loadedVersions.set(repository, row.version);
    return repository;
  }
}

function toRow(repository: WatchedRepository, version: number): Row {
  const { sync } = repository;
  return {
    id: repository.id.value,
    watcherId: repository.watcherId,
    owner: repository.coordinates.owner,
    name: repository.coordinates.name,
    watchedAt: repository.watchedAt,
    pinnedAt: repository.pinnedAt,
    lastSyncedAt: sync.lastSyncedAt,
    lastAttemptedAt: sync.lastAttemptedAt,
    lastFailure: sync.lastFailure,
    lastFailureKind: sync.lastFailureKind,
    startedAt: sync.startedAt,
    version,
  };
}
