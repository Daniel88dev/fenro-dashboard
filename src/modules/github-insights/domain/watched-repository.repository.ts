import type { Result, UniqueId } from "@/shared/domain";

import type { RepositoryCoordinates } from "./repository-coordinates";
import type { WatchedRepository } from "./watched-repository";

/**
 * Someone else saved the same aggregate between this load and this save: a
 * second tab starting the same sync, say. Expected, so it is a value.
 */
export type ConcurrentModification = {
  readonly code: "concurrent-modification";
  readonly message: string;
};

export function concurrentModification(
  message: string,
): ConcurrentModification {
  return { code: "concurrent-modification", message };
}

/** The port. Its implementations live in `infrastructure/`. */
export interface WatchedRepositoryRepository {
  findById(id: UniqueId): Promise<WatchedRepository | undefined>;
  /** GitHub names are case-insensitive, and so is this lookup. */
  findByCoordinates(
    watcherId: string,
    coordinates: RepositoryCoordinates,
  ): Promise<WatchedRepository | undefined>;
  findAllFor(watcherId: string): Promise<WatchedRepository[]>;
  /**
   * Saves only if nobody else saved the aggregate since it was loaded, which
   * is what lets two requests race to start a sync and exactly one win.
   */
  save(
    repository: WatchedRepository,
  ): Promise<Result<void, ConcurrentModification>>;
  remove(id: UniqueId): Promise<void>;
}
