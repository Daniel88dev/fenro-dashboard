import {
  AggregateRoot,
  isErr,
  ok,
  UniqueId,
  type Result,
} from "@/shared/domain";

import type { SyncRefused } from "./errors";
import {
  RepositoryPinned,
  RepositorySynced,
  RepositorySyncFailed,
  RepositoryUnpinned,
  RepositoryUnwatched,
  RepositoryWatched,
} from "./events";
import type { RepositoryCoordinates } from "./repository-coordinates";
import {
  SyncState,
  type SyncFailureKind,
  type SyncTrigger,
} from "./sync-state";

type Props = {
  /**
   * The signed-in user whose dashboard this is. Each person keeps their own
   * list, because what one token can read another may not.
   */
  readonly watcherId: string;
  readonly coordinates: RepositoryCoordinates;
  readonly watchedAt: Date;
};

/**
 * The only aggregate in this context. GitHub is the system of record for pull
 * requests, issues and checks, and this app enforces no invariant over them, so
 * they are read models rather than domain objects — see
 * docs/implementation-plan.md.
 *
 * What it does own is when GitHub may be asked about the repository again: a
 * sync starts, then succeeds or fails, and `SyncState` decides whether it may
 * start at all.
 *
 * `watch` cannot fail: the one expected failure, coordinates that are not a
 * repository, is owned by `RepositoryCoordinates`, so an instance of this
 * aggregate can never hold an invalid one.
 */
export class WatchedRepository extends AggregateRoot<Props> {
  #sync: SyncState;
  /**
   * When its watcher pinned it to the top of their table, or `null`. A time
   * rather than a flag, so ordering pins by when they were made needs no
   * migration.
   */
  #pinnedAt: Date | null;

  private constructor(
    id: UniqueId,
    props: Props,
    sync: SyncState,
    pinnedAt: Date | null,
  ) {
    super(id, props);
    this.#sync = sync;
    this.#pinnedAt = pinnedAt;
  }

  static watch(
    watcherId: string,
    coordinates: RepositoryCoordinates,
    watchedAt: Date,
  ): WatchedRepository {
    const repository = new WatchedRepository(
      UniqueId.create(),
      { watcherId, coordinates, watchedAt },
      SyncState.never(),
      null,
    );
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
  static restore(
    id: UniqueId,
    props: Props,
    sync: SyncState = SyncState.never(),
    pinnedAt: Date | null = null,
  ): WatchedRepository {
    return new WatchedRepository(id, props, sync, pinnedAt);
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

  /** Pinning a pinned repository keeps the time it was first pinned. */
  pin(pinnedAt: Date): void {
    if (this.#pinnedAt) return;
    this.#pinnedAt = pinnedAt;
    this.record(
      new RepositoryPinned(
        this.id.value,
        this.props.coordinates.fullName,
        pinnedAt,
      ),
    );
  }

  unpin(unpinnedAt: Date): void {
    if (!this.#pinnedAt) return;
    this.#pinnedAt = null;
    this.record(
      new RepositoryUnpinned(
        this.id.value,
        this.props.coordinates.fullName,
        unpinnedAt,
      ),
    );
  }

  startSync(trigger: SyncTrigger, now: Date): Result<void, SyncRefused> {
    const started = this.#sync.start(trigger, now);
    if (isErr(started)) return started;
    this.#sync = started.value;
    return ok(undefined);
  }

  completeSync(now: Date): void {
    this.#requireSyncInFlight();
    this.#sync = this.#sync.succeeded(now);
    this.record(
      new RepositorySynced(this.id.value, this.props.coordinates.fullName, now),
    );
  }

  failSync(reason: string, now: Date, kind: SyncFailureKind = "failed"): void {
    this.#requireSyncInFlight();
    this.#sync = this.#sync.failed(reason, kind);
    this.record(
      new RepositorySyncFailed(
        this.id.value,
        this.props.coordinates.fullName,
        reason,
        now,
      ),
    );
  }

  get watcherId(): string {
    return this.props.watcherId;
  }

  get coordinates(): RepositoryCoordinates {
    return this.props.coordinates;
  }

  get watchedAt(): Date {
    return this.props.watchedAt;
  }

  get pinnedAt(): Date | null {
    return this.#pinnedAt;
  }

  get isPinned(): boolean {
    return this.#pinnedAt !== null;
  }

  get sync(): SyncState {
    return this.#sync;
  }

  /** Finishing a sync nobody started is a bug in the caller, not a state. */
  #requireSyncInFlight(): void {
    if (this.#sync.startedAt === null) {
      throw new Error(
        `No sync is running for ${this.props.coordinates.fullName}.`,
      );
    }
  }
}
