import type { Result, UniqueId } from "@/shared/domain";

import type { RepositoryCoordinates } from "./repository-coordinates";
import type { WatchedRepository } from "./watched-repository";

export type ConcurrentModification = {
  readonly code: "concurrent-modification";
  readonly message: string;
};

export function concurrentModification(
  message: string,
): ConcurrentModification {
  return { code: "concurrent-modification", message };
}

export interface WatchedRepositoryRepository {
  findById(id: UniqueId): Promise<WatchedRepository | undefined>;
  /** GitHub names are case-insensitive, and so is this lookup. */
  findByCoordinates(
    watcherId: string,
    coordinates: RepositoryCoordinates,
  ): Promise<WatchedRepository | undefined>;
  findAllFor(watcherId: string): Promise<WatchedRepository[]>;
  // Saves only if nobody else saved since the load, so of two requests racing
  // to start a sync exactly one wins.
  save(
    repository: WatchedRepository,
  ): Promise<Result<void, ConcurrentModification>>;
  remove(id: UniqueId): Promise<void>;
}
