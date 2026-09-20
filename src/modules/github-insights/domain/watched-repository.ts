import { AggregateRoot, UniqueId } from "@/shared/domain";

import { RepositoryUnwatched, RepositoryWatched } from "./events";
import type { RepositoryCoordinates } from "./repository-coordinates";

type Props = {
  readonly coordinates: RepositoryCoordinates;
  readonly watchedAt: Date;
};

/**
 * The only aggregate in this context. GitHub is the system of record for pull
 * requests, issues and checks, and this app enforces no invariant over them, so
 * they are read models rather than domain objects — see
 * docs/implementation-plan.md.
 *
 * `watch` cannot fail: the one expected failure, coordinates that are not a
 * repository, is owned by `RepositoryCoordinates`, so an instance of this
 * aggregate can never hold an invalid one.
 */
export class WatchedRepository extends AggregateRoot<Props> {
  private constructor(id: UniqueId, props: Props) {
    super(id, props);
  }

  static watch(
    coordinates: RepositoryCoordinates,
    watchedAt: Date,
  ): WatchedRepository {
    const repository = new WatchedRepository(UniqueId.create(), {
      coordinates,
      watchedAt,
    });
    repository.record(
      new RepositoryWatched(
        repository.id.value,
        coordinates.fullName,
        watchedAt,
      ),
    );
    return repository;
  }

  /** Rebuild an aggregate that a store already holds, recording no event. */
  static restore(id: UniqueId, props: Props): WatchedRepository {
    return new WatchedRepository(id, props);
  }

  unwatch(unwatchedAt: Date): void {
    this.record(
      new RepositoryUnwatched(
        this.id.value,
        this.props.coordinates.fullName,
        unwatchedAt,
      ),
    );
  }

  get coordinates(): RepositoryCoordinates {
    return this.props.coordinates;
  }

  get watchedAt(): Date {
    return this.props.watchedAt;
  }
}
