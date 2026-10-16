import {
  AggregateRoot,
  err,
  isErr,
  ok,
  UniqueId,
  type Result,
} from "@/shared/domain";

import { syncRefused, type SyncRefused } from "./errors";
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

export type RepositorySource = "github" | "manual";

type Props = {
  readonly watcherId: string;
  readonly coordinates: RepositoryCoordinates;
  readonly watchedAt: Date;
  readonly source: RepositorySource;
};

export class WatchedRepository extends AggregateRoot<Props> {
  #sync: SyncState;
  // A time rather than a flag, so ordering pins by when they were made needs
  // no migration.
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
    return WatchedRepository.#create(
      watcherId,
      coordinates,
      watchedAt,
      "github",
    );
  }

  static addManually(
    watcherId: string,
    coordinates: RepositoryCoordinates,
    addedAt: Date,
  ): WatchedRepository {
    return WatchedRepository.#create(watcherId, coordinates, addedAt, "manual");
  }

  static #create(
    watcherId: string,
    coordinates: RepositoryCoordinates,
    watchedAt: Date,
    source: RepositorySource,
  ): WatchedRepository {
    const repository = new WatchedRepository(
      UniqueId.create(),
      { watcherId, coordinates, watchedAt, source },
      SyncState.never(),
      null,
    );
    repository.record(
      new RepositoryWatched(
        repository.id.value,
        coordinates.fullName,
        source,
        watchedAt,
      ),
    );
    return repository;
  }

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
    if (this.isManual) {
      return err(
        syncRefused(
          "not-connected",
          `${this.props.coordinates.fullName} was added by hand and is not read from GitHub.`,
        ),
      );
    }
    const started = this.#sync.start(trigger, now);
    if (isErr(started)) return started;
    this.#sync = started.value;
    return ok(undefined);
  }

  isDueAutomatically(now: Date): boolean {
    return !this.isManual && this.#sync.isDueAutomatically(now);
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

  get source(): RepositorySource {
    return this.props.source;
  }

  get isManual(): boolean {
    return this.props.source === "manual";
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

  #requireSyncInFlight(): void {
    if (this.#sync.startedAt === null) {
      throw new Error(
        `No sync is running for ${this.props.coordinates.fullName}.`,
      );
    }
  }
}
