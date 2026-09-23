import { describe, expect, it } from "vitest";

import { isErr, unwrap } from "@/shared/domain";

import { SYNC_POLICY, SyncState } from "./sync-state";

const MINUTE = 60_000;
const at = (iso: string) => new Date(iso);
const later = (date: Date, milliseconds: number) =>
  new Date(date.getTime() + milliseconds);

const t0 = at("2026-09-23T10:00:00Z");

function syncedAt(when: Date): SyncState {
  return unwrap(SyncState.never().start("manual", when)).succeeded(when);
}

describe("SyncState", () => {
  it("is stale until it has been synced once", () => {
    expect(SyncState.never().isStale(t0)).toBe(true);
    expect(SyncState.never().isDueAutomatically(t0)).toBe(true);
  });

  it("goes stale an hour after the last sync, not before", () => {
    const state = syncedAt(t0);

    expect(state.isStale(later(t0, 59 * MINUTE))).toBe(false);
    expect(state.isStale(later(t0, SYNC_POLICY.staleAfterMs))).toBe(true);
  });

  it("starts an automatic sync only when the numbers are stale", () => {
    const state = syncedAt(t0);

    const early = state.start("automatic", later(t0, 30 * MINUTE));
    expect(isErr(early) && early.error.reason).toBe("not-due");

    const due = state.start("automatic", later(t0, 61 * MINUTE));
    expect(isErr(due)).toBe(false);
  });

  it("refuses a second sync while one is running", () => {
    const running = unwrap(SyncState.never().start("manual", t0));

    const second = running.start("manual", later(t0, 90_000));
    expect(isErr(second) && second.error.reason).toBe("in-progress");
    expect(running.isDueAutomatically(later(t0, 90_000))).toBe(false);
  });

  it("gives up on a sync that has been running for longer than the lease", () => {
    const running = unwrap(SyncState.never().start("manual", t0));
    const afterLease = later(t0, SYNC_POLICY.leaseMs);

    expect(running.isInProgress(afterLease)).toBe(false);
    expect(isErr(running.start("manual", afterLease))).toBe(false);
  });

  it("ignores Refresh pressed again within a minute", () => {
    const state = syncedAt(t0);

    const soon = state.start("manual", later(t0, 30_000));
    expect(isErr(soon) && soon.error.reason).toBe("cooling-down");
    expect(isErr(state.start("manual", later(t0, MINUTE)))).toBe(false);
  });

  it("lets Refresh through while the numbers are still fresh", () => {
    const state = syncedAt(t0);

    expect(isErr(state.start("manual", later(t0, 10 * MINUTE)))).toBe(false);
  });

  it("does not retry a failed sync on its own for five minutes", () => {
    const failed = unwrap(SyncState.never().start("automatic", t0)).failed(
      "GitHub is unavailable.",
    );

    expect(failed.isStale(later(t0, MINUTE))).toBe(true);
    expect(failed.isDueAutomatically(later(t0, 4 * MINUTE))).toBe(false);
    expect(
      failed.isDueAutomatically(later(t0, SYNC_POLICY.retryAfterFailureMs)),
    ).toBe(true);
  });

  it("waits longer before retrying on its own once GitHub's rate limit ran out", () => {
    const limited = unwrap(SyncState.never().start("automatic", t0)).failed(
      "GitHub's rate limit is used up for now.",
      "rate-limited",
    );

    expect(limited.isRateLimited).toBe(true);
    expect(
      limited.isDueAutomatically(later(t0, SYNC_POLICY.retryAfterFailureMs)),
    ).toBe(false);
    expect(
      limited.isDueAutomatically(later(t0, SYNC_POLICY.retryAfterRateLimitMs)),
    ).toBe(true);
  });

  it("keeps the last good sync time when a later sync fails", () => {
    const failed = unwrap(
      syncedAt(t0).start("manual", later(t0, 2 * MINUTE)),
    ).failed("GitHub is unavailable.");

    expect(failed.lastSyncedAt).toEqual(t0);
    expect(failed.lastFailure).toBe("GitHub is unavailable.");
    expect(failed.startedAt).toBeNull();
  });

  it("forgets the failure once a sync succeeds", () => {
    const failed = unwrap(SyncState.never().start("manual", t0)).failed(
      "GitHub is unavailable.",
    );
    const recovered = unwrap(
      failed.start("manual", later(t0, 2 * MINUTE)),
    ).succeeded(later(t0, 2 * MINUTE));

    expect(recovered.lastFailure).toBeNull();
    expect(recovered.isRateLimited).toBe(false);
    expect(recovered.lastSyncedAt).toEqual(later(t0, 2 * MINUTE));
  });
});
