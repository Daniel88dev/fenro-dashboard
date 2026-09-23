import { and, asc, eq, sql } from "drizzle-orm";

import {
  concurrentModification,
  RepositoryCoordinates,
  SyncState,
  WatchedRepository,
  type ConcurrentModification,
  type WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import { err, ok, UniqueId, unwrap, type Result } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { watchedRepository } from "./persistence/schema";

type Row = typeof watchedRepository.$inferSelect;

/**
 * `WatchedRepository` in Postgres, with optimistic concurrency: the version a
 * repository was loaded at is remembered beside it, and a save only lands if
 * the row still has that version. The domain never sees a version number.
 */
export class DrizzleWatchedRepositoryRepository implements WatchedRepositoryRepository {
  readonly #loadedVersions = new WeakMap<WatchedRepository, number>();

  constructor(private readonly db: Database) {}

  async findById(id: UniqueId): Promise<WatchedRepository | undefined> {
    const [row] = await this.db
      .select()
      .from(watchedRepository)
      .where(eq(watchedRepository.id, id.value));
    return row ? this.#restore(row) : undefined;
  }

  async findByCoordinates(
    watcherId: string,
    coordinates: RepositoryCoordinates,
  ): Promise<WatchedRepository | undefined> {
    const [row] = await this.db
      .select()
      .from(watchedRepository)
      .where(
        and(
          eq(watchedRepository.watcherId, watcherId),
          eq(
            sql`lower(${watchedRepository.owner})`,
            coordinates.owner.toLowerCase(),
          ),
          eq(
            sql`lower(${watchedRepository.name})`,
            coordinates.name.toLowerCase(),
          ),
        ),
      );
    return row ? this.#restore(row) : undefined;
  }

  async findAllFor(watcherId: string): Promise<WatchedRepository[]> {
    const rows = await this.db
      .select()
      .from(watchedRepository)
      .where(eq(watchedRepository.watcherId, watcherId))
      .orderBy(asc(watchedRepository.watchedAt));
    return rows.map((row) => this.#restore(row));
  }

  async save(
    repository: WatchedRepository,
  ): Promise<Result<void, ConcurrentModification>> {
    const loaded = this.#loadedVersions.get(repository);
    const values = toValues(repository);

    const saved =
      loaded === undefined
        ? await this.db
            .insert(watchedRepository)
            .values({ ...values, version: 1 })
            .onConflictDoNothing()
            .returning({ version: watchedRepository.version })
        : await this.db
            .update(watchedRepository)
            .set({ ...values, version: loaded + 1 })
            .where(
              and(
                eq(watchedRepository.id, values.id),
                eq(watchedRepository.version, loaded),
              ),
            )
            .returning({ version: watchedRepository.version });

    const [row] = saved;
    if (!row) {
      return err(
        concurrentModification(
          `${repository.coordinates.fullName} changed since it was loaded.`,
        ),
      );
    }
    this.#loadedVersions.set(repository, row.version);
    // Drained rather than published: nothing subscribes yet, and leaving them
    // on the aggregate would leak them into the next save.
    repository.pullDomainEvents();
    return ok(undefined);
  }

  async remove(id: UniqueId): Promise<void> {
    await this.db
      .delete(watchedRepository)
      .where(eq(watchedRepository.id, id.value));
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
        lastAttemptedAt: row.lastSyncAttemptedAt,
        lastFailure: row.lastSyncFailure,
        startedAt: row.syncStartedAt,
      }),
    );
    this.#loadedVersions.set(repository, row.version);
    return repository;
  }
}

function toValues(repository: WatchedRepository) {
  const { sync } = repository;
  return {
    id: repository.id.value,
    watcherId: repository.watcherId,
    owner: repository.coordinates.owner,
    name: repository.coordinates.name,
    watchedAt: repository.watchedAt,
    lastSyncedAt: sync.lastSyncedAt,
    lastSyncAttemptedAt: sync.lastAttemptedAt,
    lastSyncFailure: sync.lastFailure,
    syncStartedAt: sync.startedAt,
  };
}
