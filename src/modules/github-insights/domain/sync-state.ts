import { err, ok, ValueObject, type Result } from "@/shared/domain";

import { syncRefused, type SyncRefused } from "./errors";

const MINUTE = 60_000;

export const SYNC_POLICY = {
  staleAfterMs: 60 * MINUTE,
  retryAfterFailureMs: 5 * MINUTE,
  // Longer: the rate limit resets within the hour, and asking sooner only
  // spends the calls it has left.
  retryAfterRateLimitMs: 15 * MINUTE,
  manualCooldownMs: 1 * MINUTE,
  leaseMs: 2 * MINUTE,
} as const;

export type SyncTrigger = "manual" | "automatic";

export type SyncFailureKind = "rate-limited" | "failed";

type Props = {
  readonly lastSyncedAt: Date | null;
  readonly lastAttemptedAt: Date | null;
  readonly lastFailure: string | null;
  readonly lastFailureKind: SyncFailureKind | null;
  readonly startedAt: Date | null;
};

export class SyncState extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static never(): SyncState {
    return new SyncState({
      lastSyncedAt: null,
      lastAttemptedAt: null,
      lastFailure: null,
      lastFailureKind: null,
      startedAt: null,
    });
  }

  static restore(props: Props): SyncState {
    return new SyncState(props);
  }

  get lastSyncedAt(): Date | null {
    return this.props.lastSyncedAt;
  }

  get lastAttemptedAt(): Date | null {
    return this.props.lastAttemptedAt;
  }

  get lastFailure(): string | null {
    return this.props.lastFailure;
  }

  get lastFailureKind(): SyncFailureKind | null {
    return this.props.lastFailureKind;
  }

  get isRateLimited(): boolean {
    return (
      this.props.lastFailure !== null &&
      this.props.lastFailureKind === "rate-limited"
    );
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  isInProgress(now: Date): boolean {
    return (
      this.props.startedAt !== null &&
      elapsed(this.props.startedAt, now) < SYNC_POLICY.leaseMs
    );
  }

  isStale(now: Date): boolean {
    return (
      this.props.lastSyncedAt === null ||
      elapsed(this.props.lastSyncedAt, now) >= SYNC_POLICY.staleAfterMs
    );
  }

  // Not right after a failure, so a GitHub outage does not turn every page
  // view into another failed call.
  isDueAutomatically(now: Date): boolean {
    if (!this.isStale(now) || this.isInProgress(now)) return false;
    const wait = this.isRateLimited
      ? SYNC_POLICY.retryAfterRateLimitMs
      : SYNC_POLICY.retryAfterFailureMs;
    return (
      this.props.lastAttemptedAt === null ||
      elapsed(this.props.lastAttemptedAt, now) >= wait
    );
  }

  start(trigger: SyncTrigger, now: Date): Result<SyncState, SyncRefused> {
    if (this.isInProgress(now)) {
      return err(syncRefused("in-progress", "A sync is already running."));
    }
    if (trigger === "automatic" && !this.isDueAutomatically(now)) {
      return err(syncRefused("not-due", "The stored numbers are recent."));
    }
    if (
      trigger === "manual" &&
      this.props.lastAttemptedAt !== null &&
      elapsed(this.props.lastAttemptedAt, now) < SYNC_POLICY.manualCooldownMs
    ) {
      return err(
        syncRefused("cooling-down", "It was synced less than a minute ago."),
      );
    }
    return ok(
      new SyncState({ ...this.props, lastAttemptedAt: now, startedAt: now }),
    );
  }

  succeeded(now: Date): SyncState {
    return new SyncState({
      ...this.props,
      lastSyncedAt: now,
      lastFailure: null,
      lastFailureKind: null,
      startedAt: null,
    });
  }

  failed(reason: string, kind: SyncFailureKind = "failed"): SyncState {
    return new SyncState({
      ...this.props,
      lastFailure: reason,
      lastFailureKind: kind,
      startedAt: null,
    });
  }
}

function elapsed(since: Date, now: Date): number {
  return now.getTime() - since.getTime();
}
