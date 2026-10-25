import { and, asc, eq, sql } from "drizzle-orm";

import {
  concurrentModification,
  RepositoryCoordinates,
  SyncState,
  WatchedRepository,
  type ConcurrentModification,
  type RepositorySource,
  type SyncFailureKind,
  type WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import { err, ok, UniqueId, unwrap, type Result } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { watchedRepository } from "./persistence/schema";

type Row = typeof watchedRepository.$inferSelect;

export class DrizzleWatchedRepositoryRepository implements WatchedRepositoryRepository {
  readonly #loadedVersions = new WeakMap<WatchedRepository, number>();
  // Each container builds its own adapter for one viewer and one render or
  // action, so lookups served from a list it loaded never cross users.
  readonly #listedByWatcher = new Map<string, Row[]>();

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
    const listed = this.#listedByWatcher.get(watcherId);
    if (listed) {
      const row = listed.find((one) => sameCoordinates(one, coordinates));
      return row ? this.#restore(row) : undefined;
    }

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
    this.#listedByWatcher.set(watcherId, rows);
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
            .returning()
        : await this.db
            .update(watchedRepository)
            .set({ ...values, version: loaded + 1 })
            .where(
              and(
                eq(watchedRepository.id, values.id),
                eq(watchedRepository.version, loaded),
              ),
            )
            .returning();

    const [row] = saved;
    if (!row) {
      // Otherwise every later lookup would hand back the version just refused.
      this.#listedByWatcher.delete(repository.watcherId);
      return err(
        concurrentModification(
          `${repository.coordinates.fullName} changed since it was loaded.`,
        ),
      );
    }
    this.#loadedVersions.set(repository, row.version);
    this.#replaceListed(row);
    // Drained rather than published: nothing subscribes yet, and leaving them
    // on the aggregate would leak them into the next save.
    repository.pullDomainEvents();
    return ok(undefined);
  }

  async remove(id: UniqueId): Promise<void> {
    await this.db
      .delete(watchedRepository)
      .where(eq(watchedRepository.id, id.value));
    for (const [watcherId, listed] of this.#listedByWatcher) {
      this.#listedByWatcher.set(
        watcherId,
        listed.filter((row) => row.id !== id.value),
      );
    }
  }

  #replaceListed(saved: Row): void {
    const listed = this.#listedByWatcher.get(saved.watcherId);
    if (!listed) return;
    const others = listed.filter((row) => row.id !== saved.id);
    this.#listedByWatcher.set(saved.watcherId, [...others, saved]);
  }

  #restore(row: Row): WatchedRepository {
    const repository = WatchedRepository.restore(
      UniqueId.create(row.id),
      {
        watcherId: row.watcherId,
        coordinates: unwrap(RepositoryCoordinates.create(row.owner, row.name)),
        watchedAt: row.watchedAt,
        source: sourceOf(row.source),
      },
      SyncState.restore({
        lastSyncedAt: row.lastSyncedAt,
        lastAttemptedAt: row.lastSyncAttemptedAt,
        lastFailure: row.lastSyncFailure,
        lastFailureKind: failureKind(row.lastSyncFailureKind),
        startedAt: row.syncStartedAt,
      }),

      row.pinnedAt,
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
    source: repository.source,
    pinnedAt: repository.pinnedAt,
    lastSyncedAt: sync.lastSyncedAt,
    lastSyncAttemptedAt: sync.lastAttemptedAt,
    lastSyncFailure: sync.lastFailure,
    lastSyncFailureKind: sync.lastFailureKind,
    syncStartedAt: sync.startedAt,
  };
}

function sameCoordinates(row: Row, coordinates: RepositoryCoordinates) {
  return (
    row.owner.toLowerCase() === coordinates.owner.toLowerCase() &&
    row.name.toLowerCase() === coordinates.name.toLowerCase()
  );
}

function failureKind(value: string | null): SyncFailureKind | null {
  if (value === null) return null;
  return value === "rate-limited" ? "rate-limited" : "failed";
}

function sourceOf(value: string): RepositorySource {
  return value === "manual" ? "manual" : "github";
}
