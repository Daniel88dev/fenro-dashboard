import type { UniqueId } from "@/shared/domain";

import type { RepositoryCoordinates } from "./repository-coordinates";
import type { WatchedRepository } from "./watched-repository";

/** The port. Its implementations live in `infrastructure/`. */
export interface WatchedRepositoryRepository {
  findById(id: UniqueId): Promise<WatchedRepository | undefined>;
  findByCoordinates(
    coordinates: RepositoryCoordinates,
  ): Promise<WatchedRepository | undefined>;
  findAll(): Promise<WatchedRepository[]>;
  save(repository: WatchedRepository): Promise<void>;
  remove(id: UniqueId): Promise<void>;
}
