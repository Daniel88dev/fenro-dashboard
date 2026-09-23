import { err, ok, ValueObject, type Result } from "@/shared/domain";

import { syncRefused, type SyncRefused } from "./errors";

const MINUTE = 60_000;

/**
 * How often this app is willing to ask GitHub about one repository. GitHub
 * rations calls per user token, and it is often slow or down, so the dashboard
 * serves what it last stored and only goes back to GitHub when this allows.
 */
export const SYNC_POLICY = {
  /** Older than this, the stored numbers are refreshed on the next visit. */
  staleAfterMs: 60 * MINUTE,
  /** A failed sync is not retried on its own until this has passed. */
  retryAfterFailureMs: 5 * MINUTE,
  /** Refresh pressed again this soon after the last attempt does nothing. */
  manualCooldownMs: 1 * MINUTE,
  /**
   * A sync that started longer ago than this is assumed dead (a crashed
   * process, a timed-out function), so another one may start.
   */
  leaseMs: 2 * MINUTE,
} as const;

/** Refresh pressed by a person, or a visit finding the numbers stale. */
export type SyncTrigger = "manual" | "automatic";

type Props = {
  readonly lastSyncedAt: Date | null;
  readonly lastAttemptedAt: Date | null;
  /** Why the latest attempt failed; cleared by the next success. */
  readonly lastFailure: string | null;
  /** When the sync in flight started, or null when none is. */
  readonly startedAt: Date | null;
};

/**
 * Where one watched repository's copy of GitHub stands. Every rule about when
 * GitHub may be asked again lives here, so neither a route nor a component can
 * decide to spend the user's rate limit on its own.
 */
export class SyncState extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static never(): SyncState {
    return new SyncState({
      lastSyncedAt: null,
      lastAttemptedAt: null,
      lastFailure: null,
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

  /**
   * Whether a visit should start a sync by itself: the numbers are stale,
   * nobody is syncing them, and the last attempt did not just fail. The last
   * condition is what stops a GitHub outage from turning every page view into
   * another failed call.
   */
  isDueAutomatically(now: Date): boolean {
    if (!this.isStale(now) || this.isInProgress(now)) return false;
    return (
      this.props.lastAttemptedAt === null ||
      elapsed(this.props.lastAttemptedAt, now) >=
        SYNC_POLICY.retryAfterFailureMs
    );
  }

  /** The state once a sync has started, or why one may not start now. */
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
      startedAt: null,
    });
  }

  failed(reason: string): SyncState {
    return new SyncState({
      ...this.props,
      lastFailure: reason,
      startedAt: null,
    });
  }
}

function elapsed(since: Date, now: Date): number {
  return now.getTime() - since.getTime();
}
